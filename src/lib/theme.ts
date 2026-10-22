// The app's colours: five light themes and five dark ones, or Match this device (Violet by day, Violet Night by night).
// The colours themselves live in styles.css under [data-theme]; this file names them and remembers the choice per device.
// The dark ones keep their old ids (a saved choice still works) but since 2026-10-22 all wear Violet Night's greys.

export interface Theme {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  /** One short line for the Settings card. */
  line: string;
  /** The page colour, for the browser's top bar. */
  bar: string;
}

export const THEMES: Theme[] = [
  { id: 'violet', name: 'Violet', mode: 'light', line: 'The original: soft grey with violet', bar: '#f6f6f8' },
  { id: 'parchment', name: 'Parchment', mode: 'light', line: 'Warm paper with rust', bar: '#f5f0e6' },
  { id: 'sage', name: 'Sage', mode: 'light', line: 'Pale green with forest green', bar: '#f2f5f1' },
  { id: 'sky', name: 'Sky', mode: 'light', line: 'Cool white with blue', bar: '#f2f6fa' },
  { id: 'rose', name: 'Rose', mode: 'light', line: 'Blush with deep rose', bar: '#faf4f5' },
  { id: 'violet-night', name: 'Violet Night', mode: 'dark', line: 'The original dark: charcoal with violet', bar: '#16151b' },
  { id: 'midnight', name: 'Blue Night', mode: 'dark', line: 'Violet Night\'s charcoal with soft blue', bar: '#12161b' },
  { id: 'forest', name: 'Green Night', mode: 'dark', line: 'Violet Night\'s charcoal with mint green', bar: '#121814' },
  { id: 'ember', name: 'Amber Night', mode: 'dark', line: 'Violet Night\'s charcoal with amber', bar: '#191510' },
  { id: 'ink', name: 'Rose Night', mode: 'dark', line: 'Violet Night\'s charcoal with rose', bar: '#1b1416' }
];

/** Match this device: Violet when the device is light, Violet Night when it is dark. */
export const AUTO = 'auto';

const KEY = 'story-forge.theme';

export function themeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

export function cleanTheme(v: unknown): string {
  return typeof v === 'string' && (v === AUTO || themeById(v)) ? v : AUTO;
}

export function loadTheme(): string {
  try { return cleanTheme(localStorage.getItem(KEY)); } catch { return AUTO; }
}

/** The theme that shows for a choice, given whether the device is set to dark. */
export function resolveTheme(choice: string, deviceDark: boolean): Theme {
  return themeById(choice) || themeById(deviceDark ? 'violet-night' : 'violet')!;
}

const darkQuery = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

/** Puts a choice on the page: data-theme and data-mode on <html>, and the browser bar's colour. */
export function applyTheme(choice: string): void {
  if (typeof document === 'undefined') return;
  const t = resolveTheme(choice, !!darkQuery()?.matches);
  const root = document.documentElement;
  root.dataset.theme = t.id;
  root.dataset.mode = t.mode;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', t.bar);
    m.removeAttribute('media');
  });
}

export function saveTheme(choice: string): void {
  const c = cleanTheme(choice);
  try { localStorage.setItem(KEY, c); } catch { /* lasts until reload */ }
  applyTheme(c);
}

/** At start: show the saved choice, and follow the device when it switches between light and dark. */
export function startTheme(): void {
  applyTheme(loadTheme());
  const q = darkQuery();
  q?.addEventListener?.('change', () => applyTheme(loadTheme()));
}
