import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // ECharts é grande e muda raramente: separar em chunk próprio
        // deixa o bundle da aplicação pequeno e cacheável.
        manualChunks: {
          echarts: ['echarts'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
