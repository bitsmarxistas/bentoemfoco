/**
 * O mapa do gasto — a seção principal.
 *
 * Um mapa de calor mostra o peso de cada subfunção ano a ano; ao lado, a
 * trajetória das maiores e as notas que explicam o que salta aos olhos.
 */

import { useCallback, useMemo, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';

import type { Dados } from '../tipos';
import { Grafico } from '../componentes/Grafico';
import {
  CartaoTitulo,
  ListaDestaques,
  NotaGrafico,
  SeletorMetrica,
  Secao,
  ValorCompacto,
} from '../componentes/blocos';
import { encurta, inteiro, porcento, reaisCompacto } from '../lib/formato';
import {
  concentracao,
  quantosParaCobrir,
  rankingSubfuncoes,
  totalLiquidado,
  valor,
} from '../lib/calculos';
import { baseGrafico, eixoCategoria, eixoMilhoes, eixoValor, interpolaCor } from '../lib/tema';
import type { TemaGrafico } from '../lib/tema';

type Modo = 'pct' | 'rs';
type Recorte = '20' | '30' | 'todos';

export function MapaGasto({ d }: { d: Dados }) {
  const anos = d.meta.anos;
  const [modo, setModo] = useState<Modo>('pct');
  const [recorte, setRecorte] = useState<Recorte>('20');

  const ranking = useMemo(() => rankingSubfuncoes(d, 'liquidado'), [d]);
  const totalPeriodo = useMemo(
    () => anos.reduce((acc, a) => acc + (totalLiquidado(d, a) ?? 0), 0),
    [d, anos],
  );

  const selecionadas = useMemo(() => {
    if (recorte === 'todos') return ranking;
    const n = Number(recorte);
    return ranking.slice(0, n);
  }, [ranking, recorte]);

  /* ---------------- mapa de calor ---------------- */

  const opcaoHeatmap = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      // ECharts desenha heatmap com eixo x = coluna, y = linha.
      // Aqui: x = ano, y = subfunção (invertido para a maior ficar no topo).
      const linhas = [...selecionadas].reverse();

      // Células com cor calculada explicitamente. O `visualMap` do ECharts
      // não coloriu as células no build modular deste projeto, então a escala
      // é aplicada aqui — o que também torna o mapeamento testável.
      const brutos: { ix: number; iy: number; v: number; total: number | null; rotulo: string }[] = [];

      linhas.forEach((item, iy) => {
        anos.forEach((ano, ix) => {
          const v = valor(item.subfuncao.valores[String(ano)], 'liquidado');
          if (v === null) return;
          brutos.push({
            ix,
            iy,
            v,
            total: totalLiquidado(d, ano),
            rotulo: item.subfuncao.rotulo,
          });
        });
      });

      const grandezas = brutos.map((b) =>
        modo === 'pct' ? (b.total ? (b.v / b.total) * 100 : 0) : b.v / 1e6,
      );
      const maximo = Math.max(...grandezas, 1);
      const minimo = Math.min(...grandezas, 0);

      const dados = brutos.map((b, k) => {
        const grandeza = grandezas[k] ?? 0;
        const posicao = maximo > minimo ? (grandeza - minimo) / (maximo - minimo) : 0;
        return {
          value: [b.ix, b.iy, grandeza, b.rotulo],
          itemStyle: { color: interpolaCor(t.calor, posicao) },
        };
      });

      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
        tooltip: {
          ...baseGrafico(t).tooltip,
          formatter: (p: unknown) => {
            const q = p as { data: { value: [number, number, number, string] } };
            const [ix, , grandeza, rotulo] = q.data.value;
            const ano = anos[ix];
            const item = linhas.find((l) => l.subfuncao.rotulo === rotulo);
            const bruto =
              item && ano !== undefined
                ? valor(item.subfuncao.valores[String(ano)], 'liquidado')
                : null;
            return `<strong>${rotulo}</strong><br/>${ano}: ${
              modo === 'pct' ? porcento(grandeza, 1) : reaisCompacto(bruto)
            }<br/><span style="opacity:.65">${reaisCompacto(bruto)} liquidados</span>`;
          },
        },
        xAxis: {
          type: 'category',
          data: anos.map(String),
          axisLine: { lineStyle: { color: t.borda } },
          axisTick: { show: false },
          axisLabel: { color: t.texto3, fontSize: 11 },
          splitArea: { show: false },
        },
        yAxis: {
          type: 'category',
          data: linhas.map((l) => encurta(l.subfuncao.rotulo, 38)),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: t.texto3, fontSize: 10.5 },
        },
        series: [
          {
            type: 'heatmap',
            data: dados,
            itemStyle: { borderColor: t.superficie, borderWidth: 1.5, borderRadius: 3 },
            emphasis: {
              itemStyle: { borderColor: t.texto, borderWidth: 2 },
            },
          },
        ],
        // Legenda da escala, desenhada à mão porque o visualMap não foi usado.
        // A paleta vai do claro (menos) ao escuro (mais).
        graphic: [
          {
            type: 'group',
            left: 'center',
            bottom: 0,
            children: [
              {
                type: 'text',
                style: { text: 'menos', fill: t.texto3, fontSize: 10 },
                left: -150,
                top: 0,
              },
              ...t.calor.map((c, i) => ({
                type: 'rect' as const,
                shape: { width: 30, height: 9 },
                style: { fill: c },
                left: -105 + i * 30,
                top: 0,
              })),
              {
                type: 'text',
                style: { text: 'mais', fill: t.texto3, fontSize: 10 },
                left: 100,
                top: 0,
              },
            ],
          },
        ],
      };
    },
    [anos, d, modo, selecionadas],
  );

  /* ---------------- séries das maiores ---------------- */

  const top10 = useMemo(() => ranking.slice(0, 10), [ranking]);

  const opcaoSeries = useCallback(
    (t: TemaGrafico): EChartsCoreOption => ({
      ...baseGrafico(t),
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      tooltip: {
        ...baseGrafico(t).tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.borda } },
        valueFormatter: (v: unknown) => reaisCompacto(typeof v === 'number' ? v : null),
      },
      xAxis: eixoCategoria(anos.map(String), t),
      yAxis: eixoValor(t, eixoMilhoes),
      series: top10.map((item, i) => ({
        name: item.subfuncao.rotulo,
        type: 'line' as const,
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: i < 3 ? 2.5 : 1.5 },
        itemStyle: { color: t.cores[i % t.cores.length] },
        emphasis: { focus: 'series' as const },
        data: anos.map((a) => {
          const v = valor(item.subfuncao.valores[String(a)], 'liquidado');
          return v === null ? null : Math.round(v);
        }),
      })),
    }),
    [anos, top10],
  );

  /* ---------------- destaques ---------------- */

  const destaques = useMemo(() => {
    const total2025 = totalLiquidado(d, 2025) ?? 0;
    const maior = ranking[0];
    const top4 = concentracao(ranking.map((r) => r.total), 4);
    const top10pct = concentracao(ranking.map((r) => r.total), 10);
    const para80 = quantosParaCobrir(ranking.map((r) => r.total), 80);

    // Subfunção que mais cresceu no período (com base mínima para não pegar ruído).
    const crescimentos = ranking
      .filter((r) => {
        const inicial = valor(r.subfuncao.valores[String(anos[0])], 'liquidado');
        return inicial !== null && inicial > 1_000_000;
      })
      .map((r) => {
        const inicial = valor(r.subfuncao.valores[String(anos[0])], 'liquidado');
        const final = valor(r.subfuncao.valores[String(anos[anos.length - 1])], 'liquidado');
        return {
          rotulo: r.subfuncao.rotulo,
          variacao: inicial && final ? ((final - inicial) / inicial) * 100 : null,
        };
      })
      .filter((x): x is { rotulo: string; variacao: number } => x.variacao !== null)
      .sort((a, b) => b.variacao - a.variacao);

    const itens = [];

    if (maior) {
      const v2025 = valor(maior.subfuncao.valores['2025'], 'liquidado');
      itens.push({
        titulo: `${maior.subfuncao.rotulo} lidera com folga`,
        texto: `R$ ${reaisCompacto(v2025)} liquidados em 2025 — ${
          total2025 ? porcento((v2025 ?? 0) / total2025 * 100) : '—'
        } de todo o orçamento. Vale mais que Ensino Fundamental e Educação Infantil somados.`,
        tom: 'alerta' as const,
      });
    }

    itens.push({
      titulo: 'Concentração alta',
      texto: `As 4 maiores subfunções somam ${porcento(top4)} do gasto acumulado e as 10 maiores, ${porcento(
        top10pct,
      )}. Apenas ${para80} subfunções cobrem 80% de tudo.`,
      tom: 'alerta' as const,
    });

    const primeiro = crescimentos[0];
    if (primeiro) {
      itens.push({
        titulo: `${primeiro.rotulo} é o maior crescimento`,
        texto: `${porcento(primeiro.variacao)} entre ${anos[0]} e ${
          anos[anos.length - 1]
        }, entre as subfunções com base acima de R$ 1 milhão.`,
        tom: 'negativo' as const,
      });
    }

    itens.push({
      titulo: 'Cauda longa existe, mas é pequena',
      texto: `Das ${d.execucao.subfuncoes.length} subfunções monitoradas, as ${
        ranking.filter((r) => r.total < 1_000_000).length
      } menores somam menos de 1% do total. Elas não são omitidas: aparecem todas em "Todas".`,
      tom: 'neutro' as const,
    });

    return itens;
  }, [d, ranking, anos]);

  return (
    <Secao
      id="mapa"
      numero="Seção 1"
      titulo="O mapa do gasto"
      descricao={
        <>
          Cada linha é uma subfunção — o detalhe dentro da área de gasto — e cada
          coluna, um exercício. A cor mostra o peso no orçamento daquele ano.
          Passe o mouse para ver os valores.
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SeletorMetrica<Modo>
          rotulo="Mostrar"
          opcoes={[
            { valor: 'pct', rotulo: '% do total do ano' },
            { valor: 'rs', rotulo: 'R$ milhões' },
          ]}
          valor={modo}
          aoMudar={setModo}
        />
        <SeletorMetrica<Recorte>
          rotulo="Subfunções"
          opcoes={[
            { valor: '20', rotulo: 'Top 20' },
            { valor: '30', rotulo: 'Top 30' },
            { valor: 'todos', rotulo: `Todas (${d.execucao.subfuncoes.length})` },
          ]}
          valor={recorte}
          aoMudar={setRecorte}
        />
      </div>

      <div className="cartao-pad">
        <Grafico
          opcao={opcaoHeatmap}
          altura={Math.max(320, selecionadas.length * 22 + 90)}
          rotulo="Mapa de calor do peso de cada subfunção no orçamento, por ano"
        />
        <NotaGrafico>
          A soma das subfunções fecha exatamente com o total do relatório em todos
          os exercícios (divergência de R$ 0,00). A subfunção
          &ldquo;Demais Subfunções&rdquo; é um agregado residual do próprio RREO,
          não uma subfunção oficial.
        </NotaGrafico>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <CartaoTitulo
          titulo="As 10 maiores subfunções"
          descricao="Despesa liquidada, em reais correntes"
        >
          <Grafico
            opcao={opcaoSeries}
            altura={380}
            rotulo="Séries históricas das dez maiores subfunções"
          />
        </CartaoTitulo>

        <CartaoTitulo titulo="O que salta aos olhos">
          <ListaDestaques itens={destaques} />
        </CartaoTitulo>
      </div>

      {/* Tabela das maiores, para quem prefere número a cor. */}
      <div className="mt-5 cartao-pad overflow-x-auto">
        <h3 className="mb-3 font-serif text-base font-semibold">
          Ranking por subfunção
        </h3>
        <table className="tabela">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Subfunção</th>
              <th>Função</th>
              {anos.map((a) => (
                <th key={a} className="num">
                  {a}
                </th>
              ))}
              <th className="num">Acumulado</th>
              <th className="num">% total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.slice(0, 25).map((item, i) => (
              <tr key={`${item.subfuncao.cod_funcao}-${item.subfuncao.cod}`}>
                <td className="num text-texto-3">{i + 1}</td>
                <td className="font-medium">{item.subfuncao.rotulo}</td>
                <td className="text-xs text-texto-3">
                  {String(item.subfuncao.cod_funcao).padStart(2, '0')} ·{' '}
                  {item.subfuncao.nome_funcao}
                </td>
                {anos.map((a) => (
                  <td key={a} className="num">
                    {reaisCompacto(valor(item.subfuncao.valores[String(a)], 'liquidado'), 1)}
                  </td>
                ))}
                <td className="num font-semibold">
                  {reaisCompacto(item.total, 1)}
                </td>
                <td className="num text-texto-2">
                  {totalPeriodo ? porcento((item.total / totalPeriodo) * 100) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <NotaGrafico>
          Exibindo as 25 maiores de {inteiro(d.execucao.subfuncoes.length)}{' '}
          subfunções. O acumulado cobre {anos[0]}–{anos[anos.length - 1]}:{' '}
          <ValorCompacto v={totalPeriodo} /> no total.
        </NotaGrafico>
      </div>
    </Secao>
  );
}
