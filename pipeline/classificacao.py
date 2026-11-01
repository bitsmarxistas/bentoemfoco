# -*- coding: utf-8 -*-
"""
Tabelas oficiais de classificação orçamentária brasileira.

Funções e subfunções conforme a Portaria MOG 42/1999 e suas atualizações
(Portarias 573/2016, 221/2023, 169/2024). O RREO-Anexo 02 do SICONFI não
traz os códigos numéricos: traz apenas os nomes, na ordem do relatório.
Estas tabelas são o que permite reconstruir os códigos a partir dos nomes.
"""
from __future__ import annotations

import re
import unicodedata

# (código, nome oficial)
FUNCOES: list[tuple[int, str]] = [
    (1, "Legislativa"),
    (2, "Judiciária"),
    (3, "Essencial à Justiça"),
    (4, "Administração"),
    (5, "Defesa Nacional"),
    (6, "Segurança Pública"),
    (7, "Relações Exteriores"),
    (8, "Assistência Social"),
    (9, "Previdência Social"),
    (10, "Saúde"),
    (11, "Trabalho"),
    (12, "Educação"),
    (13, "Cultura"),
    (14, "Direitos da Cidadania"),
    (15, "Urbanismo"),
    (16, "Habitação"),
    (17, "Saneamento"),
    (18, "Gestão Ambiental"),
    (19, "Ciência e Tecnologia"),
    (20, "Agricultura"),
    (21, "Organização Agrária"),
    (22, "Indústria"),
    (23, "Comércio e Serviços"),
    (24, "Comunicações"),
    (25, "Energia"),
    (26, "Transporte"),
    (27, "Desporto e Lazer"),
    (28, "Encargos Especiais"),
    (99, "Reserva do Contingência"),
]

SUBFUNCOES: list[tuple[int, str]] = [
    (31, "Ação Legislativa"),
    (32, "Controle Externo"),
    (61, "Ação Judiciária"),
    (62, "Defesa do Interesse Público no Processo Judiciário"),
    (91, "Defesa da Ordem Jurídica"),
    (92, "Representação Judicial e Extrajudicial"),
    (121, "Planejamento e Orçamento"),
    (122, "Administração Geral"),
    (123, "Administração Financeira"),
    (124, "Controle Interno"),
    (125, "Normatização e Fiscalização"),
    (126, "Tecnologia da Informação"),
    (127, "Ordenamento Territorial"),
    (128, "Formação de Recursos Humanos"),
    (129, "Administração de Receitas"),
    (130, "Administração de Concessões"),
    (131, "Comunicação Social"),
    (151, "Defesa Aérea"),
    (152, "Defesa Naval"),
    (153, "Defesa Terrestre"),
    (181, "Policiamento"),
    (182, "Defesa Civil"),
    (183, "Informação e Inteligência"),
    (211, "Relações Diplomáticas"),
    (212, "Cooperação Internacional"),
    (241, "Assistência ao Idoso"),
    (242, "Assistência à Pessoa com Deficiência"),
    (243, "Assistência à Criança e ao Adolescente"),
    (244, "Assistência Comunitária"),
    (245, "Serviços Socioassistenciais"),
    (271, "Previdência Básica"),
    (272, "Previdência do Regime Estatutário"),
    (273, "Previdência Complementar"),
    (274, "Previdência Especial"),
    (301, "Atenção Básica"),
    (302, "Assistência Hospitalar e Ambulatorial"),
    (303, "Suporte Profilático e Terapêutico"),
    (304, "Vigilância Sanitária"),
    (305, "Vigilância Epidemiológica"),
    (306, "Alimentação e Nutrição"),
    (331, "Proteção e Benefícios ao Trabalhador"),
    (332, "Relações de Trabalho"),
    (333, "Empregabilidade"),
    (334, "Fomento ao Trabalho"),
    (361, "Ensino Fundamental"),
    (362, "Ensino Médio"),
    (363, "Ensino Profissional"),
    (364, "Ensino Superior"),
    (365, "Educação Infantil"),
    (366, "Educação de Jovens e Adultos"),
    (367, "Educação Especial"),
    (368, "Educação Básica"),
    (391, "Patrimônio Histórico, Artístico e Arqueológico"),
    (392, "Difusão Cultural"),
    (421, "Custódia e Reintegração Social"),
    (422, "Direitos Individuais, Coletivos e Difusos"),
    (423, "Assistência aos Povos Indígenas"),
    (451, "Infra-Estrutura Urbana"),
    (452, "Serviços Urbanos"),
    (453, "Transportes Coletivos Urbanos"),
    (481, "Habitação Rural"),
    (482, "Habitação Urbana"),
    (511, "Saneamento Básico Rural"),
    (512, "Saneamento Básico Urbano"),
    (541, "Preservação e Conservação Ambiental"),
    (542, "Controle Ambiental"),
    (543, "Recuperação de Áreas Degradadas"),
    (544, "Recursos Hídricos"),
    (545, "Meteorologia"),
    (571, "Desenvolvimento Científico"),
    (572, "Desenvolvimento Tecnológico e Engenharia"),
    (573, "Difusão do Conhecimento Científico e Tecnológico"),
    (601, "Promoção da Produção Vegetal"),
    (602, "Promoção da Produção Animal"),
    (603, "Defesa Sanitária Vegetal"),
    (604, "Defesa Sanitária Animal"),
    (605, "Abastecimento"),
    (606, "Extensão Rural"),
    (607, "Irrigação"),
    (631, "Reforma Agrária"),
    (632, "Colonização"),
    (661, "Promoção Industrial"),
    (662, "Produção Industrial"),
    (663, "Mineração"),
    (664, "Propriedade Industrial"),
    (665, "Normalização e Qualidade"),
    (691, "Promoção Comercial"),
    (692, "Comercialização"),
    (693, "Comércio Exterior"),
    (694, "Serviços Financeiros"),
    (695, "Turismo"),
    (721, "Comunicações Postais"),
    (722, "Telecomunicações"),
    (751, "Conservação de Energia"),
    (752, "Energia Elétrica"),
    (753, "Combustíveis Minerais"),
    (754, "Biocombustíveis"),
    (781, "Transporte Aéreo"),
    (782, "Transporte Rodoviário"),
    (783, "Transporte Ferroviário"),
    (784, "Transporte Hidroviário"),
    (785, "Transportes Especiais"),
    (811, "Desporto de Rendimento"),
    (812, "Desporto Comunitário"),
    (813, "Lazer"),
    (841, "Refinanciamento da Dívida Interna"),
    (842, "Refinanciamento da Dívida Externa"),
    (843, "Serviço da Dívida Interna"),
    (844, "Serviço da Dívida Externa"),
    (845, "Outras Transferências"),
    (846, "Outros Encargos Especiais"),
    (847, "Transferências para a Educação Básica"),
]


