/**
 * Cálculos derivados sobre o pacote de dados.
 *
 * Ficam aqui, e não nos componentes, para poderem ser testados e para que
 * dois gráficos que precisem da mesma série não a calculem de dois jeitos.
 */

import type { Dados, Funcao, Subfuncao, ValoresDespesa } from '../tipos';

/** Lê um valor de uma série, tratando ausência como null. */
export function valor(v: ValoresDespesa | undefined, campo: keyof ValoresDespesa): number | null {
  const x = v?.[campo];
  return x === undefined || x === null || Number.isNaN(x) ? null : x;
}

/** Soma uma série de valores ignorando ausências. */
export function soma(serie: (number | null | undefined)[]): number {
  return serie.reduce<number>((acc, x) => (x === null || x === undefined ? acc : acc + x), 0);
}

/** Total liquidado de um exercício. */
export function totalLiquidado(d: Dados, ano: number): number | null {
  return valor(d.execucao.totais[String(ano)], 'liquidado');
}

/** Total empenhado de um exercício. */
export function totalEmpenhado(d: Dados, ano: number): number | null {
  return valor(d.execucao.totais[String(ano)], 'empenhado');
}

/** Total pago de um exercício, somando as funções (o total do RREO não traz pago). */
export function totalPago(d: Dados, ano: number): number | null {
  const pago = soma(d.execucao.funcoes.map((f) => valor(f.valores[String(ano)], 'pago')));
  return pago || null;
}

/** Acumulado de uma função no período. */
export function acumuladoFuncao(f: Funcao, anos: number[], campo: keyof ValoresDespesa = 'liquidado'): number {
  return soma(anos.map((a) => valor(f.valores[String(a)], campo)));
}

/** Acumulado de uma subfunção no período. */
export function acumuladoSubfuncao(s: Subfuncao, anos: number[], campo: keyof ValoresDespesa = 'liquidado'): number {
  return soma(anos.map((a) => valor(s.valores[String(a)], campo)));
}

/** Ranking de funções por um campo, no acumulado do período. */
export function rankingFuncoes(
  d: Dados,
  campo: keyof ValoresDespesa = 'liquidado',
): { funcao: Funcao; total: number }[] {
  const anos = d.meta.anos;
  return d.execucao.funcoes
    .map((funcao) => ({ funcao, total: acumuladoFuncao(funcao, anos, campo) }))
    .sort((a, b) => b.total - a.total);
}

/** Ranking de subfunções por um campo, no acumulado do período. */
export function rankingSubfuncoes(
  d: Dados,
  campo: keyof ValoresDespesa = 'liquidado',
): { subfuncao: Subfuncao; total: number }[] {
  const anos = d.meta.anos;
  return d.execucao.subfuncoes
    .map((subfuncao) => ({ subfuncao, total: acumuladoSubfuncao(subfuncao, anos, campo) }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Taxa de crescimento anual composta entre o primeiro e o último ano
 * com dado disponível.
 */
export function cagr(
  inicio: number | null,
  fim: number | null,
  periodos: number,
): number | null {
  if (!inicio || !fim || inicio <= 0 || fim <= 0 || periodos <= 0) return null;
  return (Math.pow(fim / inicio, 1 / periodos) - 1) * 100;
}

/** Variação percentual entre dois valores. */
export function variacao(a: number | null, b: number | null): number | null {
  if (a === null || b === null || a === 0) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

/** Concentração: quanto do total os N maiores representam. */
export function concentracao(valores: number[], n: number): number {
  const total = soma(valores);
  if (!total) return 0;
  const ordenados = [...valores].sort((a, b) => b - a).slice(0, n);
  return (soma(ordenados) / total) * 100;
}

/**
 * Quantos itens são necessários para cobrir `alvo` por cento do total.
 * Usado no Pareto.
 */
export function quantosParaCobrir(valores: number[], alvo: number): number {
  const total = soma(valores);
  if (!total) return 0;
  const ordenados = [...valores].sort((a, b) => b - a);
  let acumulado = 0;
  for (let i = 0; i < ordenados.length; i++) {
    acumulado += ordenados[i] ?? 0;
    if ((acumulado / total) * 100 >= alvo) return i + 1;
  }
  return ordenados.length;
}

/** Série anual de uma função. */
export function serieFuncao(
  f: Funcao,
  anos: number[],
  campo: keyof ValoresDespesa = 'liquidado',
): (number | null)[] {
  return anos.map((a) => valor(f.valores[String(a)], campo));
}

/** Série anual do total. */
export function serieTotal(
  d: Dados,
  anos: number[],
  campo: keyof ValoresDespesa = 'liquidado',
): (number | null)[] {
  return anos.map((a) => valor(d.execucao.totais[String(a)], campo));
}

/** Série anual de uma receita ou despesa do balanço. */
export function serieBalanco(
  d: Dados,
  grupo: 'receitas' | 'despesas',
  chave: string,
  anos: number[],
): (number | null)[] {
  const serie = d.balanco[grupo][chave];
  if (!serie) return anos.map(() => null);
  return anos.map((a) => {
    const v = serie[String(a)];
    return v === undefined || v === null ? null : v;
  });
}

/** Ano mais recente com dado para uma função. */
export function ultimoAnoComDado(f: Funcao, anos: number[]): number | null {
  for (let i = anos.length - 1; i >= 0; i--) {
    const a = anos[i];
    if (a !== undefined && valor(f.valores[String(a)], 'liquidado') !== null) return a;
  }
  return null;
}
