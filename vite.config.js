import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    open: true,
    port: 5173,
    host: true
  },
  build: {
    target: 'esnext',
    outDir: 'dist'
  }
});
