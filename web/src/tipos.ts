/**
 * Tipos do pacote de dados gerado por `pipeline/processa.py`.
 *
 * O JSON é a única fonte de verdade: nada aqui é inventado. Onde um valor
 * pode faltar, o tipo diz `| null` — e a interface trata a ausência em vez
 * de exibir zero, que seria mentira.
 */

/** Série anual: chave é o ano em string, valor pode faltar. */
export type SerieAnual = Record<string, number | null>;

export interface ValoresDespesa {
  dotacao_inicial?: number | null;
  dotacao_atualizada?: number | null;
  empenhado?: number | null;
  liquidado?: number | null;
  restos_inscritos?: number | null;
  pago?: number | null;
}

export interface Funcao {
  cod: number;
  nome: string;
  rotulo: string;
  valores: Record<string, ValoresDespesa>;
}

export interface Subfuncao {
  cod_funcao: number;
  nome_funcao: string;
  cod: number;
  nome: string;
  rotulo: string;
  valores: Record<string, ValoresDespesa>;
}

export interface Auditoria {
  ano: number;
  registros: number;
  funcoes: number;
  subfuncoes: number;
  total_liquidado: number | null;
  soma_subfuncoes: number | null;
  divergencia: number | null;
}

export interface Execucao {
  funcoes: Funcao[];
  subfuncoes: Subfuncao[];
  totais: Record<string, ValoresDespesa>;
  auditoria: Auditoria[];
}

export interface Balanco {
  receitas: Record<string, SerieAnual>;
  despesas: Record<string, SerieAnual>;
  totais: Record<string, { receita_total: number | null; despesa_total: number | null }>;
  problemas: string[];
}

export interface ItemReceita {
  conta: string;
  valor: number;
  coluna: string;
}

export interface Receitas {
  por_ano: Record<string, ItemReceita[]>;
  problemas: string[];
}

export interface Fiscal {
  pessoal: Record<string, {
    dtp_pct_rcl: number | null;
    dtp_valor: number | null;
    rcl: number | null;
    limite: number;
    alerta: number;
    prudencial: number;
  }>;
  divida: Record<string, {
    dcl_pct_rcl: number | null;
    dcl_valor: number | null;
    limite: number;
  }>;
  problemas: string[];
}

export interface Fornecedor {
  documento: string | null;
  nome: string;
  valor: number;
  ordens: number;
}

export interface PagamentoAno {
  total: number | null;
  ordens: number;
  por_mes: Record<string, number>;
  restos_pagar: number | null;
  ordens_restos: number;
  pagamentos_do_ano: number | null;
  top_fornecedores: Fornecedor[];
  fornecedores_distintos: number;
}

export interface Pagamentos {
  por_entidade: Record<string, Record<string, PagamentoAno>>;
  problemas: string[];
}

export interface Contratado {
  documento: string | null;
  nome: string;
  valor: number;
  contratos: number;
}

export interface Compras {
  licitacoes: Record<string, {
    quantidade: number;
    por_modalidade: Record<string, number>;
    por_situacao: Record<string, number>;
    valor_estimado: number | null;
  }>;
  contratos: Record<string, { quantidade: number; valor_total: number | null }>;
  maiores_contratados: Contratado[];
  problemas: string[];
}

export interface Servidor {
  nome: string;
  cargo: string;
  vinculo: string;
  lotacao: string;
  admissao: string;
  remuneracao: number | null;
  situacao: string;
  entidade: string;
}

export interface Servidores {
  resumo_natureza: Record<string, Record<string, Record<string, number>>>;
  quadro: Record<string, Record<string, { natureza: string; quantidade: number; media: number | null }[]>>;
  servidores: Servidor[];
  problemas: string[];
}

export interface LinhaPainel {
  mes: number;
  arrecadado: number | null;
  empenhado: number | null;
  liquidado: number | null;
  pago: number | null;
}

export interface Paineis {
  series: Record<string, Record<string, LinhaPainel[]>>;
  totais: Record<string, Record<string, number>>;
  problemas: string[];
}

export interface Creditos {
  por_ano: Record<string, {
    quantidade: number;
    valor_total: number | null;
    por_natureza: Record<string, { quantidade: number; valor: number | null }>;
  }>;
  problemas: string[];
}

export interface Obra {
  descricao: string;
  exercicio: number | null;
  ordem: number | null;
  valor: number | null;
  situacao: string | null;
  bairro: string | null;
}

export interface Convenio {
  numero: string | number | null;
  ano: number | null;
  celebracao: string;
  fim_vigencia: string;
  valor: number | null;
  objeto: string;
  situacao: string | null;
}

export interface ObrasConvenios {
  obras: Obra[];
  convenios: Convenio[];
}

export interface Indicadores {
  populacao: Record<string, number>;
  liquidado: SerieAnual;
  receita: SerieAnual;
  per_capita: SerieAnual;
  pisos: Record<string, {
    saude_liquidado: number | null;
    educacao_liquidado: number | null;
    base_calculo: number | null;
    saude_pct: number | null;
    educacao_pct: number | null;
  }>;
  pessoal_rcl: Fiscal['pessoal'];
  divida_rcl: Fiscal['divida'];
}

export interface Meta {
  municipio: string;
  uf: string;
  ibge: number;
  anos: number[];
  ano_corrente: number;
  gerado_em: string;
  fontes: string[];
  populacao: Record<string, number>;
}

export interface Dados {
  meta: Meta;
  execucao: Execucao;
  balanco: Balanco;
  receitas: Receitas;
  fiscal: Fiscal;
  pagamentos: Pagamentos;
  compras: Compras;
  servidores: Servidores;
  paineis: Paineis;
  creditos: Creditos;
  obras_convenios: ObrasConvenios;
  indicadores: Indicadores;
  problemas: string[];
}
