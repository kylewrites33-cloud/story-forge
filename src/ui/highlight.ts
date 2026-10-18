// Highlights drawn over the page's words with the CSS Custom Highlight API: they never touch the text, the page's HTML or
// the saved Markdown. Where the browser has no such API, nothing is drawn and the lists beside the page do the work.

interface Registry { set: (name: string, h: unknown) => void; delete: (name: string) => void }

function registry(): Registry | null {
  const css = (globalThis as unknown as { CSS?: { highlights?: Registry } }).CSS;
  const H = (globalThis as unknown as { Highlight?: unknown }).Highlight;
  return css && css.highlights && typeof H === 'function' ? css.highlights : null;
}

export function canHighlight(): boolean {
  return registry() != null;
}

/** Draw (or, with no ranges, take away) one named highlight. Its look is `::highlight(<name>)` in styles.css. */
export function paintHighlight(name: string, ranges: Range[]) {
  const reg = registry();
  if (!reg) return;
  if (!ranges.length) { reg.delete(name); return; }
  const H = (globalThis as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight;
  reg.set(name, new H(...ranges));
}

/** Scroll the scrolling page so this range is in view, when it is not already. */
export function bringIntoView(range: Range) {
  const rect = range.getBoundingClientRect();
  const n = range.startContainer;
  const el = (n.nodeType === 3 ? n.parentElement : n) as HTMLElement | null;
  const page = el && el.closest('.writer-page');
  if (!el || !page) return;
  const box = page.getBoundingClientRect();
  // The toolbar sits over the top of the page while it scrolls.
  const tools = page.querySelector('.writer-tools');
  const top = box.top + (tools ? tools.getBoundingClientRect().height : 0) + 8;
  if (rect.top >= top && rect.bottom <= box.bottom - 8) return;
  page.scrollBy({ top: rect.top - top - (box.bottom - top) / 3, behavior: 'smooth' });
}
