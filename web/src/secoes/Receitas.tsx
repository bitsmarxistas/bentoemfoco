/**
 * De onde vem o dinheiro — receitas previstas, arrecadadas e sua estrutura.
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
import { MESES, porcento, reaisCompacto } from '../lib/formato';
import { soma, totalLiquidado, variacao } from '../lib/calculos';
import { baseGrafico, cor, eixoCategoria, eixoMilhoes, eixoValor } from '../lib/tema';
import type { TemaGrafico } from '../lib/tema';

/** Grupos de receita que o site mostra, com rótulo legível. */
const GRUPOS_RECEITA = [
  { chave: 'receitas_tributarias', rotulo: 'Tributárias', cor: 0 },
  { chave: 'receitas_transferencias', rotulo: 'Transferências correntes', cor: 1 },
  { chave: 'receitas_contribuicoes', rotulo: 'Contribuições', cor: 2 },
  { chave: 'receitas_patrimoniais', rotulo: 'Patrimoniais', cor: 3 },
  { chave: 'receitas_servicos', rotulo: 'Serviços', cor: 4 },
  { chave: 'receitas_outras', rotulo: 'Outras correntes', cor: 5 },
  { chave: 'receitas_capital', rotulo: 'Receitas de capital', cor: 6 },
] as const;

