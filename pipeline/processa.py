# -*- coding: utf-8 -*-
"""
Processador — transforma os dados brutos em um pacote JSON para o site.

Entrada:  raw/siconfi/*.json  e  raw/bg/*.json
Saída:    out/dados.json       (um único arquivo, indexado por domínio)

O princípio é que todo número publicado é calculado aqui, a partir dos dados
brutos. Nada é digitado à mão. Onde um valor não pode ser apurado, o campo
sai como `null` e o site mostra a ausência em vez de inventar.

Uso:
    python processa.py            # gera out/dados.json
    python processa.py --verboso  # mostra o detalhe da validação
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import date
from typing import Any, Iterable

import classificacao as cls

AQUI = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(os.path.dirname(AQUI), "config", "municipio.json")

with open(CONFIG, encoding="utf-8") as f:
    CFG = json.load(f)

RAW_SIC = os.path.join(AQUI, "raw", "siconfi")
RAW_BG = os.path.join(AQUI, "raw", "bg")
OUT = os.path.join(AQUI, "out")
# O site serve o pacote como arquivo estático; por isso ele também é escrito
# em web/public/. As duas cópias são idênticas e saem do mesmo dump.
PUBLIC_WEB = os.path.join(os.path.dirname(AQUI), "web", "public")

ANOS = CFG.get("anos", [2020, 2021, 2022, 2023, 2024, 2025])
ANO_CORRENTE = CFG.get("anoCorrente", 2026)
IBGE = CFG["ibge"]
MUNICIPIO = CFG["municipio"]
UF = CFG["uf"]
PORTAL_CFG = CFG.get("portalTransparencia", {})


# --------------------------------------------------------------------------
# utilidades
# --------------------------------------------------------------------------

def num(v: Any) -> float | None:
    """Converte para float, devolvendo None quando não for numérico."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(".", "").replace(",", ".")) if "," in str(v) else float(v)
    except (TypeError, ValueError):
        return None


def arred(v: float | None, casas: int = 2) -> float | None:
    return None if v is None else round(v, casas)


def soma(valores: Iterable[float | None]) -> float:
    return sum(v for v in valores if v is not None)


def pct(parte: float | None, todo: float | None) -> float | None:
    if parte is None or not todo:
        return None
    return round(parte / todo * 100, 2)


def variavel(a: float | None, b: float | None) -> float | None:
    """Variação percentual de `a` para `b`."""
    if a is None or b is None or a == 0:
        return None
    return round((b - a) / abs(a) * 100, 2)


def cagr(inicio: float | None, fim: float | None, periodos: int) -> float | None:
    if not inicio or not fim or inicio <= 0 or fim <= 0 or periodos <= 0:
        return None
    return round(((fim / inicio) ** (1 / periodos) - 1) * 100, 2)


def le_json(pasta: str, nome: str) -> Any:
    caminho = os.path.join(pasta, nome + ".json")
    if not os.path.exists(caminho):
        return None
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def existe(pasta: str, nome: str) -> bool:
    return os.path.exists(os.path.join(pasta, nome + ".json"))


def norm(s: object) -> str:
    return cls.normaliza(s)


# --------------------------------------------------------------------------
# 1. RREO Anexo 02 — despesa por função e subfunção
# --------------------------------------------------------------------------

class ErroValidacao(Exception):
    """Levantado quando uma âncora de validação não fecha."""


def _caminha_bloco(bloco: list[dict], ano: int, contexto: str) -> list[dict]:
    """
    Percorre um bloco (uma coluna, uma seção) na ordem do relatório,
    atribuindo a função a que cada subfunção pertence.

    A ordem é: linha de controle → linha de função → suas subfunções →
    próxima função. O código numérico não vem no JSON; é reconstruído pelo
    nome, via `classificacao`.
    """
    registros: list[dict] = []
    funcao_atual: str | None = None

    for item in bloco:
        conta = str(item.get("conta", ""))
        chave = norm(conta)

        if conta in cls.CONTROLES:
            funcao_atual = None
            registros.append({"conta": conta, "nivel": cls.CONTROLES[conta],
                              "funcao": None, "valor": num(item.get("valor"))})
            continue

        if chave in cls.POR_FUNCAO:
            funcao_atual = chave
            registros.append({"conta": conta, "nivel": "FUNCAO",
                              "funcao": chave, "valor": num(item.get("valor"))})
            continue

        if funcao_atual is None:
            raise ErroValidacao(
                f"{ano} {contexto}: subfunção '{conta}' apareceu antes de "
                f"qualquer função — a ordem do relatório mudou.")
        registros.append({"conta": conta, "nivel": "SUBFUNCAO",
                          "funcao": funcao_atual, "valor": num(item.get("valor"))})

    return registros


