// Pieces the "seeing the book" pages share: the page's head, the scenes across the top of a grid (by chapter), and a
// list of warnings.
import type { ComponentChildren } from 'preact';
import { sceneHeader } from '../lib/format.ts';
import { toNumber } from '../lib/links.ts';
import type { BookEntry, NoteRecord } from '../lib/types.ts';
import { href } from './route.ts';

export function SeeingHead({ book, title, heading, children }: { book: BookEntry; title: string; heading: string; children?: ComponentChildren }) {
  return (
    <>
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · {title}</p>
      <h1>{heading}</h1>
      {children && <p class="meta seeing-intro">{children}</p>}
    </>
  );
}

/** Runs of scenes in the same chapter, for a header row of chapters over the scenes. */
export function chapterRuns(scenes: NoteRecord[]): { num: number | null; span: number }[] {
  const out: { num: number | null; span: number }[] = [];
  scenes.forEach((s) => {
    const num = toNumber(s.data.chapter);
    const last = out[out.length - 1];
    if (last && last.num === num) last.span++;
    else out.push({ num, span: 1 });
  });
  return out;
}

/** Two header rows: the chapters, then each scene's ID (its summary on hover; press to write it). `shade` marks columns. */
export function SceneHeads({ scenes, corner, shade }: { scenes: NoteRecord[]; corner: string; shade?: (i: number) => boolean }) {
  return (
    <thead>
      <tr class="sg-chapters">
        <th class="sg-side" scope="col" rowSpan={2}>{corner}</th>
        {chapterRuns(scenes).map((r, i) => <th key={i} colSpan={r.span} scope="colgroup">{r.num == null ? 'No chapter' : 'Ch ' + r.num}</th>)}
      </tr>
      <tr class="sg-scenes">
        {scenes.map((s, i) => (
          <th key={s.path} scope="col" class={shade && shade(i) ? 'shade' : undefined}>
            <a href={href.write(s.path)} title={String(s.data.id || '') + ': ' + sceneHeader(s.data)}>{String(s.data.id || '').replace(/^S-0*/, '') || i + 1}</a>
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function WarningList({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <div class="seeing-warnings" role="status">
      <p class="seeing-warnings-head">{list.length === 1 ? '1 thing to look at' : list.length + ' things to look at'}</p>
      <ul>{list.map((w) => <li key={w}>{w}</li>)}</ul>
    </div>
  );
}
