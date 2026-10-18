// Options for a passage, in the writing screen: the strip under the tool row where Kyle chooses Expand, Describe, Tighten
// or More like my voice for the words he picked (or the paragraph at the cursor), and the Options tab beside the page
// where the team's two or three versions wait until he picks one. Nothing on the page changes before he does.
import { useState } from 'preact/hooks';
import { resultBody, type OnJob } from '../lib/jobs.ts';
import { saveSnapshot } from '../lib/drafts.ts';
import {
  askedPassage, loadOptionsDone, modeLabel, OPTION_MODES, optionAnswers, optionsJob, optionsState, passageAt, saveOptionsDone, swapIn, type OptionMode
} from '../lib/options.ts';
import type { NoteRecord, VaultSource } from '../lib/types.ts';
import { Icon } from './Icon.tsx';

/** Everything the writing screen needs for options: asking, the jobs still to deal with, and picking one. */
export function usePassageOptions({ source, note, bookFolder, onJob, jobs, selection, pageText, body, apply, addDots, canSave }: {
  source: VaultSource; note: NoteRecord; bookFolder: string | null; onJob?: OnJob; jobs: NoteRecord[];
  /** Where the words picked (or the cursor) are in the page, or null. */
  selection: () => { start: number; end: number } | null;
  pageText: () => string;
  /** The scene's whole body as it is now, for the copy saved before a swap. */
  body: () => string;
  apply: (text: string, map: (n: number) => number) => void;
  addDots: (lines: string[]) => void;
  canSave: boolean;
}) {
  const [busy, setBusy] = useState<OptionMode | ''>('');
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  const [done, setDone] = useState(() => loadOptionsDone(source.key));
  const markDone = (j: NoteRecord) => {
    const next = new Set(done);
    next.add(String(j.data.id || j.path));
    saveOptionsDone(source.key, next);
    setDone(next);
  };
  const ask = async (mode: OptionMode): Promise<boolean> => {
    const id = String(note.data.id || '');
    if (!onJob || !id || !bookFolder) { setSaid({ error: true, text: 'Asking the team needs your own vault, not the demo.' }); return false; }
    const p = passageAt(pageText(), selection());
    if (!p) { setSaid({ error: true, text: 'Pick some words, or put the cursor in a paragraph, then choose again.' }); return false; }
    setBusy(mode);
    const r = await onJob(optionsJob(mode, id, [id, note.data.title].filter(Boolean).join(' '), bookFolder, p));
    setBusy('');
    setSaid({ error: r.error, text: r.error ? r.text : r.text.startsWith('Sent') ? 'Sent to the team. Their options show in the Options tab beside the page, usually within a few minutes; your page stays as it is until you pick one.' : r.text });
    return !r.error;
  };
  const pick = async (j: NoteRecord, option: string): Promise<PickResult> => {
    const asked = askedPassage(j.body);
    if (!asked) return { ok: false, lost: false, text: 'This job does not say which words it was for, so nothing changed.' };
    const r = swapIn(pageText(), asked.passage, asked.before, option);
    if (!r) return { ok: false, lost: true, text: 'Those words have changed since you asked, so nothing was swapped.' };
    if (canSave) {
      if (!navigator.onLine) return { ok: false, lost: false, text: 'Connect to the internet: a copy of the scene is saved before the swap.' };
      try { await saveSnapshot(source, note, body(), 'before ' + modeLabel(asked.mode).toLowerCase(), new Date()); } catch (e) {
        return { ok: false, lost: false, text: 'The copy of the scene did not save, so nothing changed. ' + (e as Error).message };
      }
    }
    // Read the page again: Kyle may have typed while the copy saved.
    const now = swapIn(pageText(), asked.passage, asked.before, option);
    if (!now) return { ok: false, lost: true, text: 'Those words changed while the copy saved, so nothing was swapped.' };
    apply(now.text, now.map);
    addDots(now.added);
    return { ok: true, text: canSave ? 'Swapped in. The scene as it was is saved as a copy (Copies tab).' : 'Swapped in.' };
  };
  const end = (option: string) => {
    const before = pageText();
    const add = option.trim();
    apply(before.replace(/\s*$/, '') + '\n\n' + add, (n) => n);
    addDots(add.split('\n').filter((l) => l.trim()));
  };
  const ready = jobs.filter((j) => !done.has(String(j.data.id || j.path)) && optionsState(j) === 'ready').length;
  const waiting = jobs.filter((j) => !done.has(String(j.data.id || j.path)) && optionsState(j) === 'waiting').length;
  return { busy, said, setSaid, ask, pick, end, done, markDone, ready, waiting };
}

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