def processa_anexo02(verboso: bool = False) -> dict:
    """
    Extrai dotação, empenhado, liquidado e restos inscritos por
    função e subfunção, para cada exercício.
    """
    funcoes: dict[int, dict] = {}
    subfuncoes: dict[tuple[int, int], dict] = {}
    totais: dict[int, dict] = {}
    auditoria: list[dict] = []
    problemas: list[str] = []

    for ano in ANOS:
        bruto = le_json(RAW_SIC, f"rreo_a02_{ano}")
        if bruto is None:
            problemas.append(f"RREO-Anexo 02 de {ano} ausente")
            continue

        # Integridade estrutural do arquivo.
        if len(bruto) == 0:
            problemas.append(f"RREO-Anexo 02 de {ano} vazio")
            continue
        exercicios = {r.get("exercicio") for r in bruto}
        anexos = {r.get("anexo") for r in bruto}
        periodos = {r.get("periodo") for r in bruto}
        if exercicios != {ano}:
            raise ErroValidacao(f"{ano}: exercicio inesperado {exercicios}")
        if anexos != {"RREO-Anexo 02"}:
            raise ErroValidacao(f"{ano}: anexo inesperado {anexos}")
        if periodos != {6}:
            raise ErroValidacao(f"{ano}: período inesperado {periodos}")

        # Agrupa por (seção, coluna) preservando a ordem de aparição.
        blocos: dict[tuple[str, str], list[dict]] = defaultdict(list)
        for r in bruto:
            blocos[(r["cod_conta"], r["coluna"])].append(r)

        tabela: dict[tuple[str, str], dict] = {}
        esqueleto: dict[str, dict[str, dict]] = {}

        # O bloco de dotação inicial define a estrutura de referência.
        for cod_conta, secao in cls.SECOES_ANEXO02:
            bloco = blocos.get((cod_conta, "DOTAÇÃO INICIAL"))
            if not bloco:
                raise ErroValidacao(f"{ano}: sem bloco DOTAÇÃO INICIAL na seção {secao}")
            registros = _caminha_bloco(bloco, ano, f"seção {secao}")
            esqueleto[secao] = {r["conta"]: r for r in registros}

        for coluna_bruta, chave_col in cls.COLUNAS_ANEXO02.items():
            for cod_conta, secao in cls.SECOES_ANEXO02:
                bloco = blocos.get((cod_conta, coluna_bruta))
                if not bloco:
                    continue
                registros = _caminha_bloco(bloco, ano, f"{chave_col} seção {secao}")

                # Alguns blocos vêm sem as linhas de função: herda do esqueleto.
                tem_funcao = any(r["nivel"] == "FUNCAO" for r in registros)
                if not tem_funcao:
                    for r in registros:
                        esq = esqueleto[secao].get(r["conta"])
                        if esq is None:
                            raise ErroValidacao(
                                f"{ano}: conta '{r['conta']}' fora do esqueleto "
                                f"({chave_col}, seção {secao})")
                        r["nivel"], r["funcao"] = esq["nivel"], esq["funcao"]

                for r in registros:
                    chave = (secao, r["conta"])
                    linha = tabela.setdefault(chave, {
                        "secao": secao, "nivel": r["nivel"], "funcao": r["funcao"],
                        "conta": r["conta"],
                    })
                    if linha["nivel"] != r["nivel"] or linha["funcao"] != r["funcao"]:
                        raise ErroValidacao(
                            f"{ano}: atribuição inconsistente para '{r['conta']}' "
                            f"entre colunas ({linha['funcao']} vs {r['funcao']})")
                    if chave_col in linha:
                        raise ErroValidacao(
                            f"{ano}: valor duplicado para '{r['conta']}' em {chave_col}")
                    linha[chave_col] = r["valor"]

        # Consolida os totais da seção I (exceto intra-orçamentárias).
        total_secao = {
            k: v for k, v in tabela.items()
            if k[0] == "I" and tabela[k]["nivel"].startswith("TOTAL")
        }

        # Ancora: soma das subfunções da seção I deve fechar com o total.
        soma_sub = 0.0
        for (secao, _), linha in tabela.items():
            if secao != "I" or linha["nivel"] != "SUBFUNCAO":
                continue
            soma_sub += linha.get("liquidado") or 0.0
        total_liq = None
        for (secao, _), linha in total_secao.items():
            if linha["nivel"] == "TOTAL_I":
                total_liq = linha.get("liquidado")
        divergencia = None
        if total_liq is not None:
            divergencia = arred(soma_sub - total_liq)
            if abs(divergencia) > 1.0:
                problemas.append(
                    f"{ano}: soma das subfunções difere do total em R$ {divergencia:,.2f}")

        # Distribui nos índices por função e por subfunção.
        for (secao, _), linha in tabela.items():
            if secao != "I":
                continue

            valores = {
                k: linha.get(k) for k in
                ("dotacao_inicial", "dotacao_atualizada", "empenhado",
                 "liquidado", "restos_inscritos")
            }

            # Linhas de controle (TOTAL_I, TOTAL_II, TOTAL_III) não são
            # função nem subfunção — só a TOTAL_I interessa como âncora.
            if linha["nivel"].startswith("TOTAL"):
                if linha["nivel"] == "TOTAL_I":
                    totais.setdefault(ano, {}).update(valores)
                continue

            if linha["nivel"] == "FUNCAO":
                cod, nome = cls.POR_FUNCAO[linha["funcao"]]
                alvo = funcoes.setdefault(cod, {
                    "cod": cod, "nome": nome, "rotulo": cls.rotulo_funcao(cod),
                    "valores": {},
                })
                alvo["valores"][ano] = valores
                continue

            # Subfunção.
            cod_f, nome_f = cls.POR_FUNCAO[linha["funcao"]]
            conta = linha["conta"]
            m = cls.PREFIXO_FUNCAO.match(conta)
            nome_limpo = m.group(2) if m else conta

            chave_s = norm(nome_limpo)
            if chave_s.startswith(norm(cls.NOME_AGREGADO)):
                cod_s, nome_s = cls.COD_AGREGADO, cls.NOME_AGREGADO
            elif chave_s in cls.POR_SUBFUNCAO:
                cod_s, nome_s = cls.POR_SUBFUNCAO[chave_s]
            else:
                problemas.append(
                    f"{ano}: subfunção '{nome_limpo}' sem código oficial — ignorada")
                continue

            alvo = subfuncoes.setdefault((cod_f, cod_s), {
                "cod_funcao": cod_f, "nome_funcao": nome_f,
                "cod": cod_s, "nome": nome_s,
                # O rótulo precisa incluir a função: "122 - Administração Geral"
                # existe em várias funções (Administração, Saúde, Educação…),
                # então só o código da subfunção não identifica a linha.
                "rotulo": (
                    f"{cls.rotulo_subfuncao(cod_s)} · {nome_f}"
                    if cod_s != cls.COD_AGREGADO
                    else f"{cls.NOME_AGREGADO} · {nome_f}"
                ),
                "valores": {},
            })
            alvo["valores"][ano] = valores

        auditoria.append({
            "ano": ano,
            "registros": len(bruto),
            "funcoes": sum(1 for k in tabela if k[0] == "I" and tabela[k]["nivel"] == "FUNCAO"),
            "subfuncoes": sum(1 for k in tabela if k[0] == "I" and tabela[k]["nivel"] == "SUBFUNCAO"),
            "total_liquidado": arred(total_liq),
            "soma_subfuncoes": arred(soma_sub),
            "divergencia": divergencia,
        })

        if verboso:
            print(f"  {ano}: {len(bruto)} registros, "
                  f"{auditoria[-1]['funcoes']} funções, "
                  f"{auditoria[-1]['subfuncoes']} subfunções, "
                  f"divergência R$ {divergencia:,.2f}" if divergencia is not None
                  else f"  {ano}: sem âncora de total")

    return {
        "funcoes": sorted(funcoes.values(), key=lambda f: f["cod"]),
        "subfuncoes": sorted(
            subfuncoes.values(),
            key=lambda s: (-(s["valores"].get(2025, {}).get("liquidado") or 0), s["cod_funcao"], s["cod"]),
        ),
        "totais": totais,
        "auditoria": auditoria,
        "problemas": problemas,
    }


