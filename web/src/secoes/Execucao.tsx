/**
 * Do orçamento à execução — dotação, empenhado, liquidado e pago por função.
 *
 * Mostra o funil de execução: quanto foi autorizado, quanto foi comprometido,
 * quanto virou despesa devida e quanto saiu do caixa.
 */

import { useCallback, useMemo, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';

import type { Dados } from '../tipos';
import { Grafico } from '../componentes/Grafico';
import {
  CartaoTitulo,
  Kpi,
  ListaDestaques,
  NotaGrafico,
  SeletorAno,
  Secao,
} from '../componentes/blocos';
import { porcento, reaisCompacto } from '../lib/formato';
import { rankingFuncoes, serieTotal, totalLiquidado, valor, variacao } from '../lib/calculos';
import { baseGrafico, eixoCategoria, eixoMilhoes, eixoValor } from '../lib/tema';
import type { TemaGrafico } from '../lib/tema';

export function Execucao({ d }: { d: Dados }) {
  const anos = d.meta.anos;
  const ultimo = anos[anos.length - 1] ?? 2025;
  const [ano, setAno] = useState(ultimo);

  const ranking = useMemo(() => rankingFuncoes(d, 'liquidado'), [d]);

  // Funções com execução no ano escolhido, ordenadas por liquidado.
  const doAno = useMemo(
    () =>
      ranking
        .map((r) => ({
          funcao: r.funcao,
          dotacao: valor(r.funcao.valores[String(ano)], 'dotacao_atualizada'),
          empenhado: valor(r.funcao.valores[String(ano)], 'empenhado'),
          liquidado: valor(r.funcao.valores[String(ano)], 'liquidado'),
          pago: valor(r.funcao.valores[String(ano)], 'pago'),
        }))
        .filter((r) => (r.liquidado ?? 0) > 0)
        .sort((a, b) => (b.liquidado ?? 0) - (a.liquidado ?? 0)),
    [ranking, ano],
  );

  const totalDoAno = useMemo(() => {
    const t = d.execucao.totais[String(ano)];
    return {
      dotacao: valor(t, 'dotacao_atualizada'),
      empenhado: valor(t, 'empenhado'),
      liquidado: valor(t, 'liquidado'),
    };
  }, [d, ano]);

  const pagoTotal = useMemo(
    () => doAno.reduce((acc, r) => acc + (r.pago ?? 0), 0),
    [doAno],
  );

  /* ---------------- funil ---------------- */

  const opcaoFunil = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const categorias = ['Dotação atualizada', 'Empenhado', 'Liquidado', 'Pago'];
      const valores = [
        totalDoAno.dotacao,
        totalDoAno.empenhado,
        totalDoAno.liquidado,
        pagoTotal || null,
      ];

      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 24, top: 16, bottom: 8, containLabel: true },
        tooltip: {
          ...baseGrafico(t).tooltip,
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          valueFormatter: (v: unknown) => reaisCompacto(typeof v === 'number' ? v : null),
        },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: t.borda, type: 'dashed' } },
          axisLabel: { color: t.texto3, fontSize: 11, formatter: eixoMilhoes },
          axisLine: { show: false },
        },
        yAxis: {
          type: 'category',
          data: categorias,
          inverse: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: t.texto2, fontSize: 12 },
        },
        series: [
          {
            type: 'bar',
            data: valores.map((v, i) => ({
              value: v,
              itemStyle: {
                color: t.cores[i % t.cores.length],
                borderRadius: [0, 4, 4, 0],
              },
            })),
            barWidth: '55%',
            label: {
              show: true,
              position: 'right',
              formatter: (p: unknown) => {
                const q = p as { value: number };
                return reaisCompacto(q.value);
              },
              color: t.texto,
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
            },
          },
        ],
      };
    },
    [totalDoAno, pagoTotal],
  );

  /* ---------------- execução por função ---------------- */

  const opcaoFuncoes = useCallback(
    (t: TemaGrafico): EChartsCoreOption => ({
      ...baseGrafico(t),
      grid: { left: 8, right: 24, top: 30, bottom: 8, containLabel: true },
      tooltip: {
        ...baseGrafico(t).tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (v: unknown) => reaisCompacto(typeof v === 'number' ? v : null),
      },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: t.texto3, fontSize: 11 },
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: t.borda, type: 'dashed' } },
        axisLabel: { color: t.texto3, fontSize: 11, formatter: eixoMilhoes },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: doAno.map((r) => r.funcao.rotulo),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.texto3, fontSize: 11 },
      },
      series: [
        {
          name: 'Dotação atualizada',
          type: 'bar',
          data: doAno.map((r) => r.dotacao),
          itemStyle: { color: t.borda, borderRadius: [0, 3, 3, 0] },
          barGap: '-100%',
          barWidth: '62%',
        },
        {
          name: 'Empenhado',
          type: 'bar',
          data: doAno.map((r) => r.empenhado),
          itemStyle: { color: t.cores[0], borderRadius: [0, 3, 3, 0] },
          barWidth: '62%',
        },
        {
          name: 'Liquidado',
          type: 'bar',
          data: doAno.map((r) => r.liquidado),
          itemStyle: { color: t.cores[1], borderRadius: [0, 3, 3, 0] },
          barWidth: '62%',
        },
      ],
    }),
    [doAno],
  );

  /* ---------------- série histórica ---------------- */

  const opcaoSerie = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const campos = [
        { chave: 'dotacao_atualizada' as const, rotulo: 'Dotação atualizada', cor: t.borda },
        { chave: 'empenhado' as const, rotulo: 'Empenhado', cor: t.cores[0] },
        { chave: 'liquidado' as const, rotulo: 'Liquidado', cor: t.cores[1] },
      ];
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
        series: campos.map((c) => ({
          name: c.rotulo,
          type: 'line' as const,
          smooth: 0.25,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5 },
          itemStyle: { color: c.cor },
          areaStyle:
            c.chave === 'liquidado'
              ? { color: c.cor, opacity: 0.08 }
              : undefined,
          data: serieTotal(d, anos, c.chave),
        })),
      };
    },
    [anos, d],
  );

  /* ---------------- indicadores ---------------- */

  const varLiquidado = useMemo(() => {
    const i = anos.indexOf(ano);
    if (i <= 0) return null;
    const anterior = anos[i - 1];
    return anterior ? variacao(totalLiquidado(d, anterior), totalLiquidado(d, ano)) : null;
  }, [d, ano, anos]);

  const taxaExecucao =
    totalDoAno.dotacao && totalDoAno.liquidado
      ? (totalDoAno.liquidado / totalDoAno.dotacao) * 100
      : null;

  const taxaEmpenho =
    totalDoAno.dotacao && totalDoAno.empenhado
      ? (totalDoAno.empenhado / totalDoAno.dotacao) * 100
      : null;

  const destaques = useMemo(() => {
    const itens = [];

    // Função com maior taxa de execução e com menor.
    const comTaxa = doAno
      .filter((r) => r.dotacao && r.dotacao > 1_000_000 && r.liquidado !== null)
      .map((r) => ({ rotulo: r.funcao.rotulo, taxa: ((r.liquidado ?? 0) / (r.dotacao ?? 1)) * 100 }))
      .sort((a, b) => b.taxa - a.taxa);

    const melhor = comTaxa[0];
    const pior = comTaxa[comTaxa.length - 1];

    if (melhor) {
      itens.push({
        titulo: `${melhor.rotulo} executa ${porcento(melhor.taxa, 0)} da dotação`,
        texto: `É a função com maior taxa de execução em ${ano}, entre as com dotação acima de R$ 1 milhão.`,
        tom: 'positivo' as const,
      });
    }
    if (pior && pior.rotulo !== melhor?.rotulo) {
      itens.push({
        titulo: `${pior.rotulo} executa só ${porcento(pior.taxa, 0)}`,
        texto: `Menor taxa entre as funções relevantes de ${ano}. Dotação parada indica obra ou programa que não andou.`,
        tom: 'negativo' as const,
      });
    }

    const restos = valor(d.execucao.totais[String(ano)], 'restos_inscritos');
    if (restos) {
      itens.push({
        titulo: `${reaisCompacto(restos)} inscritos em restos a pagar`,
        texto: `Compromissos empenhados em ${ano} que ficaram para o ano seguinte. Quanto maior, mais a execução foi empurrada adiante.`,
        tom: 'alerta' as const,
      });
    }

    return itens;
  }, [d, doAno, ano]);

  return (
    <Secao
      id="execucao"
      numero="Seção 2"
      titulo="Do orçamento à execução"
      descricao={
        <>
          Quatro estágios da despesa pública: a <strong>dotação</strong> autoriza,
          o <strong>empenho</strong> reserva, a <strong>liquidação</strong> confirma
          que o serviço foi entregue e o <strong>pagamento</strong> tira o dinheiro
          do caixa. A diferença entre eles é onde a gestão acontece.
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SeletorAno anos={anos} valor={ano} aoMudar={setAno} />
      </div>

      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo={`Dotação atualizada ${ano}`}
          valor={reaisCompacto(totalDoAno.dotacao)}
          nota="o que a lei autorizou gastar"
        />
        <Kpi
          rotulo="Empenhado"
          valor={reaisCompacto(totalDoAno.empenhado)}
          nota={taxaEmpenho ? `${porcento(taxaEmpenho, 0)} da dotação` : undefined}
        />
        <Kpi
          rotulo="Liquidado"
          valor={reaisCompacto(totalDoAno.liquidado)}
          variacao={varLiquidado}
          nota={taxaExecucao ? `${porcento(taxaExecucao, 0)} da dotação` : undefined}
          destaque
        />
        <Kpi
          rotulo="Pago"
          valor={reaisCompacto(pagoTotal || null)}
          nota="inclui restos de anos anteriores"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <CartaoTitulo
          titulo="O funil da execução"
          descricao={`Totais do município em ${ano}`}
        >
          <Grafico
            opcao={opcaoFunil}
            altura={260}
            rotulo={`Dotação, empenhado, liquidado e pago em ${ano}`}
          />
          <NotaGrafico>
            O pago pode diferir do liquidado porque parte das despesas liquidadas
            fica em restos a pagar e só sai do caixa no exercício seguinte.
          </NotaGrafico>
        </CartaoTitulo>

        <CartaoTitulo
          titulo="Execução por função"
          descricao="Dotação, empenho e liquidação, lado a lado"
        >
          <Grafico
            opcao={opcaoFuncoes}
            altura={Math.max(300, doAno.length * 26 + 60)}
            rotulo={`Execução orçamentária por função em ${ano}`}
          />
        </CartaoTitulo>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <CartaoTitulo
          titulo="Evolução do funil"
          descricao={`${anos[0]}–${anos[anos.length - 1]}`}
        >
          <Grafico
            opcao={opcaoSerie}
            altura={340}
            rotulo="Evolução de dotação, empenho e liquidação ao longo dos anos"
          />
        </CartaoTitulo>

        <CartaoTitulo titulo="Observações do exercício">
          <ListaDestaques itens={destaques} />
        </CartaoTitulo>
      </div>
    </Secao>
  );
}
