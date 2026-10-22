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
// Some iPads put the app below the bar instead (Kyle's screenshot, 2026-10-22): then the window is shorter than the
// screen and no room is kept for it.
// In split view or a window, the iPad puts its window button (•••) over the app's top left corner and reports no safe
// area for it either (Kyle's screenshot, 2026-10-22): mark that case so the CSS moves the sidebar down below it.
function screenSize(): { w: number; h: number } {
  const turn = (screen as { orientation?: { type?: string } }).orientation;
  const wide = turn && turn.type ? turn.type.indexOf('landscape') === 0 : Math.abs(Number((window as { orientation?: number }).orientation) || 0) === 90;
  const long = Math.max(screen.width, screen.height), short = Math.min(screen.width, screen.height);
  return wide ? { w: long, h: short } : { w: short, h: long };
}
function markIosApp(): void {
  const s = screenSize();
  const app = ios && homeScreen;
  const full = window.innerWidth >= s.w - 2;
  document.documentElement.classList.toggle('ios-app', app && full && window.innerHeight >= s.h - 2);
  document.documentElement.classList.toggle('ios-window', app && (!full || window.innerHeight < s.h - 48));
}
markIosApp();
window.addEventListener('resize', markIosApp);

render(<App />, document.getElementById('app')!);

// Words waiting on the device must not be cleared when the iPad runs short of space: ask the browser to keep this
// site's storage. It never asks Kyle; the browser decides quietly (Kyle, 2026-10-20).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { /* kept as usual */ });

// The service worker keeps the app's own files, so it opens with no connection. It never caches GitHub.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* the app still works online */ });
}