# --------------------------------------------------------------------------
# 2. DCA — despesa paga por função e subfunção
# --------------------------------------------------------------------------

def processa_dca(anexo02: dict) -> dict:
    """
    O Anexo I-E da DCA traz os valores efetivamente pagos. O RREO não tem
    essa coluna, então o pago vem daqui.

    As contas da DCA seguem o formato "10.302 - Assistência Hospitalar...",
    com o código da função e da subfunção embutidos.
    """
    pago: dict[str, dict[int, dict]] = {"funcao": {}, "subfuncao": {}}
    problemas: list[str] = []
    padrao = re.compile(r"^(\d{2})(?:\.(\d{3}))?\s*-\s*(.+)$")

    cobertura: dict[int, dict] = {}

    for ano in ANOS:
        registros = le_json(RAW_SIC, f"dca_ie_{ano}")
        if not registros:
            problemas.append(f"DCA-Anexo I-E de {ano} ausente")
            continue

        lidos = pagos = 0
        for r in registros:
            conta = str(r.get("conta", ""))
            m = padrao.match(conta)
            if not m:
                continue
            lidos += 1
            cod_f = int(m.group(1))
            cod_s = int(m.group(2)) if m.group(2) else None
            coluna = str(r.get("coluna", ""))
            valor = num(r.get("valor"))

            if coluna == "Despesas Pagas" and valor is not None:
                chave = "subfuncao" if cod_s is not None else "funcao"
                k = f"{cod_f}:{cod_s}" if cod_s is not None else str(cod_f)
                pago[chave].setdefault(k, {})[ano] = valor
                pagos += 1
            elif coluna == "Despesas Liquidadas" and valor is not None:
                k = f"{cod_f}:{cod_s}" if cod_s is not None else str(cod_f)
                pago["subfuncao" if cod_s is not None else "funcao"] \
                    .setdefault(k, {}).setdefault("_liq", {})[ano] = valor

        cobertura[ano] = {"contas_lidas": lidos, "valores_pagos": pagos}
        if pagos == 0:
            problemas.append(f"DCA {ano}: nenhum valor de 'Despesas Pagas' encontrado")

    # Anexa o pago às funções e subfunções já extraídas do RREO.
    casados = 0
    for f in anexo02["funcoes"]:
        serie = pago["funcao"].get(str(f["cod"]), {})
        for ano, v in serie.items():
            if isinstance(ano, int):
                f["valores"].setdefault(ano, {})["pago"] = v
                casados += 1

    for s in anexo02["subfuncoes"]:
        if s["cod"] == cls.COD_AGREGADO:
            continue
        serie = pago["subfuncao"].get(f"{s['cod_funcao']}:{s['cod']}", {})
        for ano, v in serie.items():
            if isinstance(ano, int):
                s["valores"].setdefault(ano, {})["pago"] = v

    return {"cobertura": cobertura, "casados": casados, "problemas": problemas}


# --------------------------------------------------------------------------
# 3b. Creditos adicionais — natureza da despesa por subfunção
# --------------------------------------------------------------------------

# Elemento da despesa (2º nível da classificação econômica):
# 3.xxx = Pessoal e encargos, 4.xxx = Custeio, 5.xxx = Juros, etc.
ELEMENTO_NATUREZA: dict[str, str] = {
    "1": "Despesas de capital",
    "2": "Amortização da dívida",
    "3": "Despesas correntes",
    "4": "Custeio",
    "5": "Juros e encargos da dívida",
    "6": "Inversões financeiras",
    "7": "Outras despesas correntes",
    "8": "Reserva de contingência",
    "9": "Outras despesas de capital",
}


def _elemento_da_conta(conta_codigo: str) -> str | None:
    """Extrai o elemento da despesa (2º nível) do código completo.

    O código da despesa segue o padrão:
      função.subfunção.programa.acao.elemento.subgrupo.grupo.modalidade...
    O elemento é o 4º bloco (após o 3º ponto).
    """
    partes = conta_codigo.split(".")
    if len(partes) >= 4:
        return partes[3]
    return None


