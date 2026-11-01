# -*- coding: utf-8 -*-
"""
Valida o pacote gerado contra âncoras conhecidas.

Cada teste compara um número do pacote com um valor que o projeto anterior
havia apurado (RESUMO.md) ou com uma identidade contábil que precisa valer.

Uso: python valida.py
"""
from __future__ import annotations

import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, "out", "dados.json")

falhas: list[str] = []
passes = 0


def carrega() -> dict:
    with open(DADOS, encoding="utf-8") as f:
        return json.load(f)


def confere(nome: str, obtido, esperado, tolerancia: float = 1.0) -> None:
    """Compara com tolerância absoluta (padrão R$ 1,00)."""
    global passes
    if obtido is None:
        falhas.append(f"{nome}: valor ausente (esperado {esperado})")
        return
    if abs(float(obtido) - float(esperado)) > tolerancia:
        falhas.append(f"{nome}: obtido {obtido:,.2f}, esperado {esperado:,.2f} "
                      f"(diferença {float(obtido) - float(esperado):,.2f})")
    else:
        passes += 1


def confere_pct(nome: str, obtido, esperado, tolerancia: float = 0.05) -> None:
    global passes
    if obtido is None:
        falhas.append(f"{nome}: valor ausente (esperado {esperado}%)")
        return
    if abs(float(obtido) - float(esperado)) > tolerancia:
        falhas.append(f"{nome}: obtido {obtido}%, esperado {esperado}%")
    else:
        passes += 1


