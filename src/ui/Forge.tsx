// Forge a new specialist (Writers Room's /forge, Kyle 2026-10-18): one line of Kyle's words ("a beekeeper") writes a
// `forge` job. The team researches a sourced knowledge folder and writes the new agent, then stops for Kyle's yes.
import { useState } from 'preact/hooks';
import { defaultJobTitle, jobAsk, type OnJob } from '../lib/jobs.ts';
import { safeTitle } from '../lib/scenes.ts';
import { Icon } from './Icon.tsx';

export function ForgeSpecialist({ onJob, book }: { onJob?: OnJob; book: string }) {
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  if (!onJob) return null;
  const go = async () => {
    const w = words.trim().replace(/\s+/g, ' ');
    if (!w) return;
    setBusy(true);
    setSaid(null);
    const r = await onJob({ title: defaultJobTitle('forge', safeTitle(w).slice(0, 60)), kind: 'forge', target: w, book, ask: jobAsk('forge', w, w) });
    setBusy(false);
    setSaid(r);
    if (!r.error) { setWords(''); setOpen(false); }
  };
  return (
    <div class="forge">
      {!open ? (
        <button type="button" class="soft" onClick={() => { setOpen(true); setSaid(null); }}><Icon name="wand" size={18} /> Forge a new specialist</button>
      ) : (
        <form class="forge-form" onSubmit={(e) => { e.preventDefault(); if (!busy) go(); }}>
          <label class="reason">What expert does the team lack? One line, in your words.
            <input type="text" value={words} placeholder="For example a beekeeper, or a 1920s railway historian" onInput={(e) => setWords((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <div class="buttons">
            <button type="submit" class="primary" disabled={busy || !words.trim()}>{busy ? 'Sending…' : 'Forge it'}</button>
            <button type="button" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          <p class="hint">The team researches the field with sources, writes the new agent, and files it for your yes before it joins. It uses web research and spends API credit.</p>
        </form>
      )}
      {said && <p class={said.error ? 'error' : 'ok'} role="status">{said.text}</p>}
    </div>
  );
}