def processa_creditos_natureza(anexo02: dict) -> dict:
    """
    Cruzamento natureza da despesa × subfunção via créditos adicionais.

    O RREO-Anexo 02 classifica despesa por função/subfunção, mas não traz
    natureza (pessoal × custeio × investimento). O Anexo I-D da DCA traz
    natureza, mas sem subfunção. O Portal municipal também não cruza os dois
    eixos.

    Os créditos adicionais do portal, no entanto, trazem o campo `despesa`
    com a classificação completa:
      função.subfunção.programa.acão.elemento...
    Isso permite calcular, por subfunção, quanto de cada crédito adicional
    se refere a pessoal (elemento 3), custeio (4), juros (5), etc.

    Isso quebra a limitação documentada: hoje é impossível saber quanto de
    "custeio" cada subfunção consumiu. Com os créditos adicionais, passa a
    ser possível — pelo menos para as alterações orçamentárias.
    """
    padrao = re.compile(
        r"^(\d{2})\.(\d{2})\.(\d{2})\.(\d{3})\.(\d{4})\.(\d)\.(\d{3})\."
        r"(\d)\.(\d)\.(\d{2})\.(\d{2})"
    )

    # (função, subfunção, elemento) → ano → valor pago
    cruzado: dict[tuple[int, int, str], dict[int, float]] = {}
    cobertura: dict[int, dict] = {}
    problemas: list[str] = []

    for ano in ANOS:
        registros = le_json(RAW_BG, f"creditosadicionais_{ano}")
        if not registros:
            problemas.append(f"Créditos adicionais de {ano} ausente")
            cobertura[ano] = {"linhas": 0, "parseaveis": 0, "valor_pago": None}
            continue

        linhas = registros.get("content") or []
        lidos = parseaveis = pagos = 0
        valor_total = 0.0

        for r in linhas:
            despesa = str(r.get("despesa") or "")
            m = padrao.match(despesa)
            if not m:
                continue
            lidos += 1
            parseaveis += 1

            cod_f = int(m.group(1))
            cod_s = int(m.group(2))
            elemento = m.group(4)  # 4º bloco = elemento da despesa

            # Coluna indica se é pagamento ou outra natureza do crédito.
            coluna = str(r.get("coluna", ""))
            valor = num(r.get("valor"))

            # Só somamos quando o campo de valor existe e há indício de
            # pagamento/liquidação. Os créditos adicionais não têm coluna
            # de "despesas pagas"; usamos o valor bruto como proxy do
            # impacto orçamentário da alteração.
            if valor is not None:
                chave = (cod_f, cod_s, elemento)
                cruzado.setdefault(chave, {})[ano] = valor
                pagos += 1
                valor_total += valor

        cobertura[ano] = {
            "linhas": len(linhas),
            "parseaveis": parseaveis,
            "valor_pago": arred(valor_total),
        }
        if pagos == 0:
            problemas.append(f"Créditos adicionais {ano}: nenhum valor parseável")

    # Anexa o cruzado às subfunções do Anexo 02.
    anexados = 0
    for s in anexo02["subfuncoes"]:
        if s["cod"] == cls.COD_AGREGADO:
            continue
        s["valores"].setdefault("creditos_natureza", {})
        for ano in ANOS:
            for (cf, cs, elemento), anos_map in cruzado.items():
                if cf == s["cod_funcao"] and cs == s["cod"] and ano in anos_map:
                    s["valores"]["creditos_natureza"].setdefault(ano, {})[
                        elemento
                    ] = anos_map[ano]
                    anexados += 1

    return {
        "cobertura": cobertura,
        "anexados": anexados,
        "problemas": problemas,
    }


# --------------------------------------------------------------------------
# 4. RREO Anexo 01 — balanço orçamentário (receitas e despesas por categoria)
# --------------------------------------------------------------------------

def _valor_conta(registros: list[dict], prefixo: str, coluna_contem: str) -> float | None:
    """Valor da primeira conta que começa com `prefixo` e casa com a coluna."""
    alvo = norm(prefixo)
    for r in registros:
        if not norm(r.get("conta", "")).startswith(alvo):
            continue
        if coluna_contem.lower() in str(r.get("coluna", "")).lower():
            v = num(r.get("valor"))
            if v is not None:
                return v
    return None


def processa_balanco() -> dict:
    """Receitas e despesas por categoria, do RREO-Anexo 01."""
    receitas: dict[str, dict[int, float | None]] = {
        "receitas_correntes": {},
        "receitas_tributarias": {},
        "receitas_contribuicoes": {},
        "receitas_patrimoniais": {},
        "receitas_servicos": {},
        "receitas_transferencias": {},
        "receitas_outras": {},
        "receitas_capital": {},
        "operacoes_credito": {},
        "alienacao_bens": {},
        "transferencias_capital": {},
    }
    despesas: dict[str, dict[int, float | None]] = {
        "despesas_correntes": {},
        "pessoal": {},
        "juros": {},
        "outras_correntes": {},
        "despesas_capital": {},
        "investimentos": {},
        "inversoes": {},
        "amortizacao": {},
    }
    totais: dict[int, dict] = {}
    problemas: list[str] = []

    mapa_receita = {
        "RECEITAS CORRENTES": "receitas_correntes",
        "RECEITAS TRIBUTÁRIAS": "receitas_tributarias",
        "RECEITAS DE CONTRIBUIÇÕES": "receitas_contribuicoes",
        "RECEITAS PATRIMONIAIS": "receitas_patrimoniais",
        "RECEITAS DE SERVIÇOS": "receitas_servicos",
        "TRANSFERÊNCIAS CORRENTES": "receitas_transferencias",
        "OUTRAS RECEITAS CORRENTES": "receitas_outras",
        "RECEITAS DE CAPITAL": "receitas_capital",
        "OPERAÇÕES DE CRÉDITO": "operacoes_credito",
        "ALIENAÇÃO DE BENS": "alienacao_bens",
        "TRANSFERÊNCIAS DE CAPITAL": "transferencias_capital",
    }
    mapa_despesa = {
        "DESPESAS CORRENTES": "despesas_correntes",
        "PESSOAL E ENCARGOS SOCIAIS": "pessoal",
        "JUROS E ENCARGOS DA DÍVIDA": "juros",
        "OUTRAS DESPESAS CORRENTES": "outras_correntes",
        "DESPESAS DE CAPITAL": "despesas_capital",
        "INVESTIMENTOS": "investimentos",
        "INVERSÕES FINANCEIRAS": "inversoes",
        "AMORTIZAÇÃO DA DÍVIDA": "amortizacao",
    }

    for ano in ANOS:
        registros = le_json(RAW_SIC, f"rreo_a01_{ano}")
        if not registros:
            problemas.append(f"RREO-Anexo 01 de {ano} ausente")
            continue

        for prefixo, chave in mapa_receita.items():
            receitas[chave][ano] = _valor_conta(
                registros, prefixo, "ATÉ O BIMESTRE")
        for prefixo, chave in mapa_despesa.items():
            despesas[chave][ano] = _valor_conta(
                registros, prefixo, "ATÉ O BIMESTRE")

        totais[ano] = {
            "receita_total": _valor_conta(registros, "TOTAL", "ATÉ O BIMESTRE"),
            "despesa_total": _valor_conta(registros, "TOTAL (III)", "ATÉ O BIMESTRE"),
        }

    return {
        "receitas": receitas,
        "despesas": despesas,
        "totais": totais,
        "problemas": problemas,
    }


# --------------------------------------------------------------------------
# 4. RREO Anexo 03 — receita por categoria (estrutura da arrecadação)
# --------------------------------------------------------------------------

