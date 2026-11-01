/**
 * Compras, contratos e fornecedores — quem recebeu o dinheiro do município.
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
import { encurta, inteiro, MESES, porcento, reaisCompacto } from '../lib/formato';
import { baseGrafico, eixoCategoria, eixoMilhoes, eixoValor } from '../lib/tema';
import type { TemaGrafico } from '../lib/tema';

export function Compras({ d }: { d: Dados }) {
  const anos = d.meta.anos;
  const ultimo = anos[anos.length - 1] ?? 2025;
  const [ano, setAno] = useState(ultimo);

  const pagamento = d.pagamentos.por_entidade['prefeitura']?.[String(ano)];
  const licitacao = d.compras.licitacoes[String(ano)];
  const contrato = d.compras.contratos[String(ano)];

  /* ---------------- maiores fornecedores ---------------- */

  const fornecedores = useMemo(
    () => (pagamento?.top_fornecedores ?? []).slice(0, 15),
    [pagamento],
  );

  const opcaoFornecedores = useCallback(
    (t: TemaGrafico): EChartsCoreOption => ({
      ...baseGrafico(t),
      grid: { left: 8, right: 60, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        ...baseGrafico(t).tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: unknown) => {
          const arr = p as { dataIndex: number }[];
          const i = arr[0]?.dataIndex ?? 0;
          const f = fornecedores[i];
          if (!f) return '';
          return `<strong>${f.nome}</strong><br/>${
            f.documento ? `CNPJ/CPF ${f.documento}<br/>` : ''
          }${reaisCompacto(f.valor)} em ${inteiro(f.ordens)} ordens de pagamento`;
        },
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: t.borda, type: 'dashed' } },
        axisLabel: { color: t.texto3, fontSize: 11, formatter: eixoMilhoes },
        axisLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: fornecedores.map((f) => encurta(f.nome, 34)),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.texto3, fontSize: 10.5 },
      },
      series: [
        {
          type: 'bar',
          data: fornecedores.map((f, i) => ({
            value: f.valor,
            itemStyle: {
              color: t.cores[i % t.cores.length],
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barMaxWidth: 20,
          label: {
            show: true,
            position: 'right',
            formatter: (p: unknown) => reaisCompacto((p as { value: number }).value),
            color: t.texto3,
            fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
          },
        },
      ],
    }),
    [fornecedores],
  );

  /* ---------------- licitações ---------------- */

  const opcaoLicitacoes = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const anosComDado = anos.filter((a) => d.compras.licitacoes[String(a)]);
      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
        tooltip: {
          ...baseGrafico(t).tooltip,
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
        },
        legend: {
          top: 0,
          left: 0,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: t.texto3, fontSize: 10.5 },
        },
        xAxis: eixoCategoria(anosComDado.map(String), t),
        yAxis: eixoValor(t, (v) => inteiro(v)),
        series: [
          {
            name: 'Processos',
            type: 'bar',
            data: anosComDado.map((a) => d.compras.licitacoes[String(a)]?.quantidade ?? null),
            itemStyle: { color: t.cores[0], borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 32,
          },
          {
            name: 'Homologadas',
            type: 'bar',
            data: anosComDado.map(
              (a) => d.compras.licitacoes[String(a)]?.por_situacao['Homologada'] ?? null,
            ),
            itemStyle: { color: t.positivo, borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 32,
          },
        ],
      };
    },
    [anos, d],
  );

  /* ---------------- fluxo de caixa ---------------- */

  const opcaoCaixa = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const anosComDado = anos.filter((a) => d.pagamentos.por_entidade['prefeitura']?.[String(a)]);
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
        xAxis: eixoCategoria(anosComDado.map(String), t),
        yAxis: eixoValor(t, eixoMilhoes),
        series: [
          {
            name: 'Pagamentos do exercício',
            type: 'bar',
            stack: 'total',
            data: anosComDado.map(
              (a) => d.pagamentos.por_entidade['prefeitura']?.[String(a)]?.pagamentos_do_ano ?? null,
            ),
            itemStyle: { color: t.cores[0] },
            barMaxWidth: 40,
          },
          {
            name: 'Restos a pagar',
            type: 'bar',
            stack: 'total',
            data: anosComDado.map(
              (a) => d.pagamentos.por_entidade['prefeitura']?.[String(a)]?.restos_pagar ?? null,
            ),
            itemStyle: { color: t.alerta, borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 40,
          },
        ],
      };
    },
    [anos, d],
  );

  /* ---------------- mensal ---------------- */

  const opcaoMensal = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const porMes = pagamento?.por_mes ?? {};
      const meses = Object.keys(porMes)
        .map(Number)
        .sort((a, b) => a - b);
      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
        tooltip: {
          ...baseGrafico(t).tooltip,
          trigger: 'axis',
          valueFormatter: (v: unknown) => reaisCompacto(typeof v === 'number' ? v : null),
        },
        xAxis: eixoCategoria(meses.map((m) => MESES[m - 1] ?? String(m)), t),
        yAxis: eixoValor(t, eixoMilhoes),
        series: [
          {
            type: 'bar',
            data: meses.map((m) => porMes[String(m)] ?? null),
            itemStyle: { color: t.cores[0], borderRadius: [3, 3, 0, 0] },
            barMaxWidth: 26,
          },
        ],
      };
    },
    [pagamento],
  );

  const destaques = useMemo(() => {
    const itens = [];
    const maior = fornecedores[0];

    if (maior && pagamento?.total) {
      itens.push({
        titulo: `${maior.nome} recebeu ${porcento((maior.valor / pagamento.total) * 100, 1)} do total`,
        texto: `${reaisCompacto(maior.valor)} em ${inteiro(maior.ordens)} ordens de pagamento em ${ano}.`,
        tom: 'alerta' as const,
      });
    }

    const n = fornecedores.length;
    if (n >= 5 && pagamento?.total) {
      const top5 = fornecedores.slice(0, 5).reduce((a, f) => a + f.valor, 0);
      itens.push({
        titulo: `Top 5 concentra ${porcento((top5 / pagamento.total) * 100, 1)}`,
        texto: `Dos ${inteiro(pagamento.fornecedores_distintos)} fornecedores pagos em ${ano}, cinco receberam ${reaisCompacto(top5)}.`,
        tom: 'alerta' as const,
      });
    }

    if (pagamento) {
      itens.push({
        titulo: `${inteiro(pagamento.ordens)} ordens de pagamento`,
        texto: `Média de ${reaisCompacto((pagamento.total ?? 0) / Math.max(pagamento.ordens, 1))} por ordem. ${inteiro(pagamento.ordens_restos)} ordens referem-se a exercícios anteriores.`,
        tom: 'neutro' as const,
      });
    }

    if (licitacao) {
      const homologadas = licitacao.por_situacao['Homologada'] ?? 0;
      itens.push({
        titulo: `${inteiro(licitacao.quantidade)} processos licitatórios`,
        texto: `${inteiro(homologadas)} homologados (${porcento(
          (homologadas / Math.max(licitacao.quantidade, 1)) * 100,
          0,
        )}). Valor máximo estimado: ${reaisCompacto(licitacao.valor_estimado)}.`,
        tom: 'neutro' as const,
      });
    }

    return itens;
  }, [fornecedores, pagamento, licitacao, ano]);

  return (
    <Secao
      id="compras"
      numero="Seção 4"
      titulo="Compras, contratos e fornecedores"
      descricao={
        <>
          Quem recebeu o dinheiro do município, por quais processos licitatórios e
          em que ritmo. Os pagamentos vêm das ordens bancárias publicadas no Portal
          de Transparência.
        </>
      }
    >
      <div className="mb-4">
        <SeletorAno anos={anos} valor={ano} aoMudar={setAno} />
      </div>

      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo={`Pago em ${ano}`}
          valor={reaisCompacto(pagamento?.total ?? null)}
          nota={`${inteiro(pagamento?.ordens ?? null)} ordens`}
          destaque
        />
        <Kpi
          rotulo="Fornecedores distintos"
          valor={inteiro(pagamento?.fornecedores_distintos ?? null)}
          nota="excluindo movimentações internas"
        />
        <Kpi
          rotulo="Processos licitatórios"
          valor={inteiro(licitacao?.quantidade ?? null)}
          nota={licitacao ? `${inteiro(licitacao.por_situacao['Homologada'] ?? 0)} homologados` : undefined}
        />
        <Kpi
          rotulo="Contratos celebrados"
          valor={inteiro(contrato?.quantidade ?? null)}
          nota={contrato ? reaisCompacto(contrato.valor_total) : undefined}
        />
      </div>

      <CartaoTitulo
        titulo="Maiores fornecedores do exercício"
        descricao={`Pagamentos efetuados pela Prefeitura em ${ano}`}
      >
        <Grafico
          opcao={opcaoFornecedores}
          altura={Math.max(300, fornecedores.length * 26 + 30)}
          rotulo={`Maiores fornecedores em ${ano}`}
        />
        <NotaGrafico>
          Pagamentos ao próprio município (movimentações entre contas internas) são
          excluídos do ranking. O total inclui restos a pagar de exercícios
          anteriores.
        </NotaGrafico>
      </CartaoTitulo>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <CartaoTitulo
          titulo="Licitações por ano"
          descricao="Processos abertos e homologados"
        >
          <Grafico
            opcao={opcaoLicitacoes}
            altura={300}
            rotulo="Quantidade de licitações por ano"
          />
        </CartaoTitulo>

        <CartaoTitulo
          titulo="Ritmo do caixa"
          descricao="Pagamentos do exercício e restos de anos anteriores"
        >
          <Grafico
            opcao={opcaoCaixa}
            altura={300}
            rotulo="Pagamentos e restos a pagar por ano"
          />
        </CartaoTitulo>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <CartaoTitulo
          titulo={`Pagamentos mês a mês (${ano})`}
          descricao="Quando o dinheiro saiu do caixa"
        >
          <Grafico
            opcao={opcaoMensal}
            altura={280}
            rotulo={`Pagamentos mensais em ${ano}`}
          />
        </CartaoTitulo>

        <CartaoTitulo titulo="Concentração e ritmo">
          <ListaDestaques itens={destaques} />
        </CartaoTitulo>
      </div>

      {/* Maiores contratados no período */}
      <div className="mt-5 cartao-pad overflow-x-auto">
        <h3 className="mb-3 font-serif text-base font-semibold">
          Maiores contratados no período
        </h3>
        <table className="tabela">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Contratado</th>
              <th>CNPJ/CPF</th>
              <th className="num">Contratos</th>
              <th className="num">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {d.compras.maiores_contratados.slice(0, 20).map((c, i) => (
              <tr key={c.documento ?? c.nome}>
                <td className="num text-texto-3">{i + 1}</td>
                <td className="font-medium">{c.nome}</td>
                <td className="font-mono text-xs text-texto-3">{c.documento ?? '—'}</td>
                <td className="num">{inteiro(c.contratos)}</td>
                <td className="num font-semibold">{reaisCompacto(c.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <NotaGrafico>
          Soma dos contratos celebrados entre {anos[0]} e{' '}
          {anos[anos.length - 1]}. O valor contratado não é o valor pago: o
          pagamento depende da execução do contrato.
        </NotaGrafico>
      </div>
    </Secao>
  );
}
