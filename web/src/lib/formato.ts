/**
 * Formatação de números e datas, em pt-BR.
 *
 * Regra do projeto: valor ausente nunca vira "0". Vira "—". Mostrar zero
 * onde não há dado é afirmar algo falso sobre a execução orçamentária.
 */

const NULO = '—';

/** Reais compactos: R$ 1,2 mi, R$ 767,9 mi, R$ 1,03 bi. */
export function reaisCompacto(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return NULO;
  const abs = Math.abs(v);
  if (abs >= 1e9) return `R$ ${(v / 1e9).toFixed(casas).replace('.', ',')} bi`;
  if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(casas).replace('.', ',')} mi`;
  if (abs >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} mil`;
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

/** Reais por extenso, com separador de milhar. */
export function reais(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return NULO;
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Percentual com vírgula decimal. */
export function porcento(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return NULO;
  return `${v.toFixed(casas).replace('.', ',')}%`;
}

/** Número inteiro com separador de milhar. */
export function inteiro(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return NULO;
  return v.toLocaleString('pt-BR');
}

/** Variação com sinal explícito. */
export function variacao(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return NULO;
  const sinal = v > 0 ? '+' : '';
  return `${sinal}${v.toFixed(casas).replace('.', ',')}%`;
}

/** Data ISO (AAAA-MM-DD) para DD/MM/AAAA. */
export function data(iso: string | null | undefined): string {
  if (!iso) return NULO;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Nome do mês a partir do número 1..12. */
export const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
] as const;

/** Abrevia um nome longo de conta, preservando o começo. */
export function encurta(s: string, max = 44): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Primeira letra maiúscula, resto preservado. */
export function capitaliza(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