/** The strip under the tool row: one button per mode. */
export function OptionsAsk({ busy, onAsk, onClose, keep }: {
  busy: OptionMode | '';
  onAsk: (mode: OptionMode) => void;
  onClose: () => void;
  /** Keeps the cursor and the words picked in the page while a button is pressed. */
  keep: Record<string, (e: Event) => void>;
}) {
  return (
    <div class="tool-said options-ask" role="group" aria-label="Options for a passage">
      <span>Two or three versions to choose from, for the words you picked or the paragraph at the cursor:</span>
      <span class="buttons">
        {OPTION_MODES.map((m) => (
          <button key={m.key} type="button" title={m.hint} disabled={busy !== ''} {...keep} onClick={() => onAsk(m.key)}>
            {busy === m.key ? 'Sending…' : m.label}
          </button>
        ))}
      </span>
      <button type="button" class="icon-button" aria-label="Close" onClick={onClose}><Icon name="close" size={16} /></button>
    </div>
  );
}

export type PickResult = { ok: true; text: string } | { ok: false; lost: boolean; text: string };

/** The Options tab: this scene's options jobs that Kyle has not dealt with yet, newest first. */
export function OptionsPanel({ jobs, done, onPick, onEnd, onDone }: {
  jobs: NoteRecord[];
  /** Job IDs dealt with on this device (picked or put away). */
  done: Set<string>;
  onPick: (job: NoteRecord, option: string) => Promise<PickResult>;
  /** Put an option at the end of the scene (the passage was no longer there). */
  onEnd: (option: string) => void;
  onDone: (job: NoteRecord) => void;
}) {
  const [said, setSaid] = useState<{ job: string; option: number; r: PickResult } | null>(null);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const open = jobs.filter((j) => !done.has(String(j.data.id || j.path)));
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); } catch { setCopied(''); }
  };
  if (!open.length) {
    return (
      <div class="writer-panel options-panel">
        {said && said.r.ok && <p class="ok" role="status">{said.r.text}</p>}
        <p class="hint">Pick some words (or put the cursor in a paragraph) and press Options in the tool row. The team writes two or three versions; they show here, and your page changes only when you pick one. A copy of the scene is saved first.</p>
      </div>
    );
  }
  return (
    <div class="writer-panel options-panel">
      {open.map((j) => {
        const id = String(j.data.id || j.path);
        const asked = askedPassage(j.body);
        const state = optionsState(j);
        const { options, notes } = optionAnswers(resultBody(j.body));
        return (
          <section key={id} class="options-job">
            <p class="panel-key">{modeLabel(asked ? asked.mode : '')} · {id}</p>
            {asked && <blockquote class="options-passage">{short(asked.passage, 240)}</blockquote>}
            {state === 'waiting' && <p class="note-line"><span class="job-dot" aria-hidden="true" /> The team is writing the options. They show here when ready.</p>}
            {state === 'failed' && <p class="hint">No options came back{j.data.result ? ': ' + String(j.data.result) : '.'}</p>}
            {options.map((o, k) => {
              const key = id + ':' + k;
              const mine = said && said.job === id && said.option === k ? said.r : null;
              return (
                <div key={k} class="option-card">
                  <span class="panel-key">Option {k + 1}</span>
                  <div class="option-text">{o}</div>
                  <span class="buttons">
                    <button type="button" class="primary" disabled={busy !== ''} onClick={async () => {
                      setBusy(key);
                      const r = await onPick(j, o);
                      setBusy('');
                      setSaid({ job: id, option: k, r });
                      if (r.ok) onDone(j);
                    }}>{busy === key ? 'Saving a copy…' : 'Use this one'}</button>
                    <button type="button" onClick={() => copy(key, o)}>{copied === key ? 'Copied' : 'Copy'}</button>
                  </span>
                  {mine && !mine.ok && (
                    <div class="option-lost">
                      <p class={mine.lost ? 'note-line' : 'error'}>{mine.text}</p>
                      {mine.lost && <span class="buttons">
                        <button type="button" onClick={() => { onEnd(o); onDone(j); setSaid(null); }}>Put it at the end</button>
                        <button type="button" onClick={() => copy(key, o)}>{copied === key ? 'Copied' : 'Copy it'}</button>
                      </span>}
                    </div>
                  )}
                </div>
              );
            })}
            {notes && <p class="hint">{notes}</p>}
            {state !== 'waiting' && <button type="button" class="link" onClick={() => onDone(j)}>Put these away</button>}
          </section>
        );
      })}
      {said && said.r.ok && <p class="ok" role="status">{said.r.text}</p>}
    </div>
  );
}
