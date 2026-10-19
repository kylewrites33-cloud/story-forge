// The Workflow page (Kyle, 2026-10-19): workflow 1.1 from the vault's System/Workflow.md, stage by stage, every step
// with who does it, whether it is one mind or several, what it needs and why. Agent names link to their pages; a
// filter shows one agent's steps or only the steps with several minds. Kyle can add a dated note on the workflow or
// on one step, which goes under "## Kyle's notes" in the note, so the next version answers it.
import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { inline, render } from '../lib/markdown.ts';
import { teamColour } from '../lib/team.ts';
import { allSteps, parseWorkflow, type WorkflowStep } from '../lib/workflow.ts';
import type { VaultIndex } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { Avatar, useTeam } from './Team.tsx';
import { href } from './route.ts';

const html = (md: string) => ({ __html: inline(md) });

function NoteBox({ start, onNote, onDone }: { start: string; onNote: (text: string) => Promise<string | null>; onDone: () => void }) {
  const [text, setText] = useState(start);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, []);
  const save = async () => {
    if (!text.trim() || text.trim() === start.trim()) return;
    setBusy(true);
    const e = await onNote(text);
    setBusy(false);
    if (e) setErr(e); else onDone();
  };
  return (
    <div class="wf-note-box">
      <label class="sr-only" for="wf-note">Your note on the workflow</label>
      <textarea id="wf-note" rows={3} value={text} ref={ref} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} />
      {err && <p class="error">{err}</p>}
      <div class="buttons">
        <button type="button" class="primary" onClick={save} disabled={busy || !text.trim() || text.trim() === start.trim()}>{busy ? 'Saving…' : 'Save note'}</button>
        <button type="button" onClick={onDone} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

function Step({ s, slugOf, colour, here, canNote, noting, onNoteStep }: {
  s: WorkflowStep; slugOf: (n: string) => string; colour: string; here: boolean; canNote: boolean; noting: boolean; onNoteStep: () => void;
}) {
  return (
    <div class={'wf-row' + (here ? ' wf-here' : '') + (s.several ? ' wf-several' : '')} id={s.number ? 'step-' + s.number : undefined} role="row"
      style={colour ? { borderLeftColor: colour } : undefined}>
      <div class="wf-step" role="cell">
        {s.number > 0 && <span class="wf-num">{s.number}</span>}
        <span class="wf-step-text" dangerouslySetInnerHTML={html(s.step)} />
        {s.several && <span class="pill pill-plain wf-pill">Several minds</span>}
      </div>
      <div class="wf-who" role="cell">
        <span class="wf-label">Who</span>
        <span dangerouslySetInnerHTML={html(s.who)} />
        {s.agents.length > 0 && (
          <span class="wf-agents">
            {s.agents.map((a) => <a key={a} href={href.team(slugOf(a))} title={a}><Avatar name={a} size={26} /><span class="sr-only">{a}</span></a>)}
          </span>
        )}
      </div>
      <div class="wf-minds" role="cell"><span class="wf-label">Minds</span><span dangerouslySetInnerHTML={html(s.minds)} /></div>
      <div class="wf-needs" role="cell"><span class="wf-label">Needs</span><span dangerouslySetInnerHTML={html(s.needs)} /></div>
      <div class="wf-why" role="cell">
        <span class="wf-label">Why</span><span dangerouslySetInnerHTML={html(s.why)} />
        {canNote && !noting && s.number > 0 && (
          <button type="button" class="wf-note-btn" onClick={onNoteStep} title={'Add a note on step ' + s.number}><Icon name="note" size={18} /> Note</button>
        )}
      </div>
    </div>
  );
}

