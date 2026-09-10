import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Relative asset paths also work when the site lives in a subdirectory.
  base: './',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': webRoot } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Do not expose desktop sources or user-data through the development server.
    fs: { strict: true, allow: [webRoot] },
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
