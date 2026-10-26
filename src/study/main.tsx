// The Character study app (2026-10-26): its own page beside Sparrow, at character-study/. Same key and colours as Sparrow.
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
