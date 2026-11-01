/**
 * Hero — a primeira dobra: a pergunta, os cinco números que a respondem.
 */

import type { Dados } from '../tipos';
import { Kpi } from '../componentes/blocos';
import { inteiro, porcento, reais, reaisCompacto } from '../lib/formato';
import { totalLiquidado, variacao } from '../lib/calculos';

export function Hero({ d }: { d: Dados }) {
  const anos = d.meta.anos;
  const ultimo = anos[anos.length - 1] ?? 2025;
  const penultimo = anos[anos.length - 2] ?? 2024;

  const liq = totalLiquidado(d, ultimo);
  const liqAnt = totalLiquidado(d, penultimo);
  const varAno = variacao(liqAnt, liq);

  const perCapita = d.indicadores.per_capita[String(ultimo)];
  const populacao = d.indicadores.populacao[String(ultimo)];
  const pagamentos = d.pagamentos.por_entidade['prefeitura']?.[String(ultimo)];
  const servidores = d.servidores.servidores.filter(
    (s) => s.entidade === 'prefeitura' && s.situacao === 'ATIVO',
  ).length;
  const pessoal = d.indicadores.pessoal_rcl[String(ultimo)];

  // Acumulado do período, para dar a dimensão de tudo.
  const acumulado = anos.reduce((acc, a) => acc + (totalLiquidado(d, a) ?? 0), 0);

  return (
    <section className="relative overflow-hidden border-b border-borda">
      {/* Fundo: gradiente sutil, sem imagem. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            'radial-gradient(900px 400px at 15% -10%, var(--cor-acento-suave), transparent 70%)',
        }}
      />

      <div className="wrap relative py-14 sm:py-20">
        <p className="eyebrow">
          Dados abertos · SICONFI/Tesouro Nacional + Portal de Transparência
        </p>

        <h1 className="mt-3 max-w-4xl font-serif text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
          Para onde vai o dinheiro de{' '}
          <em className="not-italic text-acento">{d.meta.municipio}</em>?
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-texto-2">
          Orçamento, execução, compras públicas, servidores, receitas e dívida do
          município — de {anos[0]} a {ultimo}. Tudo calculado a partir de dados
          oficiais, sem nenhum número digitado à mão.
        </p>

        <div className="mt-8 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Kpi
            rotulo={`Despesa liquidada ${ultimo}`}
            valor={reaisCompacto(liq)}
            variacao={varAno}
            nota={`${reais(liq, 0)} reconhecidos no ano`}
            destaque
          />
          <Kpi
            rotulo="Gasto por habitante"
            valor={perCapita ? reais(perCapita, 0) : '—'}
            nota={`população estimada ${inteiro(populacao)}`}
          />
          <Kpi
            rotulo={`Pagamentos em ${ultimo}`}
            valor={inteiro(pagamentos?.ordens ?? null)}
            nota="ordens bancárias efetuadas"
          />
          <Kpi
            rotulo="Servidores ativos"
            valor={inteiro(servidores)}
            nota="Prefeitura, cadastro corrente"
          />
        </div>

        <div className="mt-3 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Kpi
            rotulo="Pessoal / RCL"
            valor={porcento(pessoal?.dtp_pct_rcl)}
            nota={
              pessoal
                ? `limite legal ${porcento(pessoal.limite, 0)} da RCL`
                : 'não apurado'
            }
          />
          <Kpi
            rotulo={`Acumulado ${anos[0]}–${ultimo}`}
            valor={reaisCompacto(acumulado)}
            nota="despesa liquidada no período"
          />
          <Kpi
            rotulo={`Receita ${ultimo}`}
            valor={reaisCompacto(
              d.balanco.totais[String(ultimo)]?.receita_total ??
                d.paineis.totais['receita']?.[String(ultimo)] ??
                null,
            )}
            nota="arrecadação total do exercício"
          />
          <Kpi
            rotulo="Subfunções monitoradas"
            valor={inteiro(d.execucao.subfuncoes.length)}
            nota={`em ${d.execucao.funcoes.length} funções de governo`}
          />
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-texto-3">
          Valores em reais correntes, sem correção pela inflação. Exercícios
          fechados até {ultimo}; {d.meta.ano_corrente} aparece apenas onde há dado
          parcial publicado. A despesa liquidada é a medida principal de execução:
          significa que o serviço foi entregue ou o produto recebido.
        </p>
      </div>
    </section>
  );
}
