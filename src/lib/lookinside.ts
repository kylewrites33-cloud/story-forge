// Look inside (Kyle, 2026-11-14, Docs/Sparrow/21 Kindle Plan.md, Build 1 step 5): the Kindle file's own pages shown in
// the app, close to how a Kindle shows them. Made from the same files the download holds (the XHTML and the stylesheet),
// so the preview cannot drift from the file. A Kindle sets the reading font, size, margins and colours itself; here a
// few of its settings are imitated: the screen width, light, sepia or dark, and small or large type. Not exact: the
// exact check is the Kindle app and Amazon's own previewer.
import type { KindlePage } from './kindle.js';

export type Screen = 'kindle' | 'phone' | 'ipad';
export type Paper = 'light' | 'sepia' | 'dark';
export type TypeSize = 'small' | 'large';

/** CSS pixel widths of each reading screen (a 6-inch Kindle, a phone, an iPad held upright). */
export const SCREEN_WIDTH: Record<Screen, number> = { kindle: 400, phone: 375, ipad: 744 };
export const SCREEN_NAME: Record<Screen, string> = { kindle: 'Kindle', phone: 'Phone', ipad: 'iPad' };
const PAPER: Record<Paper, [string, string]> = { light: ['#ffffff', '#1a1a1a'], sepia: ['#f8ecd4', '#4a3a26'], dark: ['#0b0b0b', '#d6d6d6'] };
const SIZE: Record<TypeSize, number> = { small: 16, large: 23 };

const text = (d: string | Uint8Array) => (typeof d === 'string' ? d : new TextDecoder().decode(d));

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The body of an XHTML page, its links to other pages turned into links within the preview. */
function body(xhtml: string): string {
  const m = /<body[^>]*>([\s\S]*)<\/body>/.exec(xhtml);
  return (m ? m[1] : xhtml).replace(/href="([a-z]+\d*)\.xhtml"/g, 'href="#$1"').replace(/<nav epub:type="landmarks"[\s\S]*?<\/nav>/, '');
}

/** The whole book as one page for a sandboxed frame: the cover, then every page in reading order, each starting a new
 * "screen" the way the Kindle starts a new page. */
export function previewDoc(made: { files: { name: string; data: string | Uint8Array }[]; pages: KindlePage[] }, paper: Paper, size: TypeSize): string {
  const file = (n: string) => made.files.find((f) => f.name === 'OEBPS/' + n);
  const css = file('style.css');
  const cover = made.files.find((f) => /^OEBPS\/cover\.(jpg|png)$/.test(f.name));
  const [bg, fg] = PAPER[paper];
  const reader = 'html{background:' + bg + ';}body{margin:0;padding:24px 6%;background:' + bg + ';color:' + fg + ';font-family:Georgia,"Bookerly","Times New Roman",serif;' +
    'font-size:' + SIZE[size] + 'px;line-height:1.5;text-align:justify;-webkit-hyphens:auto;hyphens:auto;}' +
    'a{color:inherit;}.pg{border-top:1px dashed ' + fg + '33;padding-top:1.5em;margin-top:2.5em;}.pg:first-child{border:0;margin:0;padding:0;}' +
    '.cover{text-align:center;}.cover img{max-width:100%;max-height:90vh;}';
  const nav = file('nav.xhtml');
  const out: string[] = [];
  if (cover && typeof cover.data !== 'string') out.push('<div class="pg cover"><img alt="The cover" src="data:image/' + (cover.name.endsWith('png') ? 'png' : 'jpeg') + ';base64,' + base64(cover.data) + '"/></div>');
  let navDone = false;
  made.pages.forEach((p) => {
    if (!navDone && nav && p.kind === 'chapter') { out.push('<div class="pg" id="nav">' + body(text(nav.data)) + '</div>'); navDone = true; }
    out.push('<div class="pg" id="' + p.id + '">' + p.html + '</div>');
  });
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>' + reader + (css ? text(css.data) : '') +
    '</style></head><body>' + out.join('\n') + '</body></html>';
}
