import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative paths, so the same build works at any GitHub Pages address. Preact's JSX through esbuild; no plugin needed.
// Three pages: Sparrow (index.html), Crow, the character and plot study app (crow/index.html, 2026-10-26), and Sparrow
// Pocket, the change cards on the phone (pocket/index.html, 2026-11-20).
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: {
    target: 'es2020',
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), crow: resolve(import.meta.dirname, 'crow/index.html'), pocket: resolve(import.meta.dirname, 'pocket/index.html') } }
  }
});
