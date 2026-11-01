/**
 * Pessoal — quadro de servidores, remuneração, limites da LRF e busca.
 */

import { useCallback, useMemo, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';

import type { Dados, Servidor } from '../tipos';
import { Grafico } from '../componentes/Grafico';
import {
  CartaoTitulo,
  Kpi,
  ListaDestaques,
  NotaGrafico,
  Secao,
} from '../componentes/blocos';
import { inteiro, porcento, reais, reaisCompacto } from '../lib/formato';
import { baseGrafico, eixoCategoria, eixoValor } from '../lib/tema';
import type { TemaGrafico } from '../lib/tema';

const POR_PAGINA = 25;

export function Pessoal({ d }: { d: Dados }) {
  const anos = d.meta.anos;
  const ultimo = anos[anos.length - 1] ?? 2025;

  const pessoal = d.indicadores.pessoal_rcl;
  const quadro = d.servidores.quadro['prefeitura'] ?? {};

  // O detalhamento por vínculo (quantidade e remuneração média) só existe
  // para o exercício corrente — é o cadastro publicado no portal, não uma
  // série histórica. Usar `ultimo` (2025) aqui deixaria os gráficos vazios.
  const anoQuadro = useMemo(() => {
    const chaves = Object.keys(quadro).sort();
    return chaves[chaves.length - 1] ?? null;
  }, [quadro]);

  const ativos = useMemo(
    () => d.servidores.servidores.filter((s) => s.entidade === 'prefeitura'),
    [d],
  );

  const ativosFiltrados = useMemo(
    () => ativos.filter((s) => s.situacao === 'ATIVO'),
    [ativos],
  );

  /* ---------------- busca ---------------- */

  const [busca, setBusca] = useState('');
  const [vinculo, setVinculo] = useState('');
  const [pagina, setPagina] = useState(0);

  const vinculos = useMemo(() => {
    const set = new Set(ativos.map((s) => s.vinculo).filter(Boolean));
    return Array.from(set).sort();
  }, [ativos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ativosFiltrados.filter((s) => {
      if (vinculo && s.vinculo !== vinculo) return false;
      if (!termo) return true;
      return (
        s.nome.toLowerCase().includes(termo) ||
        s.cargo.toLowerCase().includes(termo) ||
        s.lotacao.toLowerCase().includes(termo)
      );
    });
  }, [ativosFiltrados, busca, vinculo]);

  const paginados = useMemo(
    () => filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA),
    [filtrados, pagina],
  );

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA);

  /* ---------------- limite LRF ---------------- */

  const opcaoLimite = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const anosComDado = anos.filter((a) => pessoal[String(a)]?.dtp_pct_rcl !== null);
      const limite = pessoal[String(ultimo)]?.limite ?? 54;
      const alerta = pessoal[String(ultimo)]?.alerta ?? 48.6;

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
          max: 60,
          splitLine: { lineStyle: { color: t.borda, type: 'dashed' } },
          axisLabel: { color: t.texto3, fontSize: 11, formatter: (v: number) => `${v}%` },
          axisLine: { show: false },
        },
        series: [
          {
            name: 'Despesa com pessoal',
            type: 'line',
            smooth: 0.25,
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: { width: 3 },
            itemStyle: { color: t.positivo },
            areaStyle: { color: t.positivo, opacity: 0.1 },
            data: anosComDado.map((a) => pessoal[String(a)]?.dtp_pct_rcl ?? null),
            markLine: {
              silent: true,
              symbol: 'none',
              label: {
                position: 'insideEndTop',
                color: t.texto3,
                fontSize: 10,
                formatter: (p: unknown) => (p as { name: string }).name,
              },
              lineStyle: { type: 'dashed', width: 1.5 },
              data: [
                {
                  yAxis: limite,
                  name: `Limite legal ${limite}%`,
                  lineStyle: { color: t.negativo },
                  label: { color: t.negativo },
                },
                {
                  yAxis: alerta,
                  name: `Alerta ${alerta.toFixed(0)}%`,
                  lineStyle: { color: t.alerta },
                  label: { color: t.alerta },
                },
              ],
            },
          },
        ],
      };
    },
    [anos, pessoal, ultimo],
  );

  /* ---------------- quadro por vínculo ---------------- */

  // `resumo_natureza` é a série histórica (2020–2026) do quadro por vínculo.
  // `quadro` traz quantidade e remuneração média, mas só do exercício corrente.
  const resumo = d.servidores.resumo_natureza['prefeitura'] ?? {};

  const opcaoQuadro = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const anosComDado = anos.filter((a) => Object.keys(resumo[String(a)] ?? {}).length > 0);
      const naturezas = Array.from(
        new Set(anosComDado.flatMap((a) => Object.keys(resumo[String(a)] ?? {}))),
      );

      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
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
          textStyle: { color: t.texto3, fontSize: 10 },
        },
        xAxis: eixoCategoria(anosComDado.map(String), t),
        yAxis: eixoValor(t, (v) => inteiro(v)),
        series: naturezas.map((nat, i) => ({
          name: nat,
          type: 'bar' as const,
          stack: 'vinculos',
          barMaxWidth: 40,
          itemStyle: {
            color: t.cores[i % t.cores.length],
            ...(i === naturezas.length - 1 ? { borderRadius: [3, 3, 0, 0] as [number, number, number, number] } : {}),
          },
          data: anosComDado.map(
            (a) => (resumo[String(a)] ?? {})[nat] ?? 0,
          ),
        })),
      };
    },
    [anos, resumo],
  );

  /* ---------------- remuneração por vínculo ---------------- */

  const opcaoRemuneracao = useCallback(
    (t: TemaGrafico): EChartsCoreOption => {
      const doAno = (quadro[anoQuadro ?? ''] ?? [])
        .filter((q) => q.media !== null && q.quantidade > 0)
        .sort((a, b) => (b.media ?? 0) - (a.media ?? 0));

      return {
        ...baseGrafico(t),
        grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
        tooltip: {
          ...baseGrafico(t).tooltip,
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (p: unknown) => {
            const arr = p as { dataIndex: number }[];
            const item = doAno[arr[0]?.dataIndex ?? 0];
            if (!item) return '';
            return `<strong>${item.natureza}</strong><br/>Média ${reais(item.media)}<br/>${inteiro(
              item.quantidade,
            )} servidores`;
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
              value: q.media,
              itemStyle: { color: t.cores[i % t.cores.length], borderRadius: [0, 4, 4, 0] },
            })),
            barMaxWidth: 22,
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
      };
    },
    [quadro, ultimo],
  );

  /* ---------------- indicadores ---------------- */

  const dadosUltimo = pessoal[String(ultimo)];
  const totalAtivos = ativosFiltrados.length;

  const destaques = useMemo(() => {
    const itens = [];
    if (dadosUltimo?.dtp_pct_rcl !== null && dadosUltimo?.dtp_pct_rcl !== undefined) {
      const pct = dadosUltimo.dtp_pct_rcl;
      const limite = dadosUltimo.limite;
      const margem = limite - pct;
      itens.push({
        titulo: `Pessoal consome ${porcento(pct)} da RCL`,
        texto: `O limite legal para municípios é ${porcento(limite, 0)}. Restam ${porcento(
          margem,
          1,
        )} de margem — o equivalente a ${reaisCompacto(
          ((dadosUltimo.rcl ?? 0) * margem) / 100,
        )}.`,
        tom: margem < 5 ? ('alerta' as const) : ('positivo' as const),
      });
    }

    const efetivos = (quadro[anoQuadro ?? ''] ?? []).find((q) =>
      q.natureza.toLowerCase().includes('efetivo estatut'),
    );
    if (efetivos && totalAtivos) {
      itens.push({
        titulo: `${porcento((efetivos.quantidade / totalAtivos) * 100, 0)} do quadro é efetivo`,
        texto: `${inteiro(efetivos.quantidade)} servidores estatutários de ${inteiro(
          totalAtivos,
        )} ativos. O restante são comissionados, temporários, estagiários e celetistas.`,
        tom: 'neutro' as const,
      });
    }

    const comissionados = (quadro[anoQuadro ?? ''] ?? []).find((q) =>
      q.natureza.toLowerCase().includes('comissionad'),
    );
    if (comissionados && totalAtivos) {
      itens.push({
        titulo: `${inteiro(comissionados.quantidade)} cargos de confiança`,
        texto: `${porcento(
          (comissionados.quantidade / totalAtivos) * 100,
          1,
        )} do quadro ativo. São nomeações diretas, sem concurso.`,
        tom: 'alerta' as const,
      });
    }

    return itens;
  }, [dadosUltimo, quadro, ultimo, totalAtivos]);

  return (
    <Secao
      id="pessoal"
      numero="Seção 5"
      titulo="Pessoal: quem trabalha no município"
      descricao={
        <>
          Servidores efetivos e comissionados, folha de pagamento e o limite legal
          de gasto com pessoal. Os limites vêm do Relatório de Gestão Fiscal
          (RGF-Anexo 01), calculados sobre a Receita Corrente Líquida.
        </>
      }
    >
      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Servidores ativos"
          valor={inteiro(totalAtivos)}
          nota="Prefeitura, cadastro corrente"
          destaque
        />
        <Kpi
          rotulo="Pessoal / RCL"
          valor={porcento(dadosUltimo?.dtp_pct_rcl)}
          nota={`limite legal ${porcento(dadosUltimo?.limite ?? 54, 0)}`}
        />
        <Kpi
          rotulo="Despesa com pessoal"
          valor={reaisCompacto(dadosUltimo?.dtp_valor ?? null)}
          nota={`RCL de ${reaisCompacto(dadosUltimo?.rcl ?? null)}`}
        />
        <Kpi
          rotulo="Vínculos distintos"
          valor={inteiro(vinculos.length)}
          nota="estatutário, temporário, comissionado…"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <CartaoTitulo
          titulo="Despesa com pessoal × limites da LRF"
          descricao="Percentual da Receita Corrente Líquida"
        >
          <Grafico
            opcao={opcaoLimite}
            altura={320}
            rotulo="Despesa total com pessoal em porcentagem da RCL e limites legais"
          />
          <NotaGrafico>
            Percentual oficial publicado no RGF, calculado sobre a RCL Ajustada.
            Limite para municípios: 54% (LRF, art. 20, III). Alerta a 90% do limite
            e limite prudencial a 95%.
          </NotaGrafico>
        </CartaoTitulo>

        <CartaoTitulo
          titulo="Quadro por vínculo"
          descricao="Quantidade de servidores em cada natureza"
        >
          <Grafico
            opcao={opcaoQuadro}
            altura={320}
            rotulo="Evolução do quadro de servidores por natureza de vínculo"
          />
          <NotaGrafico>
            Série do resumo de natureza do portal municipal, que conta os
            vínculos ativos no mês de referência de cada exercício — não o
            cadastro completo (que inclui desligados). O crescimento de
            &ldquo;Contrato Prazo Determinado&rdquo; e &ldquo;Estagiário&rdquo;
            nos últimos anos é o dado publicado, não um artefato de contagem.
          </NotaGrafico>
        </CartaoTitulo>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <CartaoTitulo
          titulo="Remuneração média por vínculo"
          descricao={`Folha do cadastro corrente (${ultimo})`}
        >
          <Grafico
            opcao={opcaoRemuneracao}
            altura={280}
            rotulo="Remuneração média por natureza de vínculo"
          />
          <NotaGrafico>
            Média das remunerações individuais do cadastro público. Não é a folha
            total: considera apenas quem tem valor publicado.
          </NotaGrafico>
        </CartaoTitulo>

        <CartaoTitulo titulo="Composição do quadro">
          <ListaDestaques itens={destaques} />
        </CartaoTitulo>
      </div>

      {/* Busca de servidores */}
      <CartaoTitulo
        className="mt-5"
        titulo="Busca de servidores"
        descricao="Cadastro público da folha — nome, cargo, vínculo, lotação e remuneração"
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar por nome, cargo ou secretaria…"
            className="entrada max-w-sm flex-1"
            aria-label="Buscar servidores"
          />
          <select
            value={vinculo}
            onChange={(e) => {
              setVinculo(e.target.value);
              setPagina(0);
            }}
            className="entrada max-w-[220px]"
            aria-label="Filtrar por vínculo"
          >
            <option value="">Todos os vínculos</option>
            {vinculos.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {(busca || vinculo) && (
            <button
              type="button"
              onClick={() => {
                setBusca('');
                setVinculo('');
                setPagina(0);
              }}
              className="botao"
            >
              Limpar
            </button>
          )}
        </div>

        <p className="mb-3 text-xs text-texto-3">
          {inteiro(filtrados.length)} servidores encontrados de {inteiro(totalAtivos)} ativos
        </p>

        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Vínculo</th>
                <th>Lotação</th>
                <th>Admissão</th>
                <th className="num">Remuneração</th>
              </tr>
            </thead>
            <tbody>
              {paginados.map((s: Servidor) => (
                <tr key={`${s.nome}-${s.cargo}-${s.admissao}`}>
                  <td className="font-medium">{s.nome}</td>
                  <td className="text-xs">{s.cargo || '—'}</td>
                  <td>
                    <span className="etiqueta etiqueta-neutra">{s.vinculo}</span>
                  </td>
                  <td className="max-w-[220px] truncate text-xs text-texto-3" title={s.lotacao}>
                    {s.lotacao || '—'}
                  </td>
                  <td className="font-mono text-xs text-texto-3">{s.admissao || '—'}</td>
                  <td className="num">{reais(s.remuneracao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              disabled={pagina === 0}
              className="botao disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="font-mono text-xs text-texto-3">
              página {pagina + 1} de {inteiro(totalPaginas)}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
              disabled={pagina >= totalPaginas - 1}
              className="botao disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próxima →
            </button>
          </div>
        )}

        <NotaGrafico>
          A remuneração é o valor do cadastro público no mês de referência, não a
          média anual. Servidores sem valor publicado aparecem com &ldquo;—&rdquo;.
        </NotaGrafico>
      </CartaoTitulo>
    </Secao>
  );
}