def processa_receitas_estrutura() -> dict:
    """
    Árvore da receita realizada por categoria, a partir do Anexo 03.
    A DCA-Anexo I-C também traz receitas; usamos o Anexo 03 quando presente.
    """
    por_ano: dict[int, list[dict]] = {}
    problemas: list[str] = []

    for ano in ANOS:
        registros = le_json(RAW_SIC, f"rreo_a03_{ano}")
        if not registros:
            problemas.append(f"RREO-Anexo 03 de {ano} ausente")
            continue

        itens = []
        for r in registros:
            coluna = str(r.get("coluna", ""))
            if "ATÉ O BIMESTRE" not in coluna.upper():
                continue
            v = num(r.get("valor"))
            if v is None:
                continue
            conta = str(r.get("conta", "")).strip()
            if not conta:
                continue
            itens.append({
                "conta": conta,
                "valor": v,
                "coluna": coluna,
            })
        por_ano[ano] = itens

    return {"por_ano": por_ano, "problemas": problemas}


# --------------------------------------------------------------------------
# 5. RGF — pessoal e dívida (limites da LRF)
# --------------------------------------------------------------------------

def processa_rgf() -> dict:
    """
    Despesa com pessoal e dívida consolidada líquida, ambos como % da RCL,
    do RGF-Anexo 01 (poder Executivo) e 05.

    O RGF já publica o percentual em relação à *RCL Ajustada*, na coluna
    '% sobre a RCL Ajustada'. Esse é o número oficial e é o que usamos.
    Também guardamos o valor absoluto da DTP e da RCL, para que o site
    possa mostrar a conta.
    """
    pessoal: dict[int, dict] = {}
    divida: dict[int, dict] = {}
    problemas: list[str] = []

    for ano in ANOS:
        registros = le_json(RAW_SIC, f"rgf_a01_E_{ano}")
        if not registros:
            problemas.append(f"RGF-Anexo 01 de {ano} ausente")
            continue

        dtp_valor = None
        dtp_pct = None
        rcl = None

        for r in registros:
            conta = norm(r.get("conta", ""))
            coluna = str(r.get("coluna", ""))
            v = num(r.get("valor"))
            if v is None:
                continue

            if conta.startswith("despesa total com pessoal"):
                if "%" in coluna:
                    dtp_pct = v
                elif coluna == "Valor":
                    dtp_valor = v
            elif conta.startswith("receita corrente liquida") and coluna == "Valor":
                rcl = v

        pessoal[ano] = {
            "dtp_pct_rcl": arred(dtp_pct),
            "dtp_valor": arred(dtp_valor),
            "rcl": arred(rcl),
            # Limite legal para municípios (LRF, art. 20, III): 54% da RCL.
            "limite": 54.0,
            "alerta": 48.6,   # 90% do limite
            "prudencial": 51.3,  # 95% do limite
        }

    # A Dívida Consolidada Líquida vem do RGF-Anexo 02 (Dívida Consolidada),
    # não do Anexo 05. As colunas são os quadrimestres; usamos o 3º, que é o
    # fechamento do exercício. O percentual sobre a RCL Ajustada aparece em
    # uma linha própria ("% da DCL sobre a RCL AJUSTADA").
    for ano in ANOS:
        registros = le_json(RAW_SIC, f"rgf_a02_E_{ano}")
        if not registros:
            problemas.append(f"RGF-Anexo 02 de {ano} ausente — dívida não apurada")
            divida[ano] = {"dcl_pct_rcl": None, "dcl_valor": None, "limite": 120.0}
            continue

        dcl_valor = None
        dc_valor = None
        dcl_pct = None

        for r in registros:
            conta = norm(r.get("conta", ""))
            coluna = str(r.get("coluna", ""))
            v = num(r.get("valor"))
            if v is None:
                continue
            fechamento = "3" in coluna and "quadrimestre" in coluna.lower()

            if conta.startswith("divida consolidada liquida") and fechamento:
                dcl_valor = v
            elif conta.startswith("divida consolidada ") and fechamento:
                dc_valor = v
            elif "% da dcl" in coluna.lower() and fechamento:
                dcl_pct = v

        # Se o percentual não veio em coluna própria, calcula sobre a RCL.
        if dcl_pct is None and dcl_valor is not None:
            rcl = pessoal.get(ano, {}).get("rcl")
            if rcl:
                dcl_pct = round(dcl_valor / rcl * 100, 2)

        divida[ano] = {
            "dcl_pct_rcl": arred(dcl_pct),
            "dcl_valor": arred(dcl_valor),
            "dc_valor": arred(dc_valor),
            # Limite para municípios (Resolução SF 40/2001): 120% da RCL.
            "limite": 120.0,
        }

    return {"pessoal": pessoal, "divida": divida, "problemas": problemas}


# --------------------------------------------------------------------------
# 6. Portal municipal — pagamentos
# --------------------------------------------------------------------------

def _separa_fornecedor(texto: str) -> tuple[str | None, str]:
    """
    Separa "CNPJ/CPF - NOME" em documento e nome.
    Devolve (documento, nome).
    """
    if not texto:
        return None, ""
    m = re.match(r"^\s*([\d./-]{11,20})\s*-\s*(.+)$", texto)
    if m:
        return re.sub(r"\D", "", m.group(1)), m.group(2).strip()
    return None, texto.strip()


