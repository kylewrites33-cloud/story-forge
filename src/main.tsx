import { render } from 'preact';
import { App } from './ui/App.tsx';
import './styles.css';
import { startTheme } from './lib/theme.ts';
import { startHoldNames } from './ui/hold.ts';
import { TOP_ROOM_EVENT, loadTopRoom, topRoom } from './lib/topbar.ts';

startTheme();
startHoldNames();

// Opened from the iPad's home screen, the device's clock and battery bar sits over the page, and iPadOS reports no
// safe area for it (Kyle's screenshot, 2026-10-20). Mark that case so the CSS moves the app down below the bar.
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const homeScreen = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
// How much room the top keeps for the clock bar and the window button is judged in src/lib/topbar.ts.
function screenSize(): { w: number; h: number } {
  const turn = (screen as { orientation?: { type?: string } }).orientation;
  const long = Math.max(screen.width, screen.height), short = Math.min(screen.width, screen.height);
  // A window wider than the screen's short side can only be landscape, one taller only portrait; else ask the device.
  const wide = window.innerWidth > short + 2 ? true : window.innerHeight > short + 2 ? false
    : turn && turn.type ? turn.type.indexOf('landscape') === 0 : Math.abs(Number((window as { orientation?: number }).orientation) || 0) === 90;
  return wide ? { w: long, h: short } : { w: short, h: long };
}
let width = 0;
let tallest = 0;
function markIosApp(): void {
  const s = screenSize();
  // A turn or a new split size starts again; the keyboard only ever makes the window shorter.
  if (window.innerWidth !== width) { width = window.innerWidth; tallest = 0; }
  tallest = Math.max(tallest, window.innerHeight);
  const room = topRoom({ app: ios && homeScreen, width, tallest, screenW: s.w, screenH: s.h }, loadTopRoom());
  document.documentElement.classList.toggle('ios-app', room.clockBar);
  document.documentElement.classList.toggle('ios-window', room.windowButton);
}
markIosApp();
window.addEventListener('resize', markIosApp);
window.addEventListener(TOP_ROOM_EVENT, markIosApp);

render(<App />, document.getElementById('app')!);

// Words waiting on the device must not be cleared when the iPad runs short of space: ask the browser to keep this
// site's storage. It never asks Kyle; the browser decides quietly (Kyle, 2026-10-20).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { /* kept as usual */ });

// The service worker keeps the app's own files, so it opens with no connection. It never caches GitHub.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* the app still works online */ });
}
