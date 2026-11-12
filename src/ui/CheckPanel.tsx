// Check (AI phrases) beside the page: the vault tool's linter run on this device, free, with no team job. The score and
// grade, the rhythm numbers and a list of what it flagged; pressing a flag brings its words into view. The flagged
// words are also lit in the page (the writing box's lights, never in the text or the file).
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { checkText, combine, loadShowFlags, saveShowFlags, sevWord, type CheckIssue, type CheckOptions, type CheckResult } from '../lib/lintcheck.ts';
import type { EditorCommands } from '../write/prose.ts';

/** One scene on the page: its words, the writing box it is in and how to select in it. */
export interface CheckSection {
  key: string;
  /** Shown above its flags when the page holds several scenes (Whole chapter). */
  label: string;
  text: string;
  /** The writing box the scene is in, when it is on the page. */
  box: () => EditorCommands | null;
  select: (start: number, end: number) => void;
}

const num = (n: number) => n.toLocaleString('en-US');
const pct = (n: number) => Math.round(n * 100) + '%';

export function CheckPanel({ sections, opts, onJump, deeper }: {
  sections: CheckSection[];
  opts: CheckOptions;
  /** Called after a flag is selected in the page (a panel over the page closes). */
  onJump?: () => void;
  /** The team's paid, deeper check, offered under the list. */
  deeper?: ComponentChildren;
}) {
  // The check runs again half a second after the words stop changing.
  const textKey = sections.map((s) => s.key + '\u0000' + s.text).join('\u0001');
  const [ran, setRan] = useState(textKey);
  useEffect(() => {
    if (ran === textKey) return;
    const t = setTimeout(() => setRan(textKey), 500);
    return () => clearTimeout(t);
  }, [textKey]);
  const live = useRef(sections);
  live.current = sections;
  // Each result with the words it was worked out from: flags are only drawn while the page still holds those words.
  const checked = useMemo(() => live.current.map((s) => ({ text: s.text, result: checkText(s.text, opts) })), [ran, opts]);
  const results: CheckResult[] = checked.map((c) => c.result);
  const [show, setShow] = useState(loadShowFlags);
  const [picked, setPicked] = useState<string | null>(null);

  // Light the flags on the page. The lights follow the words as Kyle types.
  useEffect(() => {
    live.current.forEach((s, i) => {
      const box = s.box();
      if (!box) return;
      const c = checked[i];
      // Worked out from older words: the lights already on the page move with their words until the check has run again.
      if (!c || c.text !== s.text) return;
      const list = c.result.shown;
      box.light('check', show ? list.map((it) => ({ start: it.from, end: it.to })) : []);
      box.light('check-now', list.filter((_it, k) => picked === s.key + ':' + k).map((it) => ({ start: it.from, end: it.to })));
    });
  }, [checked, show, picked, textKey]);
  useEffect(() => () => { live.current.forEach((s) => { const box = s.box(); if (box) { box.light('check', []); box.light('check-now', []); } }); }, []);

  const jump = (si: number, k: number, it: CheckIssue) => {
    const s = sections[si];
    setPicked(s.key + ':' + k);
    // Lit and brought into view without opening the keyboard.
    const box = s.box();
    if (box) box.reveal(it.from, it.to);
    else s.select(it.from, it.to);
    if (onJump) onJump();
  };

  const many = sections.length > 1;
  const all = combine(results);
  const one = results.length === 1 ? results[0].stats : null;
  const flagged = results.reduce((n, r) => n + r.shown.length, 0);
  const dialogue = one ? one.dialogueRatio : 0;

  return (
    <div class="writer-panel check-panel">
      <div class={'check-score grade-' + all.grade.toLowerCase()}>
        <span class="check-number">{all.score}</span>
        <span class="check-grade">{all.grade}</span>
        <span class="check-words">AI-tell score for {num(all.words)} words{many ? ' in ' + sections.length + ' scenes' : ''}</span>
      </div>
      <dl class="check-stats">
        <div><dt>Sentences</dt><dd>{num(all.sentences)}</dd></div>
        <div><dt>Average length</dt><dd>{all.mean} words</dd></div>
        <div><dt>Spread</dt><dd>± {all.sd} words</dd></div>
        <div><dt>Rhythm</dt><dd title="Spread divided by the average. Low means the sentences are all about the same length.">{all.cv}{all.sentences > 4 ? (all.cv < 0.4 ? ' · even' : all.cv > 0.7 ? ' · varied' : '') : ''}</dd></div>
        <div><dt>Longest</dt><dd>{all.longest} words</dd></div>
        {one && <div><dt>Dialogue</dt><dd>{pct(dialogue)}</dd></div>}
        {one && <div><dt>Em dashes</dt><dd>{one.emdashPer1k} per 1,000 (limit {one.emdashMax})</dd></div>}
        {one && <div><dt>Adverbs</dt><dd>{one.adverbsPer1k} per 1,000</dd></div>}
        {one && <div><dt>Hedges</dt><dd title="very, really, just, quite, rather and the like">{one.hedgesPer1k} per 1,000</dd></div>}
        {one && <div><dt>Reading ease</dt><dd title="Flesch reading ease: higher is easier; most commercial fiction is 70 to 90">{one.fleschReadingEase}</dd></div>}
      </dl>
      <label class="check-row">
        <input type="checkbox" checked={show} onChange={(e) => { const on = (e.currentTarget as HTMLInputElement).checked; setShow(on); saveShowFlags(on); }} />
        <span>Mark the flagged words on the page</span>
      </label>
      <p class="panel-key">{flagged ? (flagged === 1 ? '1 thing to look at' : flagged + ' things to look at') : 'Nothing flagged'}</p>
      {results.map((r, si) => (
        <div key={sections[si].key} class="check-group">
          {many && r.shown.length > 0 && <p class="check-scene">{sections[si].label} <span class="meta">· {r.stats.tellIndex} {r.stats.tellGrade}</span></p>}
          <ol class="check-list">
            {r.shown.map((it, k) => (
              <li key={k}>
                <button type="button" class={'check-item sev-' + it.sev} aria-current={picked === sections[si].key + ':' + k ? 'true' : undefined} onClick={() => jump(si, k, it)}>
                  <span class="check-where"><span class="sev-dot" aria-hidden="true" />Paragraph {it.para} · {sevWord(it.sev)}</span>
                  <span class="check-text">{it.text.length > 90 ? it.text.slice(0, 87) + '…' : it.text}</span>
                  <span class="check-msg">{it.msg}{it.fix ? ' ' + it.fix : ''}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p class="hint">Free and on this device: nothing is sent to the team. Press a flag to see its words in the page.</p>
      {deeper}
    </div>
  );
}