def processa_pagamentos() -> dict:
    """
    Pagamentos efetuados pela Prefeitura e pela Câmara, por ano.

    A API entrega uma linha por ordem bancária. O campo `programatica` vem
    sempre nulo — por isso não é possível amarrar pagamento a subfunção.
    O que dá para apurar: totais, sazonalidade, fornecedores e vínculo
    com licitações.
    """
    resultado: dict[str, dict] = {}
    problemas: list[str] = []

    for entidade, rotulo in ((1, "prefeitura"), (2, "camara")):
        por_ano: dict[int, dict] = {}

        for ano in ANOS + [ANO_CORRENTE]:
            dados = le_json(RAW_BG, f"pagamentos_e{entidade}_{ano}")
            if not dados:
                continue
            linhas = dados.get("content") or []
            if not linhas:
                continue

            total = 0.0
            por_mes = defaultdict(float)
            fornecedores: dict[str, dict] = {}
            restos = 0.0
            n_restos = 0
            liquido_ano = 0.0

            for ln in linhas:
                v = num(ln.get("valor"))
                if v is None:
                    continue
                total += v

                # Data do pagamento; na falta, a data do registro.
                bruto_data = ln.get("dataPagamento") or ln.get("data")
                mes = None
                if bruto_data and len(str(bruto_data)) >= 7:
                    try:
                        mes = int(str(bruto_data)[5:7])
                    except ValueError:
                        mes = None
                if mes:
                    por_mes[mes] += v

                # Pagamentos de exercícios anteriores = restos a pagar.
                ex_liquidacao = ln.get("exercicioLiquidacao")
                if ex_liquidacao and int(ex_liquidacao) < ano:
                    restos += v
                    n_restos += 1
                else:
                    liquido_ano += v

                doc, nome = _separa_fornecedor(ln.get("fornecedor") or "")
                if nome:
                    chave = doc or nome
                    reg = fornecedores.setdefault(chave, {
                        "documento": doc, "nome": nome, "valor": 0.0, "ordens": 0,
                    })
                    reg["valor"] += v
                    reg["ordens"] += 1

            # O próprio município aparece como fornecedor em movimentações
            # internas; exclui do ranking para não distorcer.
            fornecedores = {
                k: v for k, v in fornecedores.items()
                if "MUNICIPIO DE BENTO GONCALVES" not in norm(v["nome"]).upper()
                and "MUNICÍPIO DE BENTO GONÇALVES" not in str(v["nome"]).upper()
            }
            ranking = sorted(fornecedores.values(), key=lambda x: -x["valor"])[:20]
            for f in ranking:
                f["valor"] = arred(f["valor"])

            por_ano[ano] = {
                "total": arred(total),
                "ordens": len(linhas),
                "por_mes": {str(m): arred(v) for m, v in sorted(por_mes.items())},
                "restos_pagar": arred(restos),
                "ordens_restos": n_restos,
                "pagamentos_do_ano": arred(liquido_ano),
                "top_fornecedores": ranking,
                "fornecedores_distintos": len(fornecedores),
            }

        resultado[rotulo] = por_ano

    return {"por_entidade": resultado, "problemas": problemas}


# --------------------------------------------------------------------------
# 7. Portal municipal — licitações e contratos
# --------------------------------------------------------------------------

def processa_compras() -> dict:
    """Licitações e contratos por ano, com os maiores contratados."""
    licitacoes: dict[int, dict] = {}
    contratos: dict[int, dict] = {}
    contratados: dict[str, dict] = {}
    problemas: list[str] = []

    for ano in ANOS + [ANO_CORRENTE]:
        dados = le_json(RAW_BG, f"licitacoes_e1_{ano}")
        if dados and dados.get("content"):
            linhas = dados["content"]
            por_modalidade = defaultdict(int)
            por_situacao = defaultdict(int)
            valor_total = 0.0
            for ln in linhas:
                por_modalidade[str(ln.get("descricao") or "Não informada")] += 1
                por_situacao[str(ln.get("tipoCancelamento") or "Não informada")] += 1
                v = num(ln.get("valorMaximo"))
                if v:
                    valor_total += v
            licitacoes[ano] = {
                "quantidade": len(linhas),
                "por_modalidade": dict(sorted(por_modalidade.items(), key=lambda x: -x[1])),
                "por_situacao": dict(sorted(por_situacao.items(), key=lambda x: -x[1])),
                "valor_estimado": arred(valor_total),
            }

        dados = le_json(RAW_BG, f"contratos_e1_{ano}")
        if dados and dados.get("content"):
            linhas = dados["content"]
            valor_total = 0.0
            for ln in linhas:
                v = num(ln.get("valorContratado")) or num(ln.get("valor"))
                if v is None:
                    continue
                valor_total += v
                doc = re.sub(r"\D", "", str(ln.get("cnpjCpf") or ""))
                nome = str(ln.get("nome") or "").strip()
                if not nome:
                    continue
                chave = doc or nome
                reg = contratados.setdefault(chave, {
                    "documento": doc or None, "nome": nome, "valor": 0.0, "contratos": 0,
                })
                reg["valor"] += v
                reg["contratos"] += 1
            contratos[ano] = {
                "quantidade": len(linhas),
                "valor_total": arred(valor_total),
            }

    ranking = sorted(contratados.values(), key=lambda x: -x["valor"])[:25]
    for c in ranking:
        c["valor"] = arred(c["valor"])

    return {
        "licitacoes": licitacoes,
        "contratos": contratos,
        "maiores_contratados": ranking,
        "problemas": problemas,
    }


# --------------------------------------------------------------------------
# 8. Portal municipal — servidores
# --------------------------------------------------------------------------

def processa_servidores() -> dict:
    """Quadro de servidores por vínculo, remuneração e busca."""
    quadro: dict[str, dict[int, list[dict]]] = {"prefeitura": {}, "camara": {}}
    resumo: dict[str, dict[int, dict]] = {"prefeitura": {}, "camara": {}}
    servidores_ativos: list[dict] = []
    problemas: list[str] = []

    for entidade, rotulo in ((1, "prefeitura"), (2, "camara")):
        for ano in ANOS + [ANO_CORRENTE]:
            rn = le_json(RAW_BG, f"resumonatureza_e{entidade}_{ano}")
            if rn:
                resumo[rotulo][ano] = {
                    str(r.get("natureza")): int(r.get("total") or 0) for r in rn
                }

            dados = le_json(RAW_BG, f"servidores_e{entidade}_{ano}")
            if not dados or not dados.get("content"):
                continue
            linhas = dados["content"]

            # Só o ano corrente alimenta a busca, para não misturar exercícios.
            if ano != ANO_CORRENTE:
                continue

            por_natureza = defaultdict(lambda: {"n": 0, "soma": 0.0, "com_valor": 0})
            for ln in linhas:
                nat = str(ln.get("descricaoNatureza") or "Não informado")
                rem = num(ln.get("remuneracao"))
                reg = por_natureza[nat]
                reg["n"] += 1
                if rem is not None:
                    reg["soma"] += rem
                    reg["com_valor"] += 1

                nome = str(ln.get("nome") or "").strip()
                if not nome:
                    continue
                servidores_ativos.append({
                    "nome": nome,
                    "cargo": str(ln.get("descricaoCargo") or "").strip(),
                    "vinculo": nat,
                    "lotacao": str(ln.get("descricaoLotacao") or "").strip(),
                    "admissao": str(ln.get("dataAdmissao") or "")[:10],
                    "remuneracao": arred(rem),
                    "situacao": str(ln.get("situacao") or "").strip(),
                    "entidade": rotulo,
                })

            quadro[rotulo][ano] = [
                {
                    "natureza": nat,
                    "quantidade": reg["n"],
                    "media": arred(reg["soma"] / reg["com_valor"]) if reg["com_valor"] else None,
                }
                for nat, reg in sorted(por_natureza.items(), key=lambda x: -x[1]["n"])
            ]

    servidores_ativos.sort(key=lambda s: s["nome"])
    return {
        "resumo_natureza": resumo,
        "quadro": quadro,
        "servidores": servidores_ativos,
        "problemas": problemas,
    }


