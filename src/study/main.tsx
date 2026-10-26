// Crow (2026-10-26; first called Character Study): the character and plot study app, its own page and home-screen icon
// beside Sparrow at crow/. Same colours as Sparrow; its own key when it runs from its own icon.
import { render } from 'preact';
import '../styles.css';
import './study.css';
import { startTheme } from '../lib/theme.ts';
import { StudyApp } from './StudyApp.tsx';

startTheme();
// Opened from the iPad's home screen, the clock bar sits over the page (as in Sparrow's main.tsx).
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const homeScreen = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
document.documentElement.classList.toggle('cs-clock', ios && homeScreen);

render(<StudyApp />, document.getElementById('app')!);

// Sparrow's service worker (one for the whole site) keeps Crow's page and files too, so Crow opens offline from its icon.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => { /* Crow still works online */ });
}
