# -*- coding: utf-8 -*-
"""
Coletor SICONFI / Tesouro Nacional — Bento Gonçalves (IBGE 4302105).

Baixa, com cache em disco e retomada, os anexos usados pela análise:

  RREO  Anexos 01, 02, 03, 04, 06, 07, 09, 11, 14   (6º bimestre de cada exercício)
  RGF   Anexos 01..06  (3º quadrimestre, poder Executivo e Legislativo)
  DCA   Anexos I-C, I-D, I-E, I-F, I-G              (encerramento de exercício)
  Extrato de entregas 2020..2026

Uso:
    python coleta_siconfi.py            # baixa o que faltar
    python coleta_siconfi.py --forcar   # rebaixa tudo, ignorando o cache
    python coleta_siconfi.py --so-relatorio
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any

BASE = "https://apidatalake.tesouro.gov.br/ords/cdwhprd/siconfi/tt"

AQUI = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(os.path.dirname(AQUI), "config", "municipio.json")
with open(CONFIG, encoding="utf-8") as f:
    CFG = json.load(f)

IBGE = CFG["ibge"]
UA = {"User-Agent": f"observatorio-orcamento-{CFG['municipio'].lower().replace(' ', '-')}/2.0 (uso educacional e de controle social)"}
ANOS = CFG.get("anos", [2020, 2021, 2022, 2023, 2024, 2025])
LIMITE = 5000
TENTATIVAS = 4
TIMEOUT = 300

AQUI = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(AQUI, "raw", "siconfi")

RREO_ANEXOS = [1, 2, 3, 4, 6, 7, 9, 11, 14]
RGF_ANEXOS = [1, 2, 3, 4, 5, 6]
DCA_ANEXOS = [("DCA-Anexo I-C", "dca_ic"), ("DCA-Anexo I-D", "dca_id"),
              ("DCA-Anexo I-E", "dca_ie"), ("DCA-Anexo I-F", "dca_if"),
              ("DCA-Anexo I-G", "dca_ig")]


@dataclass(frozen=True)
class Job:
    nome: str
    endpoint: str
    params: dict[str, Any]


def _get(endpoint: str, params: dict[str, Any], tentativas: int = TENTATIVAS) -> dict[str, Any]:
    """GET com retry e backoff exponencial. Retorna o JSON decodificado."""
    url = f"{BASE}/{endpoint}?{urllib.parse.urlencode(params)}"
    ultimo: Exception | None = None
    for k in range(tentativas):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            ultimo = e
            # 4xx que não seja 429 não melhora com retry.
            if 400 <= e.code < 500 and e.code != 429:
                raise
        except Exception as e:  # noqa: BLE001 - rede é imprevisível
            ultimo = e
        if k < tentativas - 1:
            time.sleep(4 * (k + 1))
    raise RuntimeError(f"falhou após {tentativas} tentativas: {ultimo}") from ultimo


def baixa_paginado(endpoint: str, params: dict[str, Any]) -> list[dict[str, Any]]:
    """Percorre todas as páginas de um endpoint SICONFI (limit/offset/hasMore)."""
    itens: list[dict[str, Any]] = []
    offset = 0
    while True:
        j = _get(endpoint, {**params, "limit": LIMITE, "offset": offset})
        lote = j.get("items", []) or []
        itens.extend(lote)
        if not j.get("hasMore") or not lote:
            break
        offset += LIMITE
    return itens


def executa(job: Job, forcar: bool) -> tuple[str, str, int]:
    """Baixa um job, gravando em cache. Retorna (status, nome, nº de itens)."""
    caminho = os.path.join(DEST, job.nome + ".json")
    if os.path.exists(caminho) and not forcar:
        try:
            with open(caminho, encoding="utf-8") as f:
                return "cache", job.nome, len(json.load(f))
        except Exception:  # noqa: BLE001 - arquivo truncado: rebaixa
            pass
    itens = baixa_paginado(job.endpoint, job.params)
    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(itens, f, ensure_ascii=False)
    os.replace(tmp, caminho)  # escrita atômica: nunca deixa arquivo pela metade
    return "ok", job.nome, len(itens)


def monta_jobs() -> list[Job]:
    jobs: list[Job] = []

    for a in RREO_ANEXOS:
        for ano in ANOS:
            jobs.append(Job(
                nome=f"rreo_a{a:02d}_{ano}",
                endpoint="rreo",
                params=dict(an_exercicio=ano, nr_periodo=6,
                            co_tipo_demonstrativo="RREO", id_ente=IBGE,
                            co_esfera="M", no_anexo=f"RREO-Anexo {a:02d}"),
            ))

    for a in RGF_ANEXOS:
        for ano in ANOS:
            jobs.append(Job(
                nome=f"rgf_a{a:02d}_E_{ano}",
                endpoint="rgf",
                params=dict(an_exercicio=ano, in_periodicidade="Q", nr_periodo=3,
                            co_tipo_demonstrativo="RGF", co_poder="E", id_ente=IBGE,
                            co_esfera="M", no_anexo=f"RGF-Anexo {a:02d}"),
            ))

    # O Legislativo só entrega o Anexo 01 (despesa com pessoal).
    for ano in ANOS:
        jobs.append(Job(
            nome=f"rgf_a01_L_{ano}",
            endpoint="rgf",
            params=dict(an_exercicio=ano, in_periodicidade="Q", nr_periodo=3,
                        co_tipo_demonstrativo="RGF", co_poder="L", id_ente=IBGE,
                        co_esfera="M", no_anexo="RGF-Anexo 01"),
        ))

    for nome_anexo, rotulo in DCA_ANEXOS:
        for ano in ANOS:
            jobs.append(Job(
                nome=f"{rotulo}_{ano}",
                endpoint="dca",
                params=dict(an_exercicio=ano, id_ente=IBGE, no_anexo=nome_anexo),
            ))

    for ano in ANOS + [2026]:
        jobs.append(Job(
            nome=f"extrato_{ano}",
            endpoint="extrato_entregas",
            params=dict(id_ente=IBGE, an_referencia=ano, limit=500),
        ))

    return jobs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--forcar", action="store_true", help="ignora o cache e rebaixa tudo")
    ap.add_argument("--so-relatorio", action="store_true", help="não baixa, só resume o cache")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    os.makedirs(DEST, exist_ok=True)
    jobs = monta_jobs()

    if args.so_relatorio:
        for j in jobs:
            caminho = os.path.join(DEST, j.nome + ".json")
            estado = "AUSENTE"
            n = 0
            if os.path.exists(caminho):
                try:
                    with open(caminho, encoding="utf-8") as f:
                        n = len(json.load(f))
                    estado = "ok" if n else "VAZIO"
                except Exception:  # noqa: BLE001
                    estado = "CORROMPIDO"
            print(f"  {j.nome:22} {estado:10} {n:>6} itens")
        return 0

    print(f"SICONFI — {len(jobs)} requisições para {len(ANOS)} exercícios")
    print(f"destino: {DEST}\n")

    ok = cache = falha = vazio = 0
    falhas: list[str] = []
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futuros = {ex.submit(executa, j, args.forcar): j for j in jobs}
        for fut in as_completed(futuros):
            job = futuros[fut]
            try:
                status, nome, n = fut.result()
            except Exception as e:  # noqa: BLE001
                falha += 1
                falhas.append(f"{job.nome}: {e}")
                print(f"  FALHOU  {job.nome}: {type(e).__name__}: {str(e)[:110]}")
                continue
            if status == "cache":
                cache += 1
            elif n == 0:
                vazio += 1
                print(f"  vazio   {nome} (anexo sem dados publicados)")
            else:
                ok += 1
                print(f"  ok      {nome} ({n} itens)")

    dt = time.time() - t0
    print(f"\n{'-' * 62}")
    print(f"Concluído em {dt:.0f}s — {ok} baixados, {cache} em cache, "
          f"{vazio} vazios, {falha} falhas")
    if falhas:
        print("\nFalhas:")
        for f in falhas:
            print("  -", f)
    return 1 if falha else 0


if __name__ == "__main__":
    sys.exit(main())
