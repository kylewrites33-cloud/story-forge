// A small Markdown reader for the read-only note view: headings, paragraphs, lists, quotes and Obsidian callouts,
// rules, code, emphasis and wiki links. Everything is escaped before any tag is added, so note text cannot inject HTML.
import { linkName } from './links.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function inline(text: string): string {
  const codes: string[] = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_m, c: string) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s
    .replace(/!?\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
      const alias = inner.split('|')[1];
      return '<span class="wikilink">' + (alias ? alias.trim() : linkName('[[' + inner + ']]')) + '</span>';
    })
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => '<code>' + codes[Number(i)] + '</code>');
}

export function render(md: string): string {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    if (/^\s*%%/.test(line)) {
      // Obsidian comment: skip to its closing %%
      if (!/%%.*%%\s*$/.test(line.trim().slice(2))) { i++; while (i < lines.length && !/%%/.test(lines[i])) i++; }
      i++;
      continue;
    }
    if (/^<!--/.test(line.trim())) { while (i < lines.length && !/-->/.test(lines[i])) i++; i++; continue; }
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) buf.push(lines[i++]);
      i++;
      out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) { out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*> ?/, ''));
      const callout = buf[0].match(/^\[!(\w+)\][+-]?\s*(.*)$/);
      if (callout) {
        const kind = callout[1].toLowerCase();
        const title = callout[2] || kind.charAt(0).toUpperCase() + kind.slice(1);
        out.push('<aside class="callout callout-' + esc(kind) + '"><p class="callout-title">' + inline(title) + '</p>' + render(buf.slice(1).join('\n')) + '</aside>');
      } else {
        out.push('<blockquote>' + render(buf.join('\n')) + '</blockquote>');
      }
      continue;
    }
    const list = line.match(/^\s*([-*+]|\d+[.)])\s+/);
    if (list) {
      const ordered = /\d/.test(list[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (m) { items.push(m[2]); i++; continue; }
        if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue; }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push('<' + tag + '>' + items.map((t) => '<li>' + inline(t.replace(/^\[( |x|X)\]\s+/, (_m, c: string) => (c === ' ' ? '☐ ' : '☑ '))) + '</li>').join('') + '</' + tag + '>');
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|\s*>|\s*([-*+]|\d+[.)])\s|\s*(```|~~~))/.test(lines[i])) para.push(lines[i++].trim());
    if (!para.length) para.push(lines[i++].trim());
    out.push('<p>' + inline(para.join(' ')) + '</p>');
  }
  return out.join('\n');
}
