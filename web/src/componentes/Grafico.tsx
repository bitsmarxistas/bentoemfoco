/**
 * Componente de gráfico — encapsula o ciclo de vida do ECharts.
 *
 * Por que um componente e não uma chamada direta em cada lugar:
 *   - instanciar, redimensionar e destruir são passos que se esquece;
 *   - o tema claro/escuro exige reconstruir a opção, não só repintar;
 *   - o gráfico só deve inicializar quando estiver visível, senão o
 *     navegador calcula layout para 20 gráficos fora da tela no carregamento.
 */

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, HeatmapChart, ScatterChart, TreemapChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  DatasetComponent, VisualMapComponent, MarkLineComponent, MarkPointComponent,
  DataZoomComponent, GraphicComponent, AxisPointerComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

import { temaAtual } from '../lib/tema';
import { useTema } from '../contextos/TemaContexto';

echarts.use([
  BarChart, LineChart, PieChart, HeatmapChart, ScatterChart, TreemapChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  DatasetComponent, VisualMapComponent, MarkLineComponent, MarkPointComponent,
  DataZoomComponent, GraphicComponent, AxisPointerComponent,
  CanvasRenderer,
]);

export interface GraficoProps {
  /** Constrói a opção do ECharts. Recebe o tema atual. */
  opcao: (tema: ReturnType<typeof temaAtual>) => EChartsCoreOption;
  /** Altura em pixels (ou classe CSS de altura). */
  altura?: number;
  /** Rótulo de acessibilidade. */
  rotulo: string;
  className?: string;
  /** Chamado quando um elemento do gráfico é clicado. */
  aoClicar?: (params: { name?: string; dataIndex?: number; value?: unknown }) => void;
}

export function Grafico({ opcao, altura = 320, rotulo, className = '', aoClicar }: GraficoProps) {
  const referencia = useRef<HTMLDivElement | null>(null);
  const instancia = useRef<echarts.ECharts | null>(null);
  const { tema } = useTema();
  const [visivel, setVisivel] = useState(false);

  // Inicializa só quando o gráfico entra na viewport.
  useEffect(() => {
    const el = referencia.current;
    if (!el) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisivel(true);
          observador.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // Cria, atualiza e destrói a instância.
  useEffect(() => {
    if (!visivel) return;
    const el = referencia.current;
    if (!el) return;

    if (!instancia.current) {
      instancia.current = echarts.init(el, null, { renderer: 'canvas' });
    }

    const t = temaAtual();
    instancia.current.setOption(opcao(t), { notMerge: true });

    // Um gráfico inicializado antes de o layout assentar fica com a largura
    // que o contêiner tinha naquele instante. Reforçar o resize no próximo
    // frame corrige isso — e é barato, porque o ECharts já sabe se mudou.
    const quadros: number[] = [];
    quadros.push(
      requestAnimationFrame(() => {
        instancia.current?.resize();
      }),
    );

    if (aoClicar) {
      instancia.current.off('click');
      instancia.current.on('click', aoClicar as never);
    }

    const redimensiona = () => instancia.current?.resize();
    const observador = new ResizeObserver(redimensiona);
    observador.observe(el);

    return () => {
      for (const q of quadros) cancelAnimationFrame(q);
      observador.disconnect();
    };
    // `tema` entra na lista para reconstruir o gráfico ao trocar de tema.
    // `opcao` é recriada a cada render pelo chamador; usar o tema como
    // dependência evita reconstruções desnecessárias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, tema, opcao]);

  // Destrói ao desmontar.
  useEffect(
    () => () => {
      instancia.current?.dispose();
      instancia.current = null;
    },
    [],
  );

  return (
    <div
      ref={referencia}
      className={`w-full ${className}`}
      style={{ height: altura }}
      role="img"
      aria-label={rotulo}
    />
  );
}
