/**
 * Contexto de tema (claro/escuro).
 *
 * O tema vive no `data-tema` do `<html>`, para que o CSS possa reagir sem
 * JavaScript. O contexto só existe para que os gráficos saibam reconstruir
 * suas cores quando o tema muda.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Tema = 'claro' | 'escuro';

interface ValorContexto {
  tema: Tema;
  alterna: () => void;
}

const Contexto = createContext<ValorContexto | null>(null);

const CHAVE = 'observatorio-tema';

/** Lê o tema inicial: preferência salva, senão a do sistema. */
function temaInicial(): Tema {
  if (typeof window === 'undefined') return 'claro';
  const salvo = localStorage.getItem(CHAVE);
  if (salvo === 'claro' || salvo === 'escuro') return salvo;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

export function ProvedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  // Espelha no DOM e persiste.
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    localStorage.setItem(CHAVE, tema);
  }, [tema]);

  const alterna = useCallback(() => {
    setTema((t) => (t === 'claro' ? 'escuro' : 'claro'));
  }, []);

  const valor = useMemo(() => ({ tema, alterna }), [tema, alterna]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTema(): ValorContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTema precisa estar dentro de ProvedorTema');
  return ctx;
}
