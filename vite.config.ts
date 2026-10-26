import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative paths, so the same build works at any GitHub Pages address. Preact's JSX through esbuild; no plugin needed.
// Two pages: Sparrow (index.html) and Crow, the character and plot study app (crow/index.html, 2026-10-26).
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    target: 'es2020',
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), crow: resolve(import.meta.dirname, 'crow/index.html') } }
  }
});
