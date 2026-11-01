/**
 * Aplicação — compõe o cabeçalho, as seções e o rodapé.
 *
 * Cada seção é um componente próprio em `secoes/`. A ordem segue a
 * narrativa do site: onde está o dinheiro → como é executado → de onde
 * vem → quem recebe → quem trabalha → qual o endividamento → a Câmara →
 * a auditoria → o método.
 */

import type { Dados } from './tipos';
import { Cabecalho } from './componentes/Cabecalho';
import { Carregador } from './componentes/Carregador';
import { Hero } from './secoes/Hero';
import { MapaGasto } from './secoes/MapaGasto';
import { Execucao } from './secoes/Execucao';
import { Receitas } from './secoes/Receitas';
import { Compras } from './secoes/Compras';
import { Pessoal } from './secoes/Pessoal';
import { Divida } from './secoes/Divida';
import { Camara } from './secoes/Camara';
import { Auditoria } from './secoes/Auditoria';
import { Metodologia } from './secoes/Metodologia';

function Conteudo({ d }: { d: Dados }) {
  // Define o título da página com base nos dados carregados, para que o
  // mesmo build sirva a qualquer município.
  document.title = `Observatório do Orçamento — ${d.meta.municipio}/${d.meta.uf}`;

  return (
    <>
      <Cabecalho
        municipio={d.meta.municipio}
        uf={d.meta.uf}
      />
      <main id="topo">
        <Hero d={d} />
        <MapaGasto d={d} />
        <Execucao d={d} />
        <Receitas d={d} />
        <Compras d={d} />
        <Pessoal d={d} />
        <Divida d={d} />
        <Camara d={d} />
        <Auditoria d={d} />
        <Metodologia d={d} />
      </main>
      <footer className="border-t border-borda bg-superficie">
        <div className="wrap py-8">
          <p className="text-sm font-medium">
            Observatório do Orçamento de {d.meta.municipio}
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-texto-3">
            Análise independente sobre dados públicos. Fontes:{' '}
            {d.meta.fontes.join('; ')}. Uso educacional e de controle social.
            Verifique sempre a fonte oficial antes de decisões formais.
          </p>
          <p className="mt-3 font-mono text-2xs text-texto-3">
            Município: {d.meta.municipio}/{d.meta.uf} (IBGE {d.meta.ibge}) ·
            anos {d.meta.anos.join('–')} · dados gerados em{' '}
            {d.meta.gerado_em} · valores em reais correntes
          </p>
        </div>
      </footer>
    </>
  );
}

export function App() {
  return (
    <Carregador>
      {(d) => <Conteudo d={d} />}
    </Carregador>
  );
}
