/**
 * Câmara de Vereadores — o legislativo municipal em números.
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
import { inteiro, porcento, reais, reaisCompacto } from '../lib/formato';
import { valor } from '../lib/calculos';
import { baseGrafico, eixoCategoria, eixoMilhoes, eixoValor } from '../lib/tema';
import type { TemaGrafico } from '../lib/tema';

export function Camara({ d }: { d: Dados }) {
  const anos = d.meta.anos;
  const ultimo = anos[anos.length - 1] ?? 2025;

  const pagamentos = d.pagamentos.por_entidade['camara'] ?? {};
  // O detalhamento por vínculo (`quadro`) só existe para o exercício corrente;
  // `resumo_natureza` tem a série histórica. Usar o primeiro aqui deixaria o
  // gráfico vazio para os anos fechados.
  const resumoCamara = d.servidores.resumo_natureza['camara'] ?? {};
  const anoQuadroCamara = useMemo(() => {
    const chaves = Object.keys(resumoCamara).sort();
    return chaves[chaves.length - 1] ?? null;
  }, [resumoCamara]);

  const servidoresCamara = useMemo(
    () => d.servidores.servidores.filter((s) => s.entidade === 'camara'),
    [d],
  );

  const totalPrefeitura = valor(d.execucao.totais[String(ultimo)], 'liquidado');
  const totalCamara = useMemo(() => {
    const funcao = d.execucao.funcoes.find((f) => f.cod === 1);
    return valor(funcao?.valores[String(ultimo)], 'liquidado');
  }, [d, ultimo]);

  /* ---------------- pagamentos por ano ---------------- */

  const opcaoPagamentos = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const anosComDado = anos.filter((a) => pagamentos[String(a)]);
      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
        tooltip: {
          ...baseGrafico(t).tooltip,
          trigger: 'axis',
          valueFormatter: (v: unknown) => reaisCompacto(typeof v === 'number' ? v : null),
        },
        xAxis: eixoCategoria(anosComDado.map(String), t),
        yAxis: eixoValor(t, eixoMilhoes),
        series: [
          {
            type: 'bar',
            data: anosComDado.map((a) => pagamentos[String(a)]?.total ?? null),
            itemStyle: { color: t.cores[2], borderRadius: [4, 4, 0, 0] },
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
      };
    },
    [anos, pagamentos],
  );

  /* ---------------- quadro ---------------- */

  const opcaoQuadro = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const doAno = Object.entries(resumoCamara[anoQuadroCamara ?? ''] ?? {})
        .map(([natureza, quantidade]) => ({ natureza, quantidade }))
        .filter((q) => q.quantidade > 0)
        .sort((a, b) => b.quantidade - a.quantidade);

      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
        tooltip: {
          ...baseGrafico(t).tooltip,
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
        },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: t.borda, type: 'dashed' } },
          axisLabel: { color: t.texto3, fontSize: 11 },
          axisLine: { show: false },
        },
        yAxis: {
          type: 'category',
          data: doAno.map((q) => q.natureza),
          inverse: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: t.texto3, fontSize: 11 },
        },
        series: [
          {
            type: 'bar',
            data: doAno.map((q, i) => ({
              value: q.quantidade,
              itemStyle: { color: t.cores[i % t.cores.length], borderRadius: [0, 4, 4, 0] },
            })),
            barMaxWidth: 22,
            label: {
              show: true,
              position: 'right',
              color: t.texto3,
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
            },
          },
        ],
      };
    },
    [resumoCamara, anoQuadroCamara],
  );

  /* ---------------- maiores remunerações ---------------- */

  const comissionados = useMemo(
    () =>
      servidoresCamara
        .filter((s) => s.situacao === 'ATIVO' && s.remuneracao !== null)
        .sort((a, b) => (b.remuneracao ?? 0) - (a.remuneracao ?? 0))
        .slice(0, 15),
    [servidoresCamara],
  );

  const opcaoRemuneracoes = useCallback(
    (t: TemaGrafico): EChartsCoreOption => ({
      ...baseGrafico(t),
      grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        ...baseGrafico(t).tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: unknown) => {
          const arr = p as { dataIndex: number }[];
          const s = comissionados[arr[0]?.dataIndex ?? 0];
          if (!s) return '';
          return `<strong>${s.nome}</strong><br/>${s.cargo || 'cargo não informado'}<br/>${
            s.vinculo
          }<br/>${reais(s.remuneracao)}`;
        },
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: t.borda, type: 'dashed' } },
        axisLabel: {
          color: t.texto3,
          fontSize: 11,
          formatter: (v: number) => reaisCompacto(v, 0),
        },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: comissionados.map((s) => s.nome.split(' ').slice(0, 2).join(' ')),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.texto3, fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: comissionados.map((s, i) => ({
            value: s.remuneracao,
            itemStyle: {
              color: t.cores[i % t.cores.length],
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barMaxWidth: 18,
          label: {
            show: true,
            position: 'right',
            formatter: (p: unknown) => reais((p as { value: number }).value, 0),
            color: t.texto3,
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
          },
        },
      ],
    }),
    [comissionados],
  );

  const destaques = useMemo(() => {
    const itens = [];
    const pag = pagamentos[String(ultimo)];

    if (totalCamara && totalPrefeitura) {
      const pct = (totalCamara / totalPrefeitura) * 100;
      itens.push({
        titulo: `A Câmara custa ${porcento(pct, 2)} do orçamento`,
        texto: `${reaisCompacto(totalCamara)} liquidados em ${ultimo}, contra ${reaisCompacto(
          totalPrefeitura,
        )} do Executivo. O teto constitucional para municípios é definido pela Lei Orgânica, geralmente entre 3% e 8% da receita.`,
        tom: 'neutro' as const,
      });
    }

    if (pag) {
      itens.push({
        titulo: `${inteiro(pag.ordens)} ordens de pagamento`,
        texto: `${reaisCompacto(pag.total)} pagos em ${ultimo} para ${inteiro(
          pag.fornecedores_distintos,
        )} fornecedores distintos.`,
        tom: 'neutro' as const,
      });
    }

    const nServidores = servidoresCamara.filter((s) => s.situacao === 'ATIVO').length;
    if (nServidores) {
      itens.push({
        titulo: `${inteiro(nServidores)} servidores ativos`,
        texto: 'Inclui cargos de confiança e efetivos do legislativo municipal.',
        tom: 'neutro' as const,
      });
    }

    return itens;
  }, [pagamentos, ultimo, totalCamara, totalPrefeitura, servidoresCamara]);

  return (
    <Secao
      id="camara"
      numero="Seção 7"
      titulo="Câmara de Vereadores"
      descricao={
        <>
          O legislativo municipal em números: despesa, servidores e processo de
          compras. A função 01-Legislativa é a única do orçamento controlada
          inteiramente pela Câmara.
        </>
      }
    >
      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo={`Despesa liquidada ${ultimo}`}
          valor={reaisCompacto(totalCamara)}
          nota="função 01 · Legislativa"
          destaque
        />
        <Kpi
          rotulo="Pago pela Câmara"
          valor={reaisCompacto(pagamentos[String(ultimo)]?.total ?? null)}
          nota={`${inteiro(pagamentos[String(ultimo)]?.ordens ?? null)} ordens`}
        />
        <Kpi
          rotulo="Servidores ativos"
          valor={inteiro(servidoresCamara.filter((s) => s.situacao === 'ATIVO').length)}
          nota="cadastro corrente"
        />
        <Kpi
          rotulo="Fornecedores"
          valor={inteiro(pagamentos[String(ultimo)]?.fornecedores_distintos ?? null)}
          nota={`atendidos em ${ultimo}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <CartaoTitulo
          titulo="Pagamentos da Câmara por ano"
          descricao="Total efetivamente pago"
        >
          <Grafico
            opcao={opcaoPagamentos}
            altura={300}
            rotulo="Total pago pela Câmara por ano"
          />
          <NotaGrafico>
            Inclui pagamentos de restos a pagar de exercícios anteriores.
          </NotaGrafico>
        </CartaoTitulo>

        <CartaoTitulo
          titulo="Quadro da Câmara por vínculo"
          descricao={`Servidores em ${ultimo}`}
        >
          <Grafico
            opcao={opcaoQuadro}
            altura={300}
            rotulo="Vínculos dos servidores da Câmara"
          />
        </CartaoTitulo>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <CartaoTitulo
          titulo="Maiores remunerações"
          descricao="Servidores ativos com maior remuneração publicada"
        >
          <Grafico
            opcao={opcaoRemuneracoes}
            altura={Math.max(280, comissionados.length * 24 + 30)}
            rotulo="Maiores remunerações da Câmara"
          />
          <NotaGrafico>
            Valores individuais do cadastro público. Cargos de confiança são
            nomeações diretas, sem concurso público.
          </NotaGrafico>
        </CartaoTitulo>

        <CartaoTitulo titulo="Notas sobre o legislativo">
          <ListaDestaques itens={destaques} />
        </CartaoTitulo>
      </div>
    </Secao>
  );
}
