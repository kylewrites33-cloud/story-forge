// Sparrow Pocket (2026-11-20): the change cards on the phone, its own page beside Sparrow at pocket/. Kyle: "I was
// more thinking of going through the cards and suggesting new cards or tweaks, and maybe rewriting the text"; "lets try
// it with my android phone" (a Bigme HiBreak Pro, a black-and-white E Ink screen). Its own small stylesheet, black on
// white, no colour themes and nothing that moves.
import { render } from 'preact';
import './pocket.css';
import { fromPhoneLink, type Settings } from '../lib/settings.ts';
import { PocketApp } from './Pocket.tsx';

// Opened from the square code in Sparrow's Settings ("Add my phone"): the key rides after `#`. It is taken and wiped
// from the address bar before anything else runs, so it is never in the history, a bookmark or a shared link.
function takeKey(): Settings | null {
  const fromLink = fromPhoneLink(location.hash);
  if (fromLink) history.replaceState(null, '', location.pathname + location.search + '#/');
  return fromLink;
}
let opened = 0;
const show = (fromLink: Settings | null) => render(<PocketApp key={++opened} fromLink={fromLink} />, document.getElementById('app')!);
show(takeKey());
// The same code opened while Pocket is already open in this tab: take that key too, at once.
window.addEventListener('hashchange', () => { const k = takeKey(); if (k) show(k); });

// Sparrow's service worker (one for the whole site) keeps Pocket's page and files too, so it opens offline.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => { /* Pocket still works online */ });
}
