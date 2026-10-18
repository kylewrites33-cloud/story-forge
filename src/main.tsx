import { render } from 'preact';
import { App } from './ui/App.tsx';
import './styles.css';
import { startTheme } from './lib/theme.ts';

startTheme();

render(<App />, document.getElementById('app')!);

// The service worker keeps the app's own files, so it opens with no connection. It never caches GitHub.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* the app still works online */ });
}
