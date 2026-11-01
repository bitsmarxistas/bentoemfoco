/**
 * Paleta e tema dos gráficos.
 *
 * As cores dos gráficos vêm das mesmas variáveis CSS da interface, para que
 * a troca de tema claro/escuro não exija redesenhar nada à mão.
 */

export interface TemaGrafico {
  texto: string;
  texto2: string;
  texto3: string;
  borda: string;
  superficie: string;
  escuro: boolean;
  cores: string[];
  calor: string[];
  positivo: string;
  negativo: string;
  alerta: string;
  acento: string;
}

/** Lê uma variável CSS do documento. */
function css(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

/** Monta o tema atual a partir das variáveis CSS. */
export function temaAtual(): TemaGrafico {
  const escuro = document.documentElement.dataset.tema === 'escuro';
  return {
    texto: css('--cor-texto') || (escuro ? '#F2F0E9' : '#1A1A17'),
    texto2: css('--cor-texto-2') || (escuro ? '#B5B0A3' : '#57534A'),
    texto3: css('--cor-texto-3') || (escuro ? '#8A8578' : '#857F72'),
    borda: css('--cor-borda') || (escuro ? '#33322B' : '#E5E1D8'),
    superficie: css('--cor-superficie') || (escuro ? '#1D1D1A' : '#FFFFFF'),
    escuro,
    cores: escuro
      ? ['#8FB6D9', '#E0B05A', '#C9A6E8', '#7FC49A', '#E89490', '#B0A2EE',
         '#D9C27A', '#8FC7C7', '#C7A98F', '#A8C48A']
      : ['#1F5F9E', '#96610A', '#5B4B9E', '#1F6B3A', '#9B2C2C', '#4E5C7A',
         '#7A5C3E', '#3E7A7A', '#6B4E3E', '#4E7A3E'],
    calor: escuro
      ? ['#1F2E23', '#2A4032', '#3A5A42', '#52806A', '#6FA88C', '#8FCDA8', '#B8E8C8']
      : ['#F7F6F3', '#F5E6D3', '#EFD0B4', '#E5B08C', '#D4845F', '#B85438', '#8E2B1D'],
    positivo: css('--cor-positivo') || '#1F6B3A',
    negativo: css('--cor-negativo') || '#9B2C2C',
    alerta: css('--cor-alerta') || '#96610A',
    acento: css('--cor-acento') || '#1F6B3A',
  };
}

/** Cor da paleta por índice, com volta circular e nunca indefinida. */
export function cor(paleta: string[], i: number, alternativa = '#888888'): string {
  if (!paleta.length) return alternativa;
  return paleta[((i % paleta.length) + paleta.length) % paleta.length] ?? alternativa;
}

/** Converte "#RRGGBB" em [r, g, b]. */
function paraRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Interpola uma cor numa escala contínua.
 *
 * Existe porque o `visualMap` do ECharts não coloriu as células no build
 * modular usado aqui. Calcular a cor explicitamente é mais previsível e
 * permite testar o mapeamento sem depender do renderizador.
 *
 * @param escala Lista de cores, do valor mínimo ao máximo.
 * @param t      Posição normalizada em [0, 1].
 */
export function interpolaCor(escala: string[], t: number): string {
  if (!escala.length) return '#888888';
  if (escala.length === 1) return escala[0] ?? '#888888';

  const pos = Math.min(Math.max(t, 0), 1) * (escala.length - 1);
  const i = Math.min(Math.floor(pos), escala.length - 2);
  const fracao = pos - i;

  const a = paraRgb(escala[i] ?? '#888888');
  const b = paraRgb(escala[i + 1] ?? '#888888');
  const mistura = a.map((v, k) => Math.round(v + ((b[k] ?? v) - v) * fracao));

  return `rgb(${mistura[0]}, ${mistura[1]}, ${mistura[2]})`;
}

/** Base comum a todos os gráficos: tipografia, grid, tooltip. */
export function baseGrafico(t: TemaGrafico) {
  return {
    textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: t.texto },
    grid: { left: 8, right: 20, top: 34, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: t.escuro ? '#2A2A27' : '#FFFFFF',
      borderColor: t.borda,
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: t.texto, fontSize: 12 },
      extraCssText:
        'box-shadow:0 4px 16px rgba(0,0,0,.14);border-radius:9px;max-width:320px;',
    },
  };
}

/** Eixo de categoria. */
export function eixoCategoria(dados: (string | number)[], t: TemaGrafico) {
  return {
    type: 'category' as const,
    data: dados,
    axisLine: { lineStyle: { color: t.borda } },
    axisTick: { show: false },
    axisLabel: { color: t.texto3, fontSize: 11 },
  };
}

/** Eixo de valor com formatador opcional. */
export function eixoValor(
  t: TemaGrafico,
  formatador?: (v: number) => string,
) {
  return {
    type: 'value' as const,
    splitLine: { lineStyle: { color: t.borda, type: 'dashed' as const } },
    axisLabel: {
      color: t.texto3,
      fontSize: 11,
      formatter: formatador ?? ((v: number) => String(v)),
    },
    axisLine: { show: false },
  };
}

/** Formata milhões para o eixo. */
export function eixoMilhoes(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)} bi`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)} mi`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)} mil`;
  return String(v);
}

/** Formata percentual para o eixo. */
export function eixoPorcento(v: number): string {
  return `${v.toFixed(0)}%`;
}
