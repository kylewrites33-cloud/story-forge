// What a paste brings to the writing box: its italics, bold and highlighting as Markdown when it has any (from a word
// processor, a web page or this page), otherwise its plain text. Browser only (DOMParser).
import { piecesToMarkdown } from '../lib/styled.ts';

interface Look { i: boolean; b: boolean; h: boolean }

/** The words of a piece of HTML (a paste) with their italics, bold and highlighting, as Markdown. */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const pieces: { text: string; i: boolean; b: boolean; h: boolean }[] = [];
  let pre = false;
  const text = () => pieces.map((p) => p.text).join('');
  const block = () => {
    const t = text();
    if (!t) return;
    const nl = /\n*$/.exec(t)![0].length;
    if (nl < 2) pieces.push({ text: '\n'.repeat(2 - nl), i: false, b: false, h: false });
  };
  const walk = (n: Node, look: Look, keep: boolean) => {
    n.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        let d = (c as Text).data;
        if (!keep) d = d.replace(/[ \t\r\n]+/g, ' ');
        else pre = true;
        if (d) pieces.push({ text: d.replace(/\r\n?/g, '\n'), ...look });
        return;
      }
      if (c.nodeType !== 1) return;
      const el = c as HTMLElement;
      const tag = el.nodeName;
      if (/^(STYLE|SCRIPT|META|TITLE|HEAD|LINK)$/.test(tag)) return;
      if (tag === 'BR') { pieces.push({ text: '\n', i: false, b: false, h: false }); return; }
      const st = el.style;
      const next = { ...look };
      if (tag === 'I' || tag === 'EM' || tag === 'CITE') next.i = true;
      if (tag === 'B' || tag === 'STRONG') next.b = true;
      if (tag === 'MARK') next.h = true;
      if (st && st.fontStyle === 'italic') next.i = true;
      else if (st && st.fontStyle === 'normal') next.i = false;
      if (st && (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600)) next.b = true;
      else if (st && (st.fontWeight === 'normal' || (st.fontWeight && Number(st.fontWeight) < 600))) next.b = false;
      const isBlock = /^(P|DIV|LI|H[1-6]|BLOCKQUOTE|TR|PRE|UL|OL|TABLE)$/.test(tag);
      if (isBlock) block();
      walk(c, next, keep || tag === 'PRE' || Boolean(st && /^pre/.test(st.whiteSpace)));
      if (isBlock) block();
    });
  };
  walk(doc.body, { i: false, b: false, h: false }, false);
  let md = piecesToMarkdown(pieces);
  if (!pre) md = md.replace(/[ \t]*\n[ \t]*/g, '\n');
  return md.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

/** What a paste or a drop brings: its italics and bold when it has any (from a word processor, a web page or this page),
 * otherwise its plain text. */
export function pasted(dt: DataTransfer | null): string {
  if (!dt) return '';
  const plain = (dt.getData('text/plain') || '').replace(/\r\n?/g, '\n');
  const html = dt.getData('text/html');
  if (html && /<(em|i|b|strong|mark|cite)\b|font-style:\s*italic|font-weight:\s*(bold|[6-9]00)/i.test(html)) {
    try {
      const md = htmlToMarkdown(html);
      if (md.trim()) return md;
    } catch { /* fall back to the plain text */ }
  }
  return plain;
}
