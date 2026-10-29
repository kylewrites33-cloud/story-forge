// Chapter titles picked in the app (Kyle, 2026-10-29: "an actual interface in the app where I can select the chapter
// titles I like"). The team writes the book's `Chapter Titles.md`: one `## Chapter N` section per chapter with
// `Was: <old name>` and `- [ ] <title>` lines ending in `- [ ] None of these`. Kyle ticks one line per chapter; None of
// these asks for four more next round, and a picked chapter is left alone.

export const TITLES_FILE = 'Chapter Titles.md';
export const NONE = 'None of these';

export interface TitleChapter { chapter: number; was: string; options: { text: string; picked: boolean }[]; none: boolean }

const HEAD = /^##\s+Chapter\s+(\d+)\s*$/i;
const OPTION = /^-\s+\[( |x|X)\]\s+(.*?)\s*$/;

/** The chapters in the note's body, in order. */
export function parseTitles(body: string): TitleChapter[] {
  const out: TitleChapter[] = [];
  let cur: TitleChapter | null = null;
  for (const line of body.split('\n')) {
    const h = HEAD.exec(line);
    if (h) { cur = { chapter: Number(h[1]), was: '', options: [], none: false }; out.push(cur); continue; }
    if (!cur) continue;
    const w = /^Was:\s*(.*)$/i.exec(line);
    if (w) { cur.was = w[1].trim(); continue; }
    const o = OPTION.exec(line);
    if (!o) continue;
    const picked = o[1] !== ' ';
    if (o[2].toLowerCase() === NONE.toLowerCase()) cur.none = picked;
    else cur.options.push({ text: o[2], picked });
  }
  return out;
}

/** The title Kyle picked for a chapter, or ''. */
export function pickedTitle(c: TitleChapter): string {
  const p = c.options.find((o) => o.picked);
  return p ? p.text : '';
}

/** Tick one line of a chapter (an option's text, or NONE) and untick the rest of that chapter; `on` false unticks it.
 * Changes only the chapter's tick lines. */
export function setPick(body: string, chapter: number, text: string, on: boolean): string {
  let inside = false;
  return body.split('\n').map((line) => {
    const h = HEAD.exec(line);
    if (h) { inside = Number(h[1]) === chapter; return line; }
    if (!inside) return line;
    const o = OPTION.exec(line);
    if (!o) return line;
    const tick = on && o[2] === text;
    const was = o[1] !== ' ';
    if (tick === was) return line;
    return line.replace(/\[( |x|X)\]/, tick ? '[x]' : '[ ]');
  }).join('\n');
}

/** Kyle's own title for a chapter (Kyle, 2026-10-29: "a write my own option for each chapter"): a ticked option line
 * added above None of these, the rest of the chapter unticked. The same title again just ticks it. */
export function addOwn(body: string, chapter: number, text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return body;
  const ch = parseTitles(body).find((c) => c.chapter === chapter);
  if (ch && ch.options.some((o) => o.text === clean)) return setPick(body, chapter, clean, true);
  const lines = setPick(body, chapter, '', false).split('\n');
  let inside = false;
  let at = -1;
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = HEAD.exec(lines[i]);
    if (h) { if (inside) break; inside = Number(h[1]) === chapter; continue; }
    if (!inside) continue;
    const o = OPTION.exec(lines[i]);
    if (!o) continue;
    last = i;
    if (o[2].toLowerCase() === NONE.toLowerCase()) { at = i; break; }
  }
  const line = '- [x] ' + clean;
  if (at >= 0) lines.splice(at, 0, line);
  else if (last >= 0) lines.splice(last + 1, 0, line);
  else return body;
  return lines.join('\n');
}
