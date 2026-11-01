# -*- coding: utf-8 -*-
"""
Coletor do Portal de Transparência municipal (API ELO Tech) — Bento Gonçalves.

Entidades:
  1 = Município (Prefeitura)     2 = Câmara de Vereadores
  3 = Fundação Casa das Artes    4 = FAPSBENTO (RPPS)

Baixa pagamentos, a-pagar, receitas, servidores, licitações, contratos,
créditos adicionais, obras, convênios e dashboards mensais.

Os parâmetros `entidade` e `exercicio` vão como HEADER, não como query —
isso é uma peculiaridade da API e a causa do erro 400 quando trocados.

Uso:
    python coleta_bg.py                # baixa o que faltar
    python coleta_bg.py --forcar       # rebaixa tudo
    python coleta_bg.py --so-relatorio
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any

BASE = "https://bentogoncalves.oxy.elotech.com.br/portaltransparencia-api"
UA = "observatorio-orcamento-bg/2.0 (uso educacional e controle social)"
ANOS = [2020, 2021, 2022, 2023, 2024, 2025]
ANO_CORRENTE = 2026
ENTIDADES = [1, 2]
PAGINA = 500          # a API limita o tamanho real da página; ajustamos abaixo
TENTATIVAS = 4
TIMEOUT = 180

AQUI = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(AQUI, "raw", "bg")

_lock = threading.Lock()


@dataclass(frozen=True)
class Job:
    nome: str
    path: str
    query: dict[str, Any] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    paginado: bool = True


def _get(path: str, query: dict[str, Any], headers: dict[str, str],
         tentativas: int = TENTATIVAS) -> Any:
    url = BASE + path + ("?" + urllib.parse.urlencode(query) if query else "")
    ultimo: Exception | None = None
    for k in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, **headers})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            corpo = ""
            try:
                corpo = e.read().decode("utf-8", "replace")[:200]
            except Exception:  # noqa: BLE001
                pass
            ultimo = RuntimeError(f"HTTP {e.code} {corpo}")
            if 400 <= e.code < 500 and e.code not in (408, 429):
                raise ultimo
        except Exception as e:  # noqa: BLE001
            ultimo = e
        if k < tentativas - 1:
            time.sleep(3 * (k + 1))
    raise RuntimeError(f"falhou após {tentativas} tentativas: {ultimo}") from ultimo


def baixa_paginado(job: Job) -> dict[str, Any]:
    """Percorre todas as páginas. Adapta o `size` ao limite real do servidor."""
    conteudo: list[Any] = []
    pagina = 0
    size = PAGINA
    total = None
    while True:
        j = _get(job.path, {**job.query, "page": pagina, "size": size}, job.headers)
        if not isinstance(j, dict) or "content" not in j:
            return j if isinstance(j, dict) else {"content": j}
        itens = j.get("content") or []
        conteudo.extend(itens)
        if total is None:
            total = j.get("totalElements")
            # O servidor trunca a página: usa o tamanho efetivo da 1ª resposta.
            if pagina == 0 and itens and len(itens) < size:
                size = max(len(itens), 1)
        if j.get("last", True) or not itens:
            break
        pagina += 1
        if pagina > 20000:
            break
    return {"totalElements": total, "content": conteudo}


def executa(job: Job, forcar: bool) -> tuple[str, str, int]:
    caminho = os.path.join(DEST, job.nome + ".json")
    if os.path.exists(caminho) and not forcar:
        try:
            with open(caminho, encoding="utf-8") as f:
                d = json.load(f)
            n = len(d.get("content", [])) if isinstance(d, dict) else len(d)
            return "cache", job.nome, n
        except Exception:  # noqa: BLE001 - truncado: rebaixa
            pass

    if job.paginado:
        obj = baixa_paginado(job)
        n = len(obj.get("content", []))
    else:
        obj = _get(job.path, job.query, job.headers)
        # Três formatos possíveis: lista, objeto com `content`, ou escalar
        # (os dashboards `despesa` e `receita` devolvem um número).
        if isinstance(obj, list):
            n = len(obj)
        elif isinstance(obj, dict):
            n = len(obj.get("content", [])) or (1 if obj else 0)
        else:
            n = 1 if obj not in (None, 0, 0.0) else 0

    tmp = caminho + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, caminho)
    return "ok", job.nome, n


def monta_jobs() -> list[Job]:
    jobs: list[Job] = []

    # ---- pagamentos e a-pagar (o maior volume: ~150 MB) ----
    for ent in ENTIDADES:
        for ano in ANOS + [ANO_CORRENTE]:
            h = {"entidade": str(ent), "exercicio": str(ano)}
            jobs.append(Job(f"pagamentos_e{ent}_{ano}",
                            "/api/liquidacoes/ordem-cronologica-pagamentos", headers=h))
            jobs.append(Job(f"apagar_e{ent}_{ano}", "/api/liquidacoes/pagar", headers=h))

    # ---- receitas (lista hierárquica por exercício) ----
    for ent in ENTIDADES:
        for ano in ANOS + [ANO_CORRENTE]:
            jobs.append(Job(f"receitas_e{ent}_{ano}", "/api/receitas",
                            query={"entidade": ent, "exercicio": ano},
                            headers={"entidade": str(ent), "exercicio": str(ano)},
                            paginado=False))

    # ---- servidores ----
    for ent in ENTIDADES:
        for ano in ANOS + [ANO_CORRENTE]:
            jobs.append(Job(f"servidores_e{ent}_{ano}", "/api/servidores",
                            query={"size": 200},
                            headers={"entidade": str(ent), "exercicio": str(ano)}))
            jobs.append(Job(f"resumonatureza_e{ent}_{ano}",
                            "/api/servidores/resumonatureza",
                            query={"entidade": ent},
                            headers={"entidade": str(ent), "exercicio": str(ano)},
                            paginado=False))
        jobs.append(Job(f"cargos_e{ent}", "/api/cargos/busca-cargos",
                        query={"entidade": ent, "exercicio": ANO_CORRENTE, "size": 500},
                        headers={"entidade": str(ent), "exercicio": str(ANO_CORRENTE)}))

    # ---- licitações e contratos ----
    for ent in ENTIDADES:
        for ano in ANOS + [ANO_CORRENTE]:
            h = {"entidade": str(ent), "exercicio": str(ano)}
            jobs.append(Job(f"licitacoes_e{ent}_{ano}", "/api/licitacoes",
                            query={"entidade": ent, "exercicio": ano}, headers=h))
            jobs.append(Job(f"contratos_e{ent}_{ano}", "/api/contratos",
                            query={"entidade": ent, "exercicio": ano}, headers=h))

    # ---- créditos adicionais (alterações orçamentárias) ----
    # Aqui `entidade` vai no HEADER e `exercicio` na QUERY — o inverso dos
    # demais endpoints. Trocar os dois devolve 500.
    for ano in ANOS + [ANO_CORRENTE]:
        jobs.append(Job(f"creditosadicionais_{ano}", "/api/creditosadicionais",
                        query={"entidade": 1, "exercicio": ano},
                        headers={"entidade": "1"}))

    # ---- obras, convênios, dívida ativa (sem filtro de exercício) ----
    # Todos exigem o header `entidade`; a dívida ativa vem do sistema
    # tributário, que a API reporta como não configurado — mantida como
    # opcional para que uma falha aqui não invalide a coleta.
    for ano in (ANO_CORRENTE,):
        h = {"entidade": "1", "exercicio": str(ano)}
        jobs.append(Job("obras_todas", "/api/obras", query={"entidade": 1}, headers=h))
        jobs.append(Job("convenios_todos", "/api/convenios",
                        query={"entidade": 1}, headers=h))
    jobs.append(Job("dividas_ativas", "/api/dividas-ativas", query={"entidade": 1},
                    headers={"entidade": "1", "exercicio": str(ANO_CORRENTE)}))

    # ---- dashboards mensais ----
    # `despesa` e `receita` devolvem um número (total do exercício), não uma
    # lista — por isso não são paginados e o contador precisa tratá-los.
    for dash in ("despesa", "receita", "pessoal", "arrecadacao-despesa",
                 "educacao", "saude"):
        for ano in ANOS + [ANO_CORRENTE]:
            jobs.append(Job(f"dash_{dash}_{ano}", f"/api/dashboard/{dash}",
                            headers={"entidade": "1", "exercicio": str(ano)},
                            paginado=False))

    # ---- tabelas de referência (classificações) ----
    for n in ("funcao", "subFuncao", "programa", "elemento", "fonteRecurso"):
        jobs.append(Job(f"programatica_{n}", f"/api/programatica/{n}",
                        query={"entidade": 1},
                        headers={"entidade": "1", "exercicio": "2024"},
                        paginado=False))
    jobs.append(Job("entidades", "/api/entidades/lista",
                    query={"fields": "id,nome,cnpj,entidadePrincipal,tipo"},
                    paginado=False))
    jobs.append(Job("servidores_situacoes", "/api/servidores/situacoes",
                    headers={"entidade": "1", "exercicio": str(ANO_CORRENTE)},
                    paginado=False))

    return jobs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--forcar", action="store_true")
    ap.add_argument("--so-relatorio", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--filtro", default="", help="só nomes que contenham este texto")
    args = ap.parse_args()

    os.makedirs(DEST, exist_ok=True)
    jobs = monta_jobs()
    if args.filtro:
        jobs = [j for j in jobs if args.filtro in j.nome]

    if args.so_relatorio:
        total_bytes = 0
        for j in jobs:
            caminho = os.path.join(DEST, j.nome + ".json")
            if os.path.exists(caminho):
                tam = os.path.getsize(caminho)
                total_bytes += tam
                try:
                    with open(caminho, encoding="utf-8") as f:
                        d = json.load(f)
                    n = len(d.get("content", [])) if isinstance(d, dict) else len(d)
                    print(f"  {j.nome:34} ok    {n:>8} itens  {tam/1e6:>7.1f} MB")
                except Exception:  # noqa: BLE001
                    print(f"  {j.nome:34} CORROMPIDO")
            else:
                print(f"  {j.nome:34} AUSENTE")
        print(f"\nTotal em disco: {total_bytes/1e6:.1f} MB")
        return 0

    print(f"Portal de Transparência BG — {len(jobs)} requisições")
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
                print(f"  FALHOU  {job.nome}: {str(e)[:120]}")
                continue
            if status == "cache":
                cache += 1
            elif n == 0:
                vazio += 1
                print(f"  vazio   {nome}")
            else:
                ok += 1
                print(f"  ok      {nome} ({n:,} itens)")

    dt = time.time() - t0
    print(f"\n{'-' * 62}")
    print(f"Concluído em {dt:.0f}s — {ok} baixados, {cache} em cache, "
          f"{vazio} vazios, {falha} falhas")
    if falhas:
        print("\nFalhas (a API pode estar sem dado para o ano):")
        for f in falhas:
            print("  -", f)
    return 0  # falha em um anexo opcional não invalida a coleta


if __name__ == "__main__":
    sys.exit(main())