def principal() -> int:
    d = carrega()
    ex = d["execucao"]
    tot = ex["totais"]
    ind = d["indicadores"]

    print("=" * 72)
    print("1. TOTAIS LIQUIDADOS POR ANO")
    print("=" * 72)
    # Valores do RESUMO.md do projeto anterior (R$).
    esperados = {
        2020: 444_260_714.48,
        2021: 504_294_600.00,   # arredondado no resumo
        2022: 653_073_000.00,
        2023: 703_722_400.00,
        2024: 691_023_500.00,
        2025: 767_869_593.15,
    }
    for ano, esperado in esperados.items():
        obtido = tot.get(str(ano), {}).get("liquidado")
        confere(f"liquidado {ano}", obtido, esperado,
                tolerancia=500.0)  # o resumo arredonda em milhares
        print(f"  {ano}: R$ {obtido:>16,.2f}  (esperado ~{esperado:,.2f})")

    print("\n" + "=" * 72)
    print("2. ACUMULADO 2020-2025")
    print("=" * 72)
    acumulado = sum((tot.get(str(a), {}).get("liquidado") or 0) for a in range(2020, 2026))
    confere("acumulado 2020-2025", acumulado, 3_764_243_739.55, tolerancia=3000.0)
    print(f"  R$ {acumulado:,.2f}  (esperado ~3.764.243.739,55)")

    print("\n" + "=" * 72)
    print("3. ÂNCORA: SOMA DAS SUBFUNÇÕES = TOTAL (divergência zero)")
    print("=" * 72)
    for a in ex["auditoria"]:
        div = a.get("divergencia")
        confere(f"divergência {a['ano']}", div, 0.0, tolerancia=1.0)
        print(f"  {a['ano']}: divergência R$ {div:,.2f}")

    print("\n" + "=" * 72)
    print("4. CONCENTRAÇÃO: SUBFUNÇÃO 302 EM 2025")
    print("=" * 72)
    s302 = next((s for s in ex["subfuncoes"]
                 if s["cod"] == 302 and s["cod_funcao"] == 10), None)
    if s302:
        v = s302["valores"].get("2025", {}).get("liquidado")
        confere("302 liquidado 2025", v, 154_866_597.05, tolerancia=1.0)
        p = s302["valores"].get("2025", {}).get("liquidado")
        total_2025 = tot.get("2025", {}).get("liquidado")
        if p and total_2025:
            confere_pct("302 % do total 2025", round(p / total_2025 * 100, 2), 20.2, 0.15)
            print(f"  R$ {v:,.2f} = {p/total_2025*100:.1f}% do total")
    else:
        falhas.append("subfunção 302 não encontrada")

    print("\n" + "=" * 72)
    print("5. FUNÇÕES DOMINANTES (participação acumulada)")
    print("=" * 72)
    soma_anos = {}
    for f in ex["funcoes"]:
        soma_anos[f["cod"]] = sum(
            (f["valores"].get(str(a), {}).get("liquidado") or 0) for a in range(2020, 2026))
    total_geral = sum(soma_anos.values())
    for cod, esperado in ((10, 28.8), (12, 23.1), (9, 15.5)):
        p = soma_anos.get(cod, 0) / total_geral * 100 if total_geral else None
        confere_pct(f"função {cod} % acumulado", round(p, 1), esperado, 0.3)
        print(f"  função {cod:02d}: {p:.1f}%  (esperado {esperado}%)")

    print("\n" + "=" * 72)
    print("6. COERÊNCIA INTERNA")
    print("=" * 72)
    # Liquidado nunca pode exceder o empenhado.
    violacoes = 0
    for f in ex["funcoes"]:
        for ano, v in f["valores"].items():
            liq, emp = v.get("liquidado"), v.get("empenhado")
            if liq is not None and emp is not None and liq > emp + 1:
                violacoes += 1
    confere("liquidado > empenhado", violacoes, 0, tolerancia=0)
    print(f"  violações liquidado>empenhado: {violacoes}")

    # Nenhum valor negativo no liquidado.
    negativos = sum(
        1 for f in ex["funcoes"]
        for v in f["valores"].values()
        if (v.get("liquidado") or 0) < 0)
    confere("liquidado negativo", negativos, 0, tolerancia=0)
    print(f"  valores negativos em liquidado: {negativos}")

    print("\n" + "=" * 72)
    print("7. INDICADORES DERIVADOS")
    print("=" * 72)
    pc = ind["per_capita"].get("2025")
    if pc:
        # 767.869.593,15 / 129.430 = 5.932,88
        confere("per capita 2025", pc, 5932.88, tolerancia=1.0)
        print(f"  R$ {pc:,.2f} por habitante (2025)")
    else:
        falhas.append("per capita 2025 ausente")

    pessoal_2025 = ind["pessoal_rcl"].get("2025", {}).get("dtp_pct_rcl")
    if pessoal_2025:
        # O RGF publica o percentual sobre a RCL Ajustada: 42,58% em 2025.
        # O projeto anterior calculava DTP/RCL bruta e obtinha 43,8%.
        confere_pct("pessoal/RCL 2025 (RGF oficial)", pessoal_2025, 42.58, 0.05)
        print(f"  pessoal/RCL 2025: {pessoal_2025:.2f}% (limite 54%)")
    else:
        print("  pessoal/RCL 2025: não apurado no RGF")

    # A DCL é negativa porque o município tem mais disponibilidades que dívida
    # bruta. O valor de 2025 confere com a referência do projeto anterior.
    dcl_2025 = ind["divida_rcl"].get("2025", {}).get("dcl_pct_rcl")
    if dcl_2025 is not None:
        confere_pct("dívida líquida/RCL 2025", dcl_2025, -8.94, 0.1)
        print(f"  dívida líquida/RCL 2025: {dcl_2025:.2f}% (negativa = sem dívida líquida)")
    else:
        falhas.append("dívida líquida 2025 não apurada")

    print("\n" + "=" * 72)
    print("8. COBERTURA DE DADOS")
    print("=" * 72)
    print(f"  funções: {len(ex['funcoes'])}")
    print(f"  subfunções: {len(ex['subfuncoes'])}")
    print(f"  servidores: {len(d['servidores']['servidores'])}")
    print(f"  contratados no ranking: {len(d['compras']['maiores_contratados'])}")
    print(f"  obras: {len(d['obras_convenios']['obras'])}")
    print(f"  convênios: {len(d['obras_convenios']['convenios'])}")
    n_pag = sum(v["ordens"] for e in d["pagamentos"]["por_entidade"].values()
                for v in e.values())
    print(f"  ordens de pagamento: {n_pag:,}")

    confere("funções extraídas", len(ex["funcoes"]), 23, tolerancia=0)
    confere("subfunções extraídas", len(ex["subfuncoes"]), 63, tolerancia=0)

    print("\n" + "=" * 72)
    if falhas:
        print(f"FALHAS: {len(falhas)}  |  passes: {passes}")
        for f in falhas:
            print(f"  ✗ {f}")
        return 1
    print(f"TODAS AS VERIFICAÇÕES PASSARAM ({passes})")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