export function WorkflowScreen({ index, step, onNote }: { index: VaultIndex; step: number; onNote?: (text: string) => Promise<string | null> }) {
  const team = useTeam(index);
  const names = useMemo(() => team.members.map((m) => m.name), [team]);
  const wf = useMemo(() => parseWorkflow(team.workflow, names), [team.workflow, names]);
  const [who, setWho] = useState('');
  const [several, setSeveral] = useState(false);
  const [noting, setNoting] = useState<string | null>(null);
  useEffect(() => {
    if (!step) return;
    const el = document.getElementById('step-' + step);
    if (el) el.scrollIntoView({ block: 'center' });
  }, [step, wf]);
  const slugOf = (n: string) => (team.members.find((m) => m.name === n) || { slug: '' }).slug;
  if (!wf) {
    return (
      <section class="workflow-screen">
        <h1>Workflow</h1>
        <div class="empty-box">
          <h2>No workflow in this vault yet</h2>
          <p>The workflow lives in the vault's System/Workflow.md: one table per stage, with Step, Who, Minds, Needs and Why. Press Sync after adding it.</p>
        </div>
      </section>
    );
  }
  const steps = allSteps(wf);
  const shows = (s: WorkflowStep) => (!who || s.agents.indexOf(who) >= 0) && (!several || s.several);
  const counts: Record<string, number> = {};
  steps.forEach((s) => s.agents.forEach((a) => { counts[a] = (counts[a] || 0) + 1; }));
  const startNote = (s?: WorkflowStep) => setNoting(s ? 'Step ' + s.number + ' (' + s.step.replace(/[*`]/g, '').slice(0, 60) + '): ' : '');
  const box = (start: string) => onNote && <NoteBox start={start} onNote={onNote} onDone={() => setNoting(null)} />;
  return (
    <section class="workflow-screen">
      <h1>{wf.title}</h1>
      <p class="meta">
        {wf.updated ? 'Updated ' + wf.updated + ' · ' : ''}{steps.length} steps in {wf.stages.length} stages · {steps.filter((s) => s.several).length} with several minds.
        {' '}<a href={href.team()}>The team</a> · <a href={href.skills()}>Skills</a>
      </p>
      {wf.intro && <div class="prose wf-intro" dangerouslySetInnerHTML={{ __html: render(wf.intro) }} />}
      {onNote && (noting === '' ? box('') : <p><button type="button" class="wf-add" onClick={() => startNote()}><Icon name="note" size={18} /> Add a note on the workflow</button></p>)}
      <div class="tabs wf-filter" role="tablist" aria-label="Show">
        <button type="button" role="tab" aria-selected={!who} onClick={() => setWho('')}>Everyone</button>
        {team.members.filter((m) => counts[m.name]).map((m) => (
          <button key={m.slug} type="button" role="tab" aria-selected={who === m.name} onClick={() => setWho(who === m.name ? '' : m.name)}>
            {m.name} <span class="count">{counts[m.name]}</span>
          </button>
        ))}
      </div>
      <label class="wf-toggle"><input type="checkbox" checked={several} onChange={(e) => setSeveral((e.currentTarget as HTMLInputElement).checked)} /> Only the steps with several minds</label>
      {wf.stages.map((st) => {
        const shown = st.steps.filter(shows);
        if (!shown.length) return null;
        return (
          <section class="wf-stage" key={st.title}>
            <h2>{st.title} <span class="meta">{shown.length === st.steps.length ? st.steps.length + ' steps' : shown.length + ' of ' + st.steps.length + ' steps'}</span></h2>
            {st.intro && <div class="prose" dangerouslySetInnerHTML={{ __html: render(st.intro) }} />}
            <div class="wf-table" role="table" aria-label={st.title}>
              <div class="wf-row wf-head" role="row">
                <span role="columnheader">Step</span><span role="columnheader">Who</span><span role="columnheader">Minds</span>
                <span role="columnheader">Needs</span><span role="columnheader">Why</span>
              </div>
              {shown.map((s) => {
                const key = 'Step ' + s.number + ' (';
                const open = noting != null && noting.startsWith(key);
                return (
                  <Fragment key={s.number + s.step}>
                    <Step s={s} slugOf={slugOf} colour={s.agents[0] ? teamColour((team.members.find((m) => m.name === s.agents[0]) || { team: '' }).team) : ''} here={s.number === step} canNote={Boolean(onNote)} noting={open} onNoteStep={() => startNote(s)} />
                    {open && <div role="row" class="wf-note-row">{box(noting!)}</div>}
                  </Fragment>
                );
              })}
            </div>
          </section>
        );
      })}
      {wf.sections.map((s) => (
        <section class="wf-section" key={s.title}>
          <h2>{s.title}</h2>
          <div class="prose" dangerouslySetInnerHTML={{ __html: render(s.markdown) }} />
        </section>
      ))}
      <p class="hint">The workflow is the vault's System/Workflow.md; the team reads it before working on a book. Your notes go at its end, dated, and the next version answers them.</p>
    </section>
  );
}
