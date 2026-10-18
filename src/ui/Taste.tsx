// The Taste page: Kyle's Taste Profile and Style Fingerprint as they are in the vault, and plain bars of what he keeps,
// puts aside and drops, by idea kind and by the agent who proposed it, his most given reasons and the keep rate per
// brainstorm round. Update my taste asks the team to rewrite the Taste Profile from his decisions (a learn-taste job).
import { useEffect, useState } from 'preact/hooks';
import { defaultJobTitle, jobAsk, type OnJob } from '../lib/jobs.ts';
import { REASONS } from '../lib/ideas.ts';
import { render } from '../lib/markdown.ts';
import { percent, TASTE_FILES, tasteIdeas, tasteStats, withoutProperties, type TasteRow } from '../lib/taste.ts';
import type { BookEntry, VaultIndex, VaultSource } from '../lib/types.ts';
import { href } from './route.ts';
import { Icon } from './Icon.tsx';
import { EmptyBox } from './screens.tsx';

const SEGMENTS: { key: 'kept' | 'later' | 'dropped' | 'open'; label: string }[] = [
  { key: 'kept', label: 'Kept' },
  { key: 'later', label: 'Later' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'open', label: 'Not decided' }
];

/** One bar per row, split into kept, later, dropped and not decided, all on the same scale. */
function PileBars({ rows, name }: { rows: TasteRow[]; name: (key: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.kept + r.later + r.dropped + r.open));
  return (
    <ul class="taste-bars">
      {rows.map((r) => {
        const sum = r.kept + r.later + r.dropped + r.open;
        return (
          <li key={r.key}>
            <span class="taste-label">{name(r.key)}</span>
            <span class="taste-track" aria-hidden="true">
              {SEGMENTS.map((s) => r[s.key] > 0 && <span key={s.key} class={'taste-seg seg-' + s.key} style={{ width: (r[s.key] / max) * 100 + '%' }} />)}
            </span>
            <span class="taste-num">
              {SEGMENTS.filter((s) => r[s.key] > 0).map((s) => r[s.key] + ' ' + s.label.toLowerCase()).join(' · ') || 'none'}
              {sum > 0 && r.keepRate != null ? ' · ' + percent(r.keepRate) + ' kept' : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Legend() {
  return (
    <p class="taste-legend">
      {SEGMENTS.map((s) => <span key={s.key}><span class={'taste-swatch seg-' + s.key} aria-hidden="true" />{s.label}</span>)}
      <span class="meta">The share kept counts kept and dropped ideas only.</span>
    </p>
  );
}

/** A note at the vault root, read on demand (they are not on any board), shown with the app's Markdown reader. */
function useVaultText(source: VaultSource, path: string): { text: string | null; error: string | null } {
  const [state, setState] = useState<{ text: string | null; error: string | null }>({ text: null, error: null });
  useEffect(() => {
    let live = true;
    setState({ text: null, error: null });
    source.tree()
      .then(({ files }) => {
        const f = files.find((x) => x.path === path);
        if (!f) throw new Error('The vault has no ' + path + ' yet. The learn-taste routine writes it.');
        return source.read(f.path, f.sha);
      })
      .then((text) => { if (live) setState({ text, error: null }); })
      .catch((e) => { if (live) setState({ text: null, error: navigator.onLine ? (e as Error).message : 'Connect to the internet to read ' + path + '.' }); });
    return () => { live = false; };
  }, [source, path]);
  return state;
}

function TasteNote({ source, path, title }: { source: VaultSource; path: string; title: string }) {
  const { text, error } = useVaultText(source, path);
  return (
    <details class="taste-note" open>
      <summary>{title}</summary>
      {error ? <p class="empty">{error}</p>
        : text == null ? <p class="meta">Reading…</p>
          : <div class="prose" dangerouslySetInnerHTML={{ __html: render(withoutProperties(text).replace(/^\s*# [^\n]*\n/, '')) }} />}
    </details>
  );
}

export function TastePage({ source, index, book, onJob }: { source: VaultSource; index: VaultIndex; book: BookEntry; onJob?: OnJob }) {
  const [all, setAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const stats = tasteStats(tasteIdeas(index, all ? undefined : [book]));
  const topReason = Math.max(1, ...stats.reasons.map((r) => r.count));
  const withOf = (key: string) => (REASONS.find((r) => r.key === key) || { with: 'keep' }).with;
  const update = async () => {
    if (!onJob) return;
    setBusy(true);
    const r = await onJob({ title: defaultJobTitle('learn-taste', ''), kind: 'learn-taste', target: '', book: book.folder, ask: jobAsk('learn-taste', '', '') });
    setBusy(false);
    setSaid(r);
  };
  return (
    <section class="taste-page">
      <p class="crumb"><a href={href.book(book.folder)}>← {book.title}</a> · Taste</p>
      <h1>Taste</h1>
      <p class="meta">What the team has learned about what you like, and what your choices on the boards say. Your reasons and stars teach it most.</p>
      <div class="buttons">
        {onJob && <button type="button" class="primary" disabled={busy} onClick={update}><Icon name="idea" size={18} />{busy ? 'Sending…' : 'Update my taste'}</button>}
      </div>
      {said && <p class={said.error ? 'error' : 'ok'} role="status">{said.text}</p>}

      <div class="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={all} onClick={() => setAll(true)}>All books</button>
        <button type="button" role="tab" aria-selected={!all} onClick={() => setAll(false)}>{book.title}</button>
      </div>
      {!stats.ideas
        ? <EmptyBox title="No ideas yet"><p>The charts fill in as you keep, put aside and drop ideas on the Ideas board.</p></EmptyBox>
        : <>
          <p class="taste-summary">
            <span><b>{stats.ideas}</b> ideas</span>
            <span><b>{stats.kept}</b> kept</span>
            <span><b>{stats.later}</b> later</span>
            <span><b>{stats.dropped}</b> dropped</span>
            <span><b>{percent(stats.kept + stats.dropped ? stats.kept / (stats.kept + stats.dropped) : null)}</b> kept of those decided</span>
          </p>
          <div class="taste-grid">
            <section class="taste-card">
              <h2>By kind of idea</h2>
              <Legend />
              <PileBars rows={stats.byKind} name={(k) => k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, ' ')} />
            </section>
            <section class="taste-card">
              <h2>By who proposed it</h2>
              <Legend />
              <PileBars rows={stats.bySource} name={(k) => k} />
            </section>
            <section class="taste-card">
              <h2>Your top reasons</h2>
              {stats.reasons.length
                ? <ul class="taste-bars">
                  {stats.reasons.map((r) => (
                    <li key={r.key}>
                      <span class="taste-label">{r.label}</span>
                      <span class="taste-track" aria-hidden="true"><span class={'taste-seg seg-' + (withOf(r.key) === 'keep' ? 'kept' : withOf(r.key) === 'later' ? 'later' : 'dropped')} style={{ width: (r.count / topReason) * 100 + '%' }} /></span>
                      <span class="taste-num">{r.count} {r.count === 1 ? 'time' : 'times'}, with {withOf(r.key) === 'keep' ? 'Keep' : withOf(r.key) === 'later' ? 'Later' : 'Drop'}</span>
                    </li>
                  ))}
                </ul>
                : <p class="empty">No reasons yet. After Keep, Later or Drop, press a reason or two (Love it, Cliché…).</p>}
            </section>
            <section class="taste-card">
              <h2>Keep rate by brainstorm round</h2>
              <p class="meta">Round 1 is the blind pitches, 2 the responses, 3 the fusion. A low rate in a later round says it is not worth its cost.</p>
              {stats.byRound.length
                ? <ul class="taste-bars">
                  {stats.byRound.map((r) => (
                    <li key={r.key}>
                      <span class="taste-label">Round {r.key}</span>
                      <span class="taste-track" aria-hidden="true">{r.keepRate != null && <span class="taste-seg seg-kept" style={{ width: r.keepRate * 100 + '%' }} />}</span>
                      <span class="taste-num">{percent(r.keepRate)} kept · {r.kept} of {r.kept + r.dropped} decided{r.later + r.open ? ' · ' + (r.later + r.open) + ' waiting' : ''}</span>
                    </li>
                  ))}
                </ul>
                : <p class="empty">No ideas say which round they came from yet. The team marks each new idea with its round.</p>}
            </section>
          </div>
        </>}

      {TASTE_FILES.map((f) => <TasteNote key={f.path} source={source} path={f.path} title={f.title} />)}
    </section>
  );
}
