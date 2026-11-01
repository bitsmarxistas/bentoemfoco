/**
 * Cabeçalho fixo, com navegação por seção e alternância de tema.
 *
 * A navegação destaca a seção visível usando IntersectionObserver, sem
 * listener de scroll — mais barato e não trava em telas grandes.
 */

import { useEffect, useState } from 'react';

import { useTema } from '../contextos/TemaContexto';

const SECOES = [
  { id: 'mapa', rotulo: 'O mapa do gasto' },
  { id: 'execucao', rotulo: 'Orçamento' },
  { id: 'receitas', rotulo: 'Receitas' },
  { id: 'compras', rotulo: 'Compras' },
  { id: 'pessoal', rotulo: 'Pessoal' },
  { id: 'divida', rotulo: 'Dívida' },
  { id: 'camara', rotulo: 'Câmara' },
  { id: 'auditoria', rotulo: 'Auditoria' },
  { id: 'metodologia', rotulo: 'Método' },
] as const;

export function Cabecalho({ municipio, uf }: { municipio: string; uf: string }) {
  const { tema, alterna } = useTema();
  const [ativo, setAtivo] = useState<string>('');
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const alvos = SECOES.map((s) => document.getElementById(s.id)).filter(
      (e): e is HTMLElement => e !== null,
    );
    if (!alvos.length) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visiveis = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const primeiro = visiveis[0];
        if (primeiro) setAtivo(primeiro.target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0.1, 0.5] },
    );
    alvos.forEach((a) => observador.observe(a));
    return () => observador.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-tela/85 backdrop-blur-md nao-imprime">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <a href="#topo" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-acento font-serif text-xs font-bold text-white leading-none">
            OO
          </span>
          <span className="hidden sm:block">
            <span className="block font-serif text-[16px] font-semibold leading-tight tracking-tight">
              Observatório do Orçamento
            </span>
            <span className="block text-2xs uppercase tracking-wider text-texto-3">
              {municipio} · {uf}
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Seções">
          {SECOES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={ativo === s.id ? 'true' : undefined}
              className={`rounded-controle px-2.5 py-1.5 text-[12.5px] transition-colors ${
                ativo === s.id
                  ? 'bg-acento-suave font-medium text-acento'
                  : 'text-texto-2 hover:bg-superficie-2 hover:text-texto'
              }`}
            >
              {s.rotulo}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            className="botao-icone lg:hidden"
            aria-label="Abrir menu de seções"
            aria-expanded={menuAberto}
          >
            ☰
          </button>
          <button
            type="button"
            onClick={alterna}
            className="botao-icone"
            aria-label={tema === 'claro' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
            title="Alternar tema"
          >
            {tema === 'claro' ? '◐' : '◑'}
          </button>
        </div>
      </div>

      {menuAberto && (
        <nav className="border-t border-borda bg-superficie lg:hidden" aria-label="Seções">
          <div className="wrap grid grid-cols-2 gap-1 py-3">
            {SECOES.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setMenuAberto(false)}
                className="rounded-controle px-3 py-2 text-sm text-texto-2 hover:bg-superficie-2"
              >
                {s.rotulo}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
