// How the writing page looks on this device: text size, line spacing, page width, font and paper colour.
// Kept in the browser's storage, so the iPad and the desktop can each have their own.

export interface PageLook {
  size: 'small' | 'medium' | 'large' | 'huge';
  spacing: 'tight' | 'normal' | 'loose';
  width: 'narrow' | 'normal' | 'wide';
  font: 'serif' | 'sans' | 'readable' | 'typewriter';
  paper: 'white' | 'cream' | 'dark';
  /** Character, place and item names underlined in their colour. */
  names: 'on' | 'off';
}

export const DEFAULT_LOOK: PageLook = { size: 'medium', spacing: 'normal', width: 'normal', font: 'serif', paper: 'white', names: 'on' };

/** The choices for each setting, in the order the Page panel shows them, with the words on their buttons. */
export const LOOK_CHOICES: { key: keyof PageLook; label: string; options: [string, string][] }[] = [
  { key: 'size', label: 'Text size', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['huge', 'Huge']] },
  { key: 'spacing', label: 'Line spacing', options: [['tight', 'Tight'], ['normal', 'Normal'], ['loose', 'Loose']] },
  { key: 'width', label: 'Page width', options: [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']] },
  { key: 'font', label: 'Font', options: [['serif', 'Book (Georgia)'], ['sans', 'Plain'], ['readable', 'Easy to read (Verdana)'], ['typewriter', 'Typewriter (Space Mono)']] },
  { key: 'paper', label: 'Paper', options: [['white', 'Theme colour'], ['cream', 'Cream'], ['dark', 'Dark']] },
  { key: 'names', label: 'Names of characters, places and items', options: [['on', 'Light up'], ['off', 'Plain']] }
];

const KEY = 'story-forge.page-look';

export function cleanLook(v: unknown): PageLook {
  const out: PageLook = { ...DEFAULT_LOOK };
  if (!v || typeof v !== 'object') return out;
  LOOK_CHOICES.forEach((c) => {
    const x = (v as Record<string, unknown>)[c.key];
    if (typeof x === 'string' && c.options.some((o) => o[0] === x)) (out as unknown as Record<string, string>)[c.key] = x;
  });
  return out;
}

export function loadLook(): PageLook {
  try { return cleanLook(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { return DEFAULT_LOOK; }
}

export function saveLook(l: PageLook): void {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* lasts until reload */ }
}

const SIZES = { small: '1.05rem', medium: '1.2rem', large: '1.4rem', huge: '1.65rem' };
const LINES = { tight: '1.45', normal: '1.7', loose: '2' };
const WIDTHS = { narrow: '36rem', normal: '44rem', wide: '58rem' };
const FONTS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  readable: 'Verdana, "Atkinson Hyperlegible", Tahoma, sans-serif',
  typewriter: '"Space Mono", ui-monospace, Menlo, monospace'
};

/** The CSS variables the writing page reads. */
export function lookStyle(l: PageLook): Record<string, string> {
  return { '--page-size': SIZES[l.size], '--page-line': LINES[l.spacing], '--page-width': WIDTHS[l.width], '--page-font': FONTS[l.font] };
}
