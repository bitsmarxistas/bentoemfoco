/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-tema="escuro"]'],
  theme: {
    extend: {
      colors: {
        // Paleta editorial: papel quente, tinta escura, acentos dessaturados.
        tela: 'var(--cor-tela)',
        superficie: 'var(--cor-superficie)',
        'superficie-2': 'var(--cor-superficie-2)',
        borda: 'var(--cor-borda)',
        'borda-forte': 'var(--cor-borda-forte)',
        texto: 'var(--cor-texto)',
        'texto-2': 'var(--cor-texto-2)',
        'texto-3': 'var(--cor-texto-3)',
        acento: 'var(--cor-acento)',
        'acento-suave': 'var(--cor-acento-suave)',
        positivo: 'var(--cor-positivo)',
        'positivo-suave': 'var(--cor-positivo-suave)',
        negativo: 'var(--cor-negativo)',
        'negativo-suave': 'var(--cor-negativo-suave)',
        alerta: 'var(--cor-alerta)',
        'alerta-suave': 'var(--cor-alerta-suave)',
      },
      fontFamily: {
        serif: ['Fraunces', 'Iowan Old Style', 'Georgia', 'serif'],
        sans: ['Inter', 'SF Pro Text', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1.35' }],
      },
      borderRadius: {
        cartao: '14px',
        controle: '9px',
      },
      boxShadow: {
        cartao: '0 1px 2px rgba(26,26,23,.05), 0 8px 24px -12px rgba(26,26,23,.16)',
      },
      maxWidth: {
        conteudo: '1440px',
      },
      transitionTimingFunction: {
        suave: 'cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
};