export function Receitas({ d }: { d: Dados }) {
  const anos = d.meta.anos;
  const ultimo = anos[anos.length - 1] ?? 2025;
  const [ano, setAno] = useState(ultimo);

  const arrecadado = useMemo(() => {
    const t = d.balanco.totais[String(ano)];
    return t?.receita_total ?? d.paineis.totais['receita']?.[String(ano)] ?? null;
  }, [d, ano]);

  const despesa = useMemo(() => totalLiquidado(d, ano), [d, ano]);

  const varReceita = useMemo(() => {
    const i = anos.indexOf(ano);
    if (i <= 0) return null;
    const ant = anos[i - 1];
    if (!ant) return null;
    const anterior =
      d.balanco.totais[String(ant)]?.receita_total ??
      d.paineis.totais['receita']?.[String(ant)] ??
      null;
    return variacao(anterior, arrecadado);
  }, [d, ano, anos, arrecadado]);

  /* ---------------- série de arrecadação ---------------- */

  const opcaoSerie = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const dados = anos.map(
        (a) => d.balanco.totais[String(a)]?.receita_total ?? d.paineis.totais['receita']?.[String(a)] ?? null,
      );
      const despesas = anos.map((a) => totalLiquidado(d, a));

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
            name: 'Receita arrecadada',
            type: 'line',
            smooth: 0.25,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 2.5 },
            itemStyle: { color: t.positivo },
            areaStyle: { color: t.positivo, opacity: 0.08 },
            data: dados,
          },
          {
            name: 'Despesa liquidada',
            type: 'line',
            smooth: 0.25,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 2.5, type: 'dashed' },
            itemStyle: { color: t.negativo },
            data: despesas,
          },
        ],
      };
    },
    [anos, d],
  );

  /* ---------------- estrutura da receita ---------------- */

  const estrutura = useMemo(() => {
    type ItemEstrutura = { nome: string; valor: number; cor: number };

    const itens: ItemEstrutura[] = [];
    for (const g of GRUPOS_RECEITA) {
      const v = d.balanco.receitas[g.chave]?.[String(ano)] ?? null;
      if (v !== null && v > 0) {
        itens.push({ nome: g.rotulo, valor: v, cor: g.cor });
      }
    }

    // Impostos e transferências, base dos pisos constitucionais.
    const trib = d.balanco.receitas['receitas_tributarias']?.[String(ano)] ?? null;
    const transf = d.balanco.receitas['receitas_transferencias']?.[String(ano)] ?? null;
    return { itens, trib, transf };
  }, [d, ano]);

  const opcaoEstrutura = useCallback(
    (t: TemaGrafico): EChartsCoreOption => ({
      ...baseGrafico(t),
      grid: undefined,
      tooltip: {
        ...baseGrafico(t).tooltip,
        formatter: (p: unknown) => {
          const q = p as { name: string; value: number; percent: number };
          return `<strong>${q.name}</strong><br/>${reaisCompacto(q.value)}<br/><span style="opacity:.65">${q.percent.toFixed(1)}% da arrecadação</span>`;
        },
      },
      legend: {
        bottom: 0,
        left: 'center',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: t.texto3, fontSize: 10.5 },
        orient: 'horizontal',
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: t.superficie,
            borderWidth: 2,
            borderRadius: 3,
          },
          label: {
            show: true,
            formatter: '{d}%',
            color: t.texto2,
            fontSize: 10.5,
          },
          labelLine: { length: 8, length2: 6, lineStyle: { color: t.borda } },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold', color: t.texto },
          },
          data: estrutura.itens.map((x) => ({
            name: x.nome,
            value: Math.round(x.valor),
            itemStyle: { color: cor(t.cores, x.cor) },
          })),
        },
      ],
    }),
    [estrutura],
  );

  /* ---------------- arrecadação mensal ---------------- */

  const opcaoMensal = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const serie = d.paineis.series['arrecadacao-despesa']?.[String(ano)];
      const meses = serie ?? [];
      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
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
        xAxis: eixoCategoria(
          meses.map((m) => MESES[m.mes - 1] ?? String(m.mes)),
          t,
        ),
        yAxis: eixoValor(t, eixoMilhoes),
        series: [
          {
            name: 'Arrecadado',
            type: 'bar',
            data: meses.map((m) => m.arrecadado),
            itemStyle: { color: t.positivo, borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 26,
          },
          {
            name: 'Pago',
            type: 'bar',
            data: meses.map((m) => m.pago),
            itemStyle: { color: t.cores[0], borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 26,
          },
        ],
      };
    },
    [d, ano],
  );

  const destaques = useMemo(() => {
    const itens = [];
    const { trib, transf } = estrutura;
    const base = soma([trib, transf]);

    if (trib && base) {
      itens.push({
        titulo: `Impostos próprios: ${porcento((trib / base) * 100, 0)} da base`,
        texto: `IPTU, ISS, ITBI e demais tributos somam ${reaisCompacto(trib)} em ${ano}. Quanto maior a fatia própria, menor a dependência de repasses.`,
        tom: 'positivo' as const,
      });
    }
    if (transf && base) {
      itens.push({
        titulo: `Transferências: ${porcento((transf / base) * 100, 0)} da base`,
        texto: `${reaisCompacto(transf)} vindos de FPM, ICMS e convênios. É a maior fonte de receita da maioria dos municípios brasileiros.`,
        tom: 'neutro' as const,
      });
    }

    if (arrecadado && despesa) {
      const saldo = arrecadado - despesa;
      itens.push({
        titulo: saldo >= 0 ? 'Arrecadação supera a despesa' : 'Despesa supera a arrecadação',
        texto: `${reaisCompacto(Math.abs(saldo))} de ${
          saldo >= 0 ? 'superávit' : 'déficit'
        } entre receita arrecadada e despesa liquidada em ${ano}.`,
        tom: saldo >= 0 ? ('positivo' as const) : ('negativo' as const),
      });
    }

    return itens;
  }, [ano, arrecadado, despesa, estrutura]);

  return (
    <Secao
      id="receitas"
      numero="Seção 3"
      titulo="De onde vem o dinheiro"
      descricao={
        <>
          Impostos próprios, transferências constitucionais e demais receitas — o
          que o município arrecadou de fato e como isso se compara ao que gastou.
        </>
      }
    >
      <div className="mb-4">
        <SeletorAno anos={anos} valor={ano} aoMudar={setAno} />
      </div>

      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo={`Receita arrecadada ${ano}`}
          valor={reaisCompacto(arrecadado)}
          variacao={varReceita}
          destaque
        />
        <Kpi
          rotulo="Tributos próprios"
          valor={reaisCompacto(estrutura.trib)}
          nota="IPTU, ISS, ITBI e taxas"
        />
        <Kpi
          rotulo="Transferências"
          valor={reaisCompacto(estrutura.transf)}
          nota="FPM, ICMS, convênios"
        />
        <Kpi
          rotulo="Resultado"
          valor={reaisCompacto(
            arrecadado !== null && despesa !== null ? arrecadado - despesa : null,
          )}
          nota="arrecadado menos liquidado"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <CartaoTitulo
          titulo="Receita e despesa, lado a lado"
          descricao={`${anos[0]}–${anos[anos.length - 1]}`}
        >
          <Grafico
            opcao={opcaoSerie}
            altura={340}
            rotulo="Evolução da receita arrecadada e da despesa liquidada"
          />
          <NotaGrafico>
            A receita vem do balanço orçamentário (RREO-Anexo 01). A despesa é a
            liquidada por função (RREO-Anexo 02). As duas medidas não fecham
            necessariamente, porque há receitas e despesas intra-orçamentárias.
          </NotaGrafico>
        </CartaoTitulo>

        <CartaoTitulo
          titulo={`Estrutura da arrecadação em ${ano}`}
          descricao="Participação de cada grupo de receita"
        >
          <Grafico
            opcao={opcaoEstrutura}
            altura={340}
            rotulo={`Estrutura da arrecadação em ${ano}`}
          />
        </CartaoTitulo>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <CartaoTitulo
          titulo={`Arrecadação e pagamento, mês a mês (${ano})`}
          descricao="Fluxo de caixa do exercício"
        >
          <Grafico
            opcao={opcaoMensal}
            altura={320}
            rotulo={`Arrecadação e pagamento mensal em ${ano}`}
          />
          <NotaGrafico>
            Série do painel mensal do portal municipal. O pico de arrecadação
            costuma cair em janeiro e julho, e o de pagamento no fim do exercício.
          </NotaGrafico>
        </CartaoTitulo>

        <CartaoTitulo titulo="Composição e equilíbrio">
          <ListaDestaques itens={destaques} />
        </CartaoTitulo>
      </div>
    </Secao>
  );
}
