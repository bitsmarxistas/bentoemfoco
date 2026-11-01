/**
 * Metodologia — fontes, decisões de método e como reproduzir.
 */

import type { Dados } from '../tipos';
import { CartaoTitulo, Secao } from '../componentes/blocos';
import { inteiro } from '../lib/formato';

export function Metodologia({ d }: { d: Dados }) {
  return (
    <Secao
      id="metodologia"
      numero="Seção 9"
      titulo="Fontes, método e reprodutibilidade"
      descricao={
        <>
          Nenhum número deste site foi digitado à mão. Todos vêm de código
          executado sobre dados brutos baixados de fontes oficiais, e o pipeline
          se recusa a publicar quando uma âncora contábil não fecha.
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <CartaoTitulo titulo="Fontes oficiais">
          <ul className="space-y-3 text-[13px] leading-relaxed text-texto-2">
            <li>
              <strong className="text-texto">SICONFI / Tesouro Nacional</strong>
              <br />
              RREO Anexos 01, 02, 03, 04, 06, 07, 09, 11 e 14 (6º bimestre de cada
              exercício); RGF Anexos 01 a 06 (3º quadrimestre, Executivo e
              Legislativo); DCA Anexos I-C a I-G (encerramento de exercício).
              API: <code className="font-mono text-2xs">apidatalake.tesouro.gov.br</code>.
            </li>
            <li>
              <strong className="text-texto">
                Portal de Transparência de {d.meta.municipio}
              </strong>
              <br />
              API ELO Tech: pagamentos por ordem cronológica, a pagar, receitas,
              servidores, cargos, licitações, contratos, créditos adicionais,
              obras, convênios e painéis mensais.
            </li>
          </ul>
        </CartaoTitulo>

        <CartaoTitulo titulo="Decisões de método">
          <ul className="space-y-3 text-[13px] leading-relaxed text-texto-2">
            <li>
              <strong className="text-texto">
                Função e subfunção reconstruídas por posição
              </strong>
              <br />
              O RREO-Anexo 02 não traz códigos numéricos: traz nomes, na ordem do
              relatório, com a função seguida de suas subfunções. O pipeline
              percorre os blocos nessa ordem e reconstrói os códigos oficiais a
              partir de uma tabela derivada da Portaria MOG 42/1999.
            </li>
            <li>
              <strong className="text-texto">Validação por âncora contábil</strong>
              <br />
              A soma das subfunções precisa fechar com o total declarado. Em todos
              os seis exercícios a divergência é de R$ 0,00.
            </li>
            <li>
              <strong className="text-texto">Pago vem da DCA</strong>
              <br />
              O RREO-Anexo 02 não tem coluna de despesa paga. Os valores pagos por
              função e subfunção vêm da DCA-Anexo I-E, casados por código.
            </li>
            <li>
              <strong className="text-texto">Pessoal sobre RCL Ajustada</strong>
              <br />
              O percentual é o oficial do RGF, calculado sobre a RCL Ajustada —
              não uma divisão nossa.
            </li>
          </ul>
        </CartaoTitulo>

        <CartaoTitulo titulo="Como reproduzir">
          <p className="mb-3 text-[13px] leading-relaxed text-texto-2">
            O pipeline é composto de quatro etapas independentes, cada uma com
            cache em disco e retomada:
          </p>
          <pre className="overflow-x-auto rounded-controle bg-superficie-2 p-3 font-mono text-xs leading-relaxed">
{`cd pipeline

# 1. SICONFI (Tesouro): 133 requisições
python coleta_siconfi.py

# 2. Portal municipal: 159 requisições
python coleta_bg.py

# 3. Processa e gera out/dados.json
python processa.py

# 4. Valida contra 24 âncoras conhecidas
python valida.py`}
          </pre>
          <p className="mt-3 text-xs leading-relaxed text-texto-3">
            Os coletores pulam arquivos já baixados, então rodar de novo só busca
            o que falta. Use <code className="font-mono">--forcar</code> para
            rebaixar tudo.
          </p>
        </CartaoTitulo>

        <CartaoTitulo titulo="Estrutura do projeto">
          <pre className="overflow-x-auto rounded-controle bg-superficie-2 p-3 font-mono text-xs leading-relaxed">
{`prefeitura/v2/
├── pipeline/           Python 3.11+, sem dependências
│   ├── coleta_siconfi.py
│   ├── coleta_bg.py
│   ├── classificacao.py   tabelas oficiais
│   ├── processa.py        gera out/dados.json
│   ├── valida.py          24 âncoras
│   ├── raw/               dados brutos (git-ignored)
│   └── out/dados.json
└── web/                React + Vite + TS + Tailwind
    └── src/
        ├── secoes/      uma por seção do site
        ├── componentes/ gráfico, blocos, cabeçalho
        ├── lib/         formato, cálculos, tema
        └── tipos.ts     tipos do pacote de dados`}
          </pre>
        </CartaoTitulo>
      </div>

      <CartaoTitulo className="mt-5" titulo="Estatísticas desta geração">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-texto-3">
              Gerado em
            </p>
            <p className="mt-1 font-mono text-sm">{d.meta.gerado_em}</p>
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-texto-3">
              Exercícios
            </p>
            <p className="mt-1 font-mono text-sm">
              {d.meta.anos[0]}–{d.meta.anos[d.meta.anos.length - 1]} (+{d.meta.ano_corrente}{' '}
              parcial)
            </p>
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-texto-3">
              Funções × subfunções
            </p>
            <p className="mt-1 font-mono text-sm">
              {inteiro(d.execucao.funcoes.length)} × {inteiro(d.execucao.subfuncoes.length)}
            </p>
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-texto-3">
              Código IBGE
            </p>
            <p className="mt-1 font-mono text-sm">{d.meta.ibge}</p>
          </div>
        </div>
      </CartaoTitulo>

      <div className="mt-5 rounded-cartao border border-borda bg-superficie-2 p-5">
        <h3 className="font-serif text-base font-semibold">Sobre este observatório</h3>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-texto-2">
          Análise independente sobre dados públicos de {d.meta.municipio}. O
          objetivo é tornar o orçamento municipal legível para qualquer pessoa:
          de onde vem o dinheiro, para onde vai, quem recebe e o que isso significa
          para as contas públicas. Uso educacional e de controle social.
        </p>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-texto-3">
          Este site não substitui os relatórios oficiais. Para decisões formais,
          consulte sempre a fonte original no SICONFI ou no Portal de Transparência
          do município. Encontrou um erro? A metodologia e o código estão
          documentados acima — qualquer divergência pode ser rastreada até o dado
          bruto.
        </p>
      </div>
    </Secao>
  );
}