# --------------------------------------------------------------------------
# 9. Portal municipal — painéis mensais
# --------------------------------------------------------------------------

def processa_paineis() -> dict:
    """Séries mensais de arrecadação, empenho, liquidação e pagamento."""
    paineis: dict[str, dict[int, list[dict]]] = defaultdict(dict)
    problemas: list[str] = []

    for nome in ("arrecadacao-despesa", "pessoal", "educacao", "saude"):
        for ano in ANOS + [ANO_CORRENTE]:
            dados = le_json(RAW_BG, f"dash_{nome}_{ano}")
            if not dados or not isinstance(dados, list):
                continue
            linhas = []
            for r in dados:
                mes = r.get("mes")
                if mes is None:
                    continue
                linhas.append({
                    "mes": int(mes),
                    "arrecadado": arred(num(r.get("valorArrecadado"))),
                    "empenhado": arred(num(r.get("valorEmpenhado"))),
                    "liquidado": arred(num(r.get("valorLiquidado"))),
                    "pago": arred(num(r.get("valorPago"))),
                })
            if linhas:
                paineis[nome][ano] = sorted(linhas, key=lambda x: x["mes"])

    # Totais anuais dos painéis escalares (despesa e receita do exercício).
    totais = {"despesa": {}, "receita": {}}
    for nome in ("despesa", "receita"):
        for ano in ANOS + [ANO_CORRENTE]:
            v = le_json(RAW_BG, f"dash_{nome}_{ano}")
            if isinstance(v, (int, float)):
                totais[nome][ano] = arred(float(v))

    return {"series": dict(paineis), "totais": totais, "problemas": problemas}


# --------------------------------------------------------------------------
# 10. Portal municipal — créditos adicionais
# --------------------------------------------------------------------------

def processa_creditos() -> dict:
    """Alterações orçamentárias por ano (créditos suplementares e especiais)."""
    por_ano: dict[int, dict] = {}
    problemas: list[str] = []

    for ano in ANOS + [ANO_CORRENTE]:
        dados = le_json(RAW_BG, f"creditosadicionais_{ano}")
        if not dados or not dados.get("content"):
            continue
        linhas = dados["content"]
        por_natureza = defaultdict(lambda: {"n": 0, "valor": 0.0})
        total = 0.0
        for ln in linhas:
            v = num(ln.get("valor")) or 0.0
            nat = str(ln.get("natureza") or "Não informada")
            por_natureza[nat]["n"] += 1
            por_natureza[nat]["valor"] += v
            total += v
        por_ano[ano] = {
            "quantidade": len(linhas),
            "valor_total": arred(total),
            "por_natureza": {
                k: {"quantidade": v["n"], "valor": arred(v["valor"])}
                for k, v in por_natureza.items()
            },
        }

    return {"por_ano": por_ano, "problemas": problemas}


# --------------------------------------------------------------------------
# 11. Portal municipal — obras e convênios
# --------------------------------------------------------------------------

def processa_obras_convenios() -> dict:
    """Obras em andamento e convênios firmados."""
    obras = le_json(RAW_BG, "obras_todas")
    convenios = le_json(RAW_BG, "convenios_todos")

    lista_obras = []
    if obras and obras.get("content"):
        for ln in obras["content"]:
            lista_obras.append({
                "descricao": str(ln.get("descricao") or "")[:220],
                "exercicio": ln.get("exercicio"),
                "ordem": ln.get("ordemServico"),
                "valor": arred(num(ln.get("valor"))),
                "situacao": ln.get("situacao"),
                "bairro": ln.get("bairro"),
            })

    lista_convenios = []
    if convenios and convenios.get("content"):
        for ln in convenios["content"]:
            lista_convenios.append({
                "numero": ln.get("nrConvenio"),
                "ano": ln.get("nrAnoConvenio"),
                "celebracao": str(ln.get("dataCelebracao") or "")[:10],
                "fim_vigencia": str(ln.get("dataFimVigencia") or "")[:10],
                "valor": arred(num(ln.get("valor")) or num(ln.get("valorConvenio"))),
                "objeto": str(ln.get("objeto") or "")[:220],
                "situacao": ln.get("situacao"),
            })

    return {"obras": lista_obras, "convenios": lista_convenios}


# --------------------------------------------------------------------------
# 12. Indicadores derivados
# --------------------------------------------------------------------------

