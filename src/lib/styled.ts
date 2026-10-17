// The writing screen's styled view of a scene's Markdown: *italics* and **bold** shown slanted and heavy, with their stars
// kept (faint) so every character of the file stays on screen and in place. Nothing here changes the text; the HTML holds
// exactly the same characters, so the cursor's position in the HTML is its position in the file.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Run { from: number; to: number; open: number; close: number; cls: 'b' | 'i' | 'bi' }

/** Emphasis runs on one line, CommonMark-like enough for prose. Stars come in runs (*, **, ***). A run opens when a
 * non-space follows it (a single star glued to a letter or digit before it, as in 2*3, does not), and closes at the next
 * run of the same length with a non-space before it. *** is bold and italic; runs never cross a line; runs of other
 * lengths in between are left for the inner text, so *a **b** c* nests. */
export function runs(line: string): Run[] {
  const stars: { at: number; n: number }[] = [];
  const re = /\*+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) stars.push({ at: m.index, n: m[0].length });
  const out: Run[] = [];
  for (let k = 0; k < stars.length; k++) {
    const o = stars[k];
    if (o.n > 3) continue;
    const after = line[o.at + o.n];
    if (after === undefined || /\s/.test(after)) continue;
    if (o.n === 1 && o.at > 0 && /[A-Za-z0-9]/.test(line[o.at - 1])) continue;
    let c = -1;
    for (let q = k + 1; q < stars.length; q++) {
      if (stars[q].n === o.n && !/\s/.test(line[stars[q].at - 1])) { c = q; break; }
    }
    if (c < 0) continue;
    out.push({ from: o.at, to: stars[c].at + o.n, open: o.n, close: o.n, cls: o.n === 3 ? 'bi' : o.n === 2 ? 'b' : 'i' });
    k = c;
  }
  return out;
}

/** One line as HTML: emphasis runs styled, their stars faint, inner runs (italics inside bold) styled too. */
function lineHtml(line: string): string {
  const rs = runs(line);
  if (!rs.length) return esc(line);
  let html = '';
  let at = 0;
  rs.forEach((r) => {
    html += esc(line.slice(at, r.from));
    const inner = line.slice(r.from + r.open, r.to - r.close);
    html += '<span class="md-' + r.cls + '"><span class="md-mark">' + '*'.repeat(r.open) + '</span>' + lineHtml(inner) +
      '<span class="md-mark">' + '*'.repeat(r.close) + '</span></span>';
    at = r.to;
  });
  return html + esc(line.slice(at));
}

/** The whole text as HTML for the editor. Lines that start with ">" (callouts such as Team notes) are muted. */
export function styledHtml(text: string): string {
  return text.split('\n').map((line) => (/^\s*>/.test(line) ? '<span class="md-quote">' + lineHtml(line) + '</span>' : lineHtml(line))).join('\n');
}

/** The text an HTML string from styledHtml holds, for tests: tags removed, entities read back. */
export function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
