/**
 * Acesso aos dados.
 *
 * O pacote é um JSON estático gerado pelo pipeline Python. É carregado uma
 * vez, no início, e guardado em memória — não há refetch nem estado de
 * servidor, então uma promessa memoizada basta.
 */

import type { Dados } from '../tipos';

let cache: Dados | null = null;
let emAndamento: Promise<Dados> | null = null;

/** Carrega o pacote de dados. Chamadas concorrentes compartilham a mesma requisição. */
export function carregaDados(): Promise<Dados> {
  if (cache) return Promise.resolve(cache);
  if (emAndamento) return emAndamento;

  emAndamento = fetch('/dados.json')
    .then((r) => {
      if (!r.ok) throw new Error(`Falha ao carregar dados.json (HTTP ${r.status})`);
      return r.json() as Promise<Dados>;
    })
    .then((d) => {
      cache = d;
      emAndamento = null;
      return d;
    })
    .catch((e: unknown) => {
      emAndamento = null;
      throw e;
    });

  return emAndamento;
}

/** Acesso síncrono ao pacote já carregado. Lança se ainda não houver. */
export function dadosSincronos(): Dados {
  if (!cache) throw new Error('dados.json ainda não foi carregado');
  return cache;
}
