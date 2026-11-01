/**
 * Blocos de interface reutilizáveis.
 *
 * São pequenos de propósito: cada um resolve uma coisa só, para que os
 * componentes de seção fiquem legíveis.
 */

import type { ReactNode } from 'react';

import { reaisCompacto, variacao as fmtVariacao } from '../lib/formato';

/* ------------------------------------------------------------------ */
/* KPI                                                                 */
/* ------------------------------------------------------------------ */

export interface KpiProps {
  rotulo: string;
  valor: ReactNode;
  nota?: ReactNode;
  /** Variação percentual para colorir o cartão. */
  variacao?: number | null;
  destaque?: boolean;
}

export function Kpi({ rotulo, valor, nota, variacao, destaque }: KpiProps) {
  const sinal = variacao === null || variacao === undefined ? null : variacao;
  const classeVariacao =
    sinal === null ? '' : sinal > 0 ? 'text-positivo' : sinal < 0 ? 'text-negativo' : 'text-texto-3';

  return (
    <div className={`kpi ${destaque ? 'ring-1 ring-acento' : ''}`}>
      <div className="kpi-rotulo">{rotulo}</div>
      <div className="kpi-valor">{valor}</div>
      {sinal !== null && (
        <div className={`mt-0.5 font-mono text-xs ${classeVariacao}`}>
          {fmtVariacao(sinal)} vs. ano anterior
        </div>
      )}
      {nota && <div className="kpi-nota">{nota}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seção                                                               */
/* ------------------------------------------------------------------ */

export interface SecaoProps {
  id: string;
  numero?: string;
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Secao({ id, numero, titulo, descricao, children, className = '' }: SecaoProps) {
  return (
    <section id={id} className={`secao ${className}`}>
      <div className="wrap">
        {numero && <p className="eyebrow">{numero}</p>}
        <h2 className="titulo-secao">{titulo}</h2>
        {descricao && <p className="subtitulo-secao">{descricao}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cartão com título                                                   */
/* ------------------------------------------------------------------ */

export interface CartaoTituloProps {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CartaoTitulo({ titulo, descricao, acoes, children, className = '' }: CartaoTituloProps) {
  return (
    <div className={`cartao-pad ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-base font-semibold">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-xs text-texto-3">{descricao}</p>}
        </div>
        {acoes && <div className="flex shrink-0 items-center gap-1.5">{acoes}</div>}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alternador de exercício                                             */
/* ------------------------------------------------------------------ */

export interface SeletorAnoProps {
  anos: number[];
  valor: number;
  aoMudar: (ano: number) => void;
  rotulo?: string;
}

export function SeletorAno({ anos, valor, aoMudar, rotulo = 'Exercício' }: SeletorAnoProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs font-semibold uppercase tracking-wider text-texto-3">
        {rotulo}
      </span>
      <div className="flex gap-1" role="group" aria-label={rotulo}>
        {anos.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => aoMudar(a)}
            aria-pressed={a === valor}
            className={`botao px-2.5 py-1 font-mono text-xs ${a === valor ? 'botao-ativo' : ''}`}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alternador de métrica                                               */
/* ------------------------------------------------------------------ */

export interface OpcaoMetrica<T extends string> {
  valor: T;
  rotulo: string;
}

export interface SeletorMetricaProps<T extends string> {
  opcoes: OpcaoMetrica<T>[];
  valor: T;
  aoMudar: (v: T) => void;
  rotulo?: string;
}

export function SeletorMetrica<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: SeletorMetricaProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {rotulo && (
        <span className="text-2xs font-semibold uppercase tracking-wider text-texto-3">
          {rotulo}
        </span>
      )}
      <div className="flex flex-wrap gap-1" role="group" aria-label={rotulo}>
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => aoMudar(o.valor)}
            aria-pressed={o.valor === valor}
            className={`botao px-2.5 py-1 text-xs ${o.valor === valor ? 'botao-ativo' : ''}`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Nota de rodapé do gráfico                                           */
/* ------------------------------------------------------------------ */

export function NotaGrafico({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-texto-3">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Lista de destaques                                                  */
/* ------------------------------------------------------------------ */

export interface Destaque {
  titulo: string;
  texto: string;
  tom?: 'positivo' | 'negativo' | 'alerta' | 'neutro';
}

export function ListaDestaques({ itens }: { itens: Destaque[] }) {
  const cor = {
    positivo: 'border-l-positivo',
    negativo: 'border-l-negativo',
    alerta: 'border-l-alerta',
    neutro: 'border-l-borda-forte',
  };

  return (
    <ul className="space-y-2.5">
      {itens.map((d, i) => (
        <li
          key={i}
          className={`border-l-2 pl-3 ${cor[d.tom ?? 'neutro']}`}
        >
          <p className="text-[13px] font-medium leading-snug">{d.titulo}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-texto-2">{d.texto}</p>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Valor compacto em linha                                             */
/* ------------------------------------------------------------------ */

export function ValorCompacto({ v, casas = 1 }: { v: number | null; casas?: number }) {
  return <span className="font-mono tabular-nums">{reaisCompacto(v, casas)}</span>;
}
