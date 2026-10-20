import { render } from 'preact';
import { App } from './ui/App.tsx';
import './styles.css';
import { startTheme } from './lib/theme.ts';
import { startHoldNames } from './ui/hold.ts';

startTheme();
startHoldNames();

// Opened from the iPad's home screen, the device's clock and battery bar sits over the page, and iPadOS reports no
// safe area for it (Kyle's screenshot, 2026-10-20). Mark that case so the CSS moves the app down below the bar.
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const homeScreen = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
if (ios && homeScreen) document.documentElement.classList.add('ios-app');

render(<App />, document.getElementById('app')!);

// Words waiting on the device must not be cleared when the iPad runs short of space: ask the browser to keep this
// site's storage. It never asks Kyle; the browser decides quietly (Kyle, 2026-10-20).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { /* kept as usual */ });

// The service worker keeps the app's own files, so it opens with no connection. It never caches GitHub.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* the app still works online */ });
}
