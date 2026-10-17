import { defineConfig } from 'vite';

// Relative paths, so the same build works at any GitHub Pages address. Preact's JSX through esbuild; no plugin needed.
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { target: 'es2020' }
});
