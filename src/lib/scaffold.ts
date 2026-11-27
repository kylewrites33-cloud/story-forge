// The book's scaffold page in the writing screen's Scaffold pane (Kyle, 2026-11-27: "fold the quest declined 3 scaffold
// ... into the sparrow app ... stretch to cover the whole right half of the ipad screen"). The page is the vault's own
// `Scaffold page.html`, shown as it is inside a sealed frame; the app only adds its colours on top and tells the page
// which chapter is open (the page's `openCh` hook, written by the potentials skill).

/** The app's colours the page takes on, so the pane matches the theme (dark themes stay quiet). */
export interface ScaffoldColours { paper: string; ink: string; soft: string; rule: string; fill: string }

const safe = (v: string) => v.replace(/[<>;{}]/g, '').trim();

/** The page to put in the frame: the vault's page, then the app's colours. The page's own "Black on white" button is
 * for the phone; in the app the theme decides, so it is hidden. */
export function scaffoldDoc(html: string, c: ScaffoldColours | null): string {
  const vars = c
    ? ':root:root{--paper:' + safe(c.paper) + ';--ink:' + safe(c.ink) + ';--soft:' + safe(c.soft) + ';--rule:' + safe(c.rule) + ';--fill:' + safe(c.fill) + '}'
    : '';
  const head = /<head[^>]*>/i.test(html) ? '' : '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
  return head + html + '\n<style>' + vars + '#invert{display:none}body{padding-top:8px}</style>';
}

/** The message that opens a chapter's card in the page. */
export function chapterMessage(chapter: number): { sparrowChapter: number } {
  return { sparrowChapter: chapter };
}