def normaliza(s: object) -> str:
    """Normaliza um nome para comparação: sem acento, minúsculo, sem pontuação."""
    texto = unicodedata.normalize("NFD", str(s))
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    texto = texto.casefold().replace(",", "").replace("-", " ")
    return re.sub(r"\s+", " ", texto).strip()


# Índices de busca por nome normalizado.
POR_FUNCAO: dict[str, tuple[int, str]] = {normaliza(n): (c, n) for c, n in FUNCOES}
POR_SUBFUNCAO: dict[str, tuple[int, str]] = {normaliza(n): (c, n) for c, n in SUBFUNCOES}

# Variantes de nome que o município usa e que diferem do texto oficial.
POR_FUNCAO[normaliza("Reserva de Contingência")] = (99, "Reserva do Contingência")
POR_SUBFUNCAO[normaliza("Assistência ao Portador de Deficiência")] = (
    242, "Assistência à Pessoa com Deficiência")
POR_SUBFUNCAO[normaliza("Transferências")] = (845, "Outras Transferências")
POR_SUBFUNCAO[normaliza("Administracao de Concessões")] = (130, "Administração de Concessões")

# O RREO agrupa as subfunções menores de uma função numa linha residual.
# Ex.: "FU04 - Demais Subfunções". Código 0 marca esse agregado.
COD_AGREGADO = 0
NOME_AGREGADO = "Demais Subfunções"

# Nome da função como aparece prefixado nas linhas residuais: "FU04 - ..."
PREFIXO_FUNCAO = re.compile(r"^FU(\d{2})\s*-\s*(.+)$")

# Controles de seção do Anexo 02.
CONTROLES = {
    "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)": "TOTAL_I",
    "DESPESAS (INTRA-ORÇAMENTÁRIAS) (II)": "TOTAL_II",
    "TOTAL (III) = (I + II)": "TOTAL_III",
}

# Colunas monetárias do Anexo 02, mapeadas para chaves estáveis.
COLUNAS_ANEXO02 = {
    "DOTAÇÃO INICIAL": "dotacao_inicial",
    "DOTAÇÃO ATUALIZADA (a)": "dotacao_atualizada",
    "DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)": "empenhado",
    "DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)": "liquidado",
    "INSCRITAS EM RESTOS A PAGAR NÃO PROCESSADOS (f)": "restos_inscritos",
}

# Seções do Anexo 02.
SECOES_ANEXO02 = [
    ("RREO2TotalDespesas", "I"),
    ("RREO2TotalDespesasIntra", "II"),
]


def rotulo_funcao(cod: int) -> str:
    for c, n in FUNCOES:
        if c == cod:
            return f"{cod:02d} - {n}"
    return f"{cod:02d}"


def rotulo_subfuncao(cod: int) -> str:
    if cod == COD_AGREGADO:
        return NOME_AGREGADO
    for c, n in SUBFUNCOES:
        if c == cod:
            return f"{cod:03d} - {n}"
    return f"{cod:03d}"


# Nomes das funções por código, para uso direto.
NOME_FUNCAO = dict(FUNCOES)
NOME_SUBFUNCAO = dict(SUBFUNCOES)