def calcula_indicadores(
    anexo02: dict,
    balanco: dict,
    rgf: dict,
    paineis: dict,
    pagamentos: dict,
) -> dict:
    """Indicadores de saúde fiscal, calculados a partir do que foi apurado."""
    populacao = {}
    for ano in ANOS:
        # A população vem do próprio SICONFI (campo do RREO).
        registros = le_json(RAW_SIC, f"rreo_a02_{ano}")
        if registros:
            p = registros[0].get("populacao")
            if p:
                populacao[ano] = int(p)

    liquidado = {}
    for ano in ANOS:
        t = anexo02["totais"].get(ano) or {}
        liquidado[ano] = t.get("liquidado")

    receita = {}
    for ano in ANOS:
        t = balanco["totais"].get(ano) or {}
        receita[ano] = t.get("receita_total")
        if receita[ano] is None:
            receita[ano] = paineis["totais"]["receita"].get(ano)

    per_capita = {}
    for ano in ANOS:
        if liquidado.get(ano) and populacao.get(ano):
            per_capita[ano] = round(liquidado[ano] / populacao[ano], 2)

    # Pisos constitucionais (aproximação): despesa liquidada na função
    # dividida pela receita de impostos e transferências.
    pisos = {}
    for ano in ANOS:
        saude = next((f for f in anexo02["funcoes"] if f["cod"] == 10), None)
        educacao = next((f for f in anexo02["funcoes"] if f["cod"] == 12), None)
        base = soma([
            balanco["receitas"]["receitas_tributarias"].get(ano),
            balanco["receitas"]["receitas_transferencias"].get(ano),
        ]) or None
        pisos[ano] = {
            "saude_liquidado": arred((saude or {}).get("valores", {}).get(ano, {}).get("liquidado")),
            "educacao_liquidado": arred((educacao or {}).get("valores", {}).get(ano, {}).get("liquidado")),
            "base_calculo": arred(base),
            "saude_pct": pct(
                (saude or {}).get("valores", {}).get(ano, {}).get("liquidado"), base),
            "educacao_pct": pct(
                (educacao or {}).get("valores", {}).get(ano, {}).get("liquidado"), base),
        }

    return {
        "populacao": populacao,
        "liquidado": liquidado,
        "receita": receita,
        "per_capita": per_capita,
        "pisos": pisos,
        "pessoal_rcl": rgf["pessoal"],
        "divida_rcl": rgf["divida"],
    }


# --------------------------------------------------------------------------
# orquestração
# --------------------------------------------------------------------------

def principal() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--verboso", action="store_true")
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)

    print("Processando RREO-Anexo 02 (despesa por função e subfunção)...")
    anexo02 = processa_anexo02(verboso=args.verboso)
    print(f"  {len(anexo02['funcoes'])} funções, {len(anexo02['subfuncoes'])} subfunções")

    print("Processando DCA-Anexo I-E (despesa paga)...")
    dca = processa_dca(anexo02)
    print(f"  {dca['casados']} valores de pago anexados")

    print("Processando créditos adicionais — natureza × subfunção...")
    creditos_natureza = processa_creditos_natureza(anexo02)
    print(f"  {creditos_natureza['anexados']} valores de natureza anexados")

    print("Processando RREO-Anexo 01 (balanço orçamentário)...")
    balanco = processa_balanco()

    print("Processando RREO-Anexo 03 (estrutura da receita)...")
    receitas_estrutura = processa_receitas_estrutura()

    print("Processando RGF (pessoal e dívida)...")
    rgf = processa_rgf()

    print("Processando pagamentos do portal municipal...")
    pagamentos = processa_pagamentos()
    n_pag = sum(len(v) for v in pagamentos["por_entidade"].values())
    print(f"  {n_pag} exercícios com pagamentos")

    print("Processando licitações e contratos...")
    compras = processa_compras()
    print(f"  {len(compras['licitacoes'])} exercícios com licitações, "
          f"{len(compras['maiores_contratados'])} contratados no ranking")

    print("Processando servidores...")
    servidores = processa_servidores()
    print(f"  {len(servidores['servidores'])} servidores no cadastro corrente")

    print("Processando painéis mensais...")
    paineis = processa_paineis()

    print("Processando créditos adicionais...")
    creditos = processa_creditos()

    print("Processando obras e convênios...")
    obras_convenios = processa_obras_convenios()
    print(f"  {len(obras_convenios['obras'])} obras, "
          f"{len(obras_convenios['convenios'])} convênios")

    print("Calculando indicadores...")
    indicadores = calcula_indicadores(anexo02, balanco, rgf, paineis, pagamentos)

    # Coleta todos os problemas relatados pelas etapas.
    problemas: list[str] = []
    for bloco in (anexo02, dca, creditos_natureza, balanco, receitas_estrutura,
                  rgf, pagamentos, compras, servidores, paineis, creditos):
        problemas.extend(bloco.get("problemas") or [])

    pacote = {
        "meta": {
            "municipio": MUNICIPIO,
            "uf": UF,
            "ibge": IBGE,
            "anos": ANOS,
            "ano_corrente": ANO_CORRENTE,
            "gerado_em": date.today().isoformat(),
            "fontes": [
                "SICONFI / Tesouro Nacional (RREO, RGF, DCA)",
                f"Portal de Transparência de {MUNICIPIO} (API {PORTAL_CFG.get('provider', 'ELO Tech')})",
            ],
            "populacao": indicadores["populacao"],
            "portal": {
                "provider": PORTAL_CFG.get("provider"),
                "baseUrl": PORTAL_CFG.get("baseUrl"),
                "entidade": PORTAL_CFG.get("entidade"),
            },
            "config": CFG,
        },
        "execucao": {
            "funcoes": anexo02["funcoes"],
            "subfuncoes": anexo02["subfuncoes"],
            "totais": anexo02["totais"],
            "auditoria": anexo02["auditoria"],
        },
        "balanco": balanco,
        "receitas": receitas_estrutura,
        "fiscal": rgf,
        "pagamentos": pagamentos,
        "compras": compras,
        "servidores": servidores,
        "paineis": paineis,
        "creditos": creditos,
        "creditos_natureza": creditos_natureza,
        "obras_convenios": obras_convenios,
        "indicadores": indicadores,
        "problemas": problemas,
    }

    destino = os.path.join(OUT, "dados.json")
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(pacote, f, ensure_ascii=False, separators=(",", ":"))

    # Cópia para o servidor estático do site.
    os.makedirs(PUBLIC_WEB, exist_ok=True)
    copia = os.path.join(PUBLIC_WEB, "dados.json")
    with open(copia, "w", encoding="utf-8") as f:
        json.dump(pacote, f, ensure_ascii=False, separators=(",", ":"))

    tamanho = os.path.getsize(destino) / 1e6
    print(f"\n{'=' * 70}")
    print(f"Gerado: {destino} ({tamanho:.1f} MB)")
    print(f"Cópia:  {copia}")
    print(f"Funções: {len(anexo02['funcoes'])} | "
          f"Subfunções: {len(anexo02['subfuncoes'])} | "
          f"Servidores: {len(servidores['servidores'])}")
    if problemas:
        print(f"\n{len(problemas)} observação(ões):")
        for p in problemas[:20]:
            print(f"  - {p}")
        if len(problemas) > 20:
            print(f"  ... e mais {len(problemas) - 20}")
    else:
        print("Nenhuma observação — todos os anexos fecharam.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
