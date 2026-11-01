/**
 * Dívida, restos a pagar e equilíbrio fiscal.
 */

import { useCallback, useMemo } from 'react';
import type { EChartsCoreOption } from 'echarts/core';

import type { Dados } from '../tipos';
import { Grafico } from '../componentes/Grafico';
import {
  CartaoTitulo,
  Kpi,
  ListaDestaques,
  NotaGrafico,
  Secao,
} from '../componentes/blocos';
import { porcento, reaisCompacto } from '../lib/formato';
import { serieTotal, totalLiquidado, valor } from '../lib/calculos';
import { baseGrafico, eixoCategoria, eixoMilhoes, eixoValor } from '../lib/tema';
import type { TemaGrafico } from '../lib/tema';

export function Divida({ d }: { d: Dados }) {
  const anos = d.meta.anos;
  const ultimo = anos[anos.length - 1] ?? 2025;

  const divida = d.indicadores.divida_rcl;
  const dadosUltimo = divida[String(ultimo)];

  /* ---------------- dívida consolidada líquida ---------------- */

  const opcaoDcl = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const anosComDado = anos.filter((a) => divida[String(a)]?.dcl_pct_rcl !== null);
      const limite = dadosUltimo?.limite ?? 120;

      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
        tooltip: {
          ...baseGrafico(t).tooltip,
          trigger: 'axis',
          valueFormatter: (v: unknown) =>
            typeof v === 'number' ? `${v.toFixed(2)}% da RCL` : '—',
        },
        xAxis: eixoCategoria(anosComDado.map(String), t),
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: t.borda, type: 'dashed' } },
          axisLabel: { color: t.texto3, fontSize: 11, formatter: (v: number) => `${v}%` },
          axisLine: { show: false },
        },
        series: [
          {
            name: 'Dívida consolidada líquida',
            type: 'line',
            smooth: 0.25,
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: { width: 3 },
            itemStyle: { color: t.cores[2] },
            areaStyle: { color: t.cores[2], opacity: 0.1 },
            data: anosComDado.map((a) => divida[String(a)]?.dcl_pct_rcl ?? null),
            markLine: {
              silent: true,
              symbol: 'none',
              label: {
                position: 'insideEndTop',
                color: t.negativo,
                fontSize: 10,
                formatter: `Limite ${limite}%`,
              },
              lineStyle: { type: 'dashed', color: t.negativo, width: 1.5 },
              data: [{ yAxis: limite }],
            },
          },
        ],
      };
    },
    [anos, divida, dadosUltimo],
  );

  /* ---------------- restos a pagar ---------------- */

  const opcaoRestos = useCallback(
    (t: TemaGrafico): EChartsCoreOption => ({
      ...baseGrafico(t),
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        ...baseGrafico(t).tooltip,
        trigger: 'axis',
        valueFormatter: (v: unknown) => reaisCompacto(typeof v === 'number' ? v : null),
      },
      xAxis: eixoCategoria(anos.map(String), t),
      yAxis: eixoValor(t, eixoMilhoes),
      series: [
        {
          type: 'bar',
          data: anos.map((a) => valor(d.execucao.totais[String(a)], 'restos_inscritos')),
          itemStyle: { color: t.alerta, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 42,
          label: {
            show: true,
            position: 'top',
            formatter: (p: unknown) => reaisCompacto((p as { value: number }).value, 1),
            color: t.texto3,
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
          },
        },
      ],
    }),
    [anos, d],
  );

  /* ---------------- receita × despesa ---------------- */

  const opcaoEquilibrio = useCallback(
    (t: TemaGrafico): EChartsCoreOption => ({
      ...baseGrafico(t),
      grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
      tooltip: {
        ...baseGrafico(t).tooltip,
        trigger: 'axis',
        valueFormatter: (v: unknown) => reaisCompacto(typeof v === 'number' ? v : null),
      },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: t.texto3, fontSize: 11 },
      },
      xAxis: eixoCategoria(anos.map(String), t),
      yAxis: eixoValor(t, eixoMilhoes),
      series: [
        {
          name: 'Receita',
          type: 'line',
          smooth: 0.25,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5 },
          itemStyle: { color: t.positivo },
          data: anos.map(
            (a) => d.balanco.totais[String(a)]?.receita_total ?? d.paineis.totais['receita']?.[String(a)] ?? null,
          ),
        },
        {
          name: 'Despesa liquidada',
          type: 'line',
          smooth: 0.25,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, type: 'dashed' },
          itemStyle: { color: t.negativo },
          data: serieTotal(d, anos, 'liquidado'),
        },
      ],
    }),
    [anos, d],
  );

  /* ---------------- investimento × pessoal ---------------- */

  const opcaoComposicao = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const pessoal = d.balanco.despesas['pessoal'] ?? {};
      const investimento = d.balanco.despesas['investimentos'] ?? {};
      const juros = d.balanco.despesas['juros'] ?? {};

      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
        tooltip: {
          ...baseGrafico(t).tooltip,
          trigger: 'axis',
          valueFormatter: (v: unknown) => reaisCompacto(typeof v === 'number' ? v : null),
        },
        legend: {
          top: 0,
          left: 0,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: t.texto3, fontSize: 11 },
        },
        xAxis: eixoCategoria(anos.map(String), t),
        yAxis: eixoValor(t, eixoMilhoes),
        series: [
          {
            name: 'Pessoal e encargos',
            type: 'bar',
            data: anos.map((a) => pessoal[String(a)] ?? null),
            itemStyle: { color: t.cores[3], borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 26,
          },
          {
            name: 'Investimentos',
            type: 'bar',
            data: anos.map((a) => investimento[String(a)] ?? null),
            itemStyle: { color: t.cores[0], borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 26,
          },
          {
            name: 'Juros da dívida',
            type: 'bar',
            data: anos.map((a) => juros[String(a)] ?? null),
            itemStyle: { color: t.negativo, borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 26,
          },
        ],
      };
    },
    [anos, d],
  );

  const destaques = useMemo(() => {
    const itens = [];

    if (dadosUltimo?.dcl_pct_rcl !== null && dadosUltimo?.dcl_pct_rcl !== undefined) {
      const pct = dadosUltimo.dcl_pct_rcl;
      const limite = dadosUltimo.limite;
      itens.push({
        titulo:
          pct < 0
            ? `Dívida líquida negativa: ${porcento(pct)} da RCL`
            : `Dívida consolidada líquida em ${porcento(pct)} da RCL`,
        texto:
          pct < 0
            ? 'O município tem mais disponibilidades que dívida bruta. Situação confortável, sem espaço para se endividar por esse indicador.'
            : `O limite para municípios é ${porcento(limite, 0)} da RCL. Restam ${porcento(
                limite - pct,
                1,
              )} de margem.`,
        tom: pct < 0 ? ('positivo' as const) : pct > limite * 0.8 ? ('alerta' as const) : ('neutro' as const),
      });
    }

    // Restos a pagar do último ano vs. o anterior.
    const restosUltimo = valor(d.execucao.totais[String(ultimo)], 'restos_inscritos');
    const restosAnterior = valor(d.execucao.totais[String(ultimo - 1)], 'restos_inscritos');
    if (restosUltimo && restosAnterior) {
      const varPct = ((restosUltimo - restosAnterior) / restosAnterior) * 100;
      itens.push({
        titulo: `${reaisCompacto(restosUltimo)} em restos a pagar não processados`,
        texto: `${varPct >= 0 ? 'Aumento' : 'Queda'} de ${porcento(
          Math.abs(varPct),
        )} em relação a ${ultimo - 1}. São compromissos empenhados que ficaram para o ano seguinte.`,
        tom: varPct > 30 ? ('alerta' as const) : ('neutro' as const),
      });
    }

    // Regra de ouro: operações de crédito vs. despesa de capital.
    const credito = d.balanco.receitas['operacoes_credito']?.[String(ultimo)] ?? null;
    const capital = d.balanco.despesas['despesas_capital']?.[String(ultimo)] ?? null;
    if (credito !== null && capital !== null && capital > 0) {
      const razao = (credito / capital) * 100;
      itens.push({
        titulo: `Regra de ouro: ${porcento(razao, 0)}`,
        texto: `Operações de crédito de ${reaisCompacto(
          credito,
        )} contra ${reaisCompacto(capital)} de despesa de capital. Abaixo de 100% significa que o município não se endividou para custeio.`,
        tom: razao <= 100 ? ('positivo' as const) : ('negativo' as const),
      });
    }

    return itens;
  }, [d, dadosUltimo, ultimo]);

  const restosUltimo = valor(d.execucao.totais[String(ultimo)], 'restos_inscritos');

  return (
    <Secao
      id="divida"
      numero="Seção 6"
      titulo="Dívida, restos a pagar e equilíbrio"
      descricao={
        <>
          O endividamento do município medido pela Dívida Consolidada Líquida, as
          contas deixadas para o ano seguinte e a chamada regra de ouro — o
          município só pode se endividar para investir, não para pagar custeio.
        </>
      }
    >
      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Dívida / RCL"
          valor={porcento(dadosUltimo?.dcl_pct_rcl)}
          nota={`limite ${porcento(dadosUltimo?.limite ?? 120, 0)}`}
          destaque
        />
        <Kpi
          rotulo="Dívida consolidada"
          valor={reaisCompacto(dadosUltimo?.dcl_valor ?? null)}
          nota="valor absoluto do exercício"
        />
        <Kpi
          rotulo="Restos a pagar"
          valor={reaisCompacto(restosUltimo)}
          nota={`inscritos em ${ultimo}`}
        />
        <Kpi
          rotulo="Investimentos"
          valor={reaisCompacto(d.balanco.despesas['investimentos']?.[String(ultimo)] ?? null)}
          nota={`despesa de capital em ${ultimo}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <CartaoTitulo
          titulo="Dívida consolidada líquida"
          descricao="Percentual da Receita Corrente Líquida"
        >
          <Grafico
            opcao={opcaoDcl}
            altura={320}
            rotulo="Dívida consolidada líquida em porcentagem da RCL e limite legal"
          />
          <NotaGrafico>
            Dívida Consolidada Líquida conforme o Relatório de Gestão Fiscal.
            Valor negativo significa que o município tem mais disponibilidades
            financeiras que dívida bruta.
          </NotaGrafico>
        </CartaoTitulo>

        <CartaoTitulo
          titulo="Restos a pagar não processados"
          descricao="Compromissos inscritos e não pagos no exercício"
        >
          <Grafico
            opcao={opcaoRestos}
            altura={320}
            rotulo="Restos a pagar não processados inscritos por ano"
          />
          <NotaGrafico>
            Restos a pagar são despesas empenhadas e não pagas até 31 de dezembro.
            Volume alto indica que a execução foi empurrada para o exercício
            seguinte.
          </NotaGrafico>
        </CartaoTitulo>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <CartaoTitulo
          titulo="Receita e despesa"
          descricao="O equilíbrio do exercício"
        >
          <Grafico
            opcao={opcaoEquilibrio}
            altura={320}
            rotulo="Receita arrecadada e despesa liquidada por ano"
          />
        </CartaoTitulo>

        <CartaoTitulo titulo="Saúde fiscal">
          <ListaDestaques itens={destaques} />
        </CartaoTitulo>
      </div>

      <CartaoTitulo
        className="mt-5"
        titulo="Composição da despesa por categoria"
        descricao="Pessoal, investimento e serviço da dívida"
      >
        <Grafico
          opcao={opcaoComposicao}
          altura={340}
          rotulo="Pessoal, investimentos e juros da dívida por ano"
        />
        <NotaGrafico>
          Valores do balanço orçamentário (RREO-Anexo 01), que classifica a despesa
          por categoria econômica. O RREO-Anexo 02 não traz essa abertura — por
          isso a natureza da despesa não pode ser cruzada com a subfunção.
        </NotaGrafico>
      </CartaoTitulo>

      {/* Previdência dos servidores */}
      <div className="mt-5 cartao-pad">
        <h3 className="mb-2 font-serif text-base font-semibold">
          Previdência dos servidores (RPPS)
        </h3>
        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-texto-2">
          A subfunção <strong>272 - Previdência do Regime Estatutário</strong> é o
          segundo maior bloco individual do orçamento de {d.meta.municipio}. Ela
          cobre as aposentadorias e pensões dos servidores estatutários, pagas pelo
          FAPSBENTO.
        </p>
        <PrevidenciaTabela d={d} />
      </div>
    </Secao>
  );
}

/** Tabela da trajetória da subfunção 272. */
function PrevidenciaTabela({ d }: { d: Dados }) {
  const anos = d.meta.anos;
  const rpps = d.execucao.subfuncoes.find(
    (s) => s.cod === 272 && s.cod_funcao === 9,
  );

  if (!rpps) {
    return (
      <p className="text-sm text-texto-3">
        Subfunção 272 não encontrada nos dados deste exercício.
      </p>
    );
  }

  const acumulado = anos.reduce(
    (acc, a) => acc + (valor(rpps.valores[String(a)], 'liquidado') ?? 0),
    0,
  );
  const totalPeriodo = anos.reduce((acc, a) => acc + (totalLiquidado(d, a) ?? 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="tabela">
        <thead>
          <tr>
            <th>Subfunção</th>
            {anos.map((a) => (
              <th key={a} className="num">
                {a}
              </th>
            ))}
            <th className="num">Acumulado</th>
            <th className="num">% do total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="font-medium">272 · Previdência do Regime Estatutário</td>
            {anos.map((a) => (
              <td key={a} className="num">
                {reaisCompacto(valor(rpps.valores[String(a)], 'liquidado'))}
              </td>
            ))}
            <td className="num font-semibold">{reaisCompacto(acumulado)}</td>
            <td className="num text-texto-2">
              {totalPeriodo ? porcento((acumulado / totalPeriodo) * 100) : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
