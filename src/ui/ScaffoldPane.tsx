// The Scaffold pane: the book's scaffold page on the right half of the writing screen, opened at the chapter being
// written (Kyle, 2026-11-27). It takes the Team column's place while open and leaves that column's size alone.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.tsx';
import { readPicture, writePicture } from '../lib/cache.ts';
import { chapterMessage, scaffoldDoc, type ScaffoldColours } from '../lib/scaffold.ts';
import type { FileEntry, VaultSource } from '../lib/types.ts';

/** The theme's colours as the page is drawing them now. */
function colours(): ScaffoldColours | null {
  if (typeof getComputedStyle !== 'function') return null;
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(n).trim();
  if (!v('--surface')) return null;
  return { paper: v('--surface'), ink: v('--text'), soft: v('--muted'), rule: v('--line'), fill: v('--hover') || v('--bg') };
}

/** The page's words, from the device when this version was fetched before (so it opens offline), else from the vault. */
async function load(source: VaultSource, file: FileEntry): Promise<string> {
  const kept = await readPicture('scaffold:' + file.sha);
  if (kept) return kept.text();
  const text = await source.read(file.path, file.sha);
  await writePicture('scaffold:' + file.sha, new Blob([text], { type: 'text/html' }));
  return text;
}

export function ScaffoldPane({ source, file, chapter, title, onClose }: {
  source: VaultSource; file: FileEntry; chapter: number | null; title: string; onClose: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    let live = true;
    setProblem('');
    load(source, file).then((t) => { if (live) setHtml(t); })
      .catch(() => { if (live) setProblem('The scaffold could not be opened. Check the connection and press Scaffold again.'); });
    return () => { live = false; };
  }, [source, file.sha]);
  const doc = useMemo(() => (html == null ? '' : scaffoldDoc(html, colours())), [html]);
  const frame = useRef<HTMLIFrameElement>(null);
  const send = () => { const w = frame.current && frame.current.contentWindow; if (w && chapter != null) w.postMessage(chapterMessage(chapter), '*'); };
  useEffect(send, [chapter]);
  return (
    <aside class="writer-scaffold" aria-label="Scaffold">
      <div class="side-head">
        <strong>{chapter != null ? 'Scaffold · chapter ' + chapter : 'Scaffold'}</strong>
        <button type="button" class="icon-button" onClick={onClose} aria-label="Close the scaffold"><Icon name="close" /></button>
      </div>
      {problem
        ? <p class="hint">{problem}</p>
        : html == null
          ? <p class="hint">Opening the scaffold…</p>
          /* Sealed: the page runs its own buttons but cannot reach the app or anything the app keeps. */
          : <iframe ref={frame} class="scaffold-frame" title={title + ' scaffold'} sandbox="allow-scripts" srcdoc={doc} onLoad={send} />}
    </aside>
  );
}
