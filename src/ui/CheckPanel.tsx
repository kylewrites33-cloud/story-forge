// Check (AI phrases) beside the page: the vault tool's linter run on this device, free, with no team job. The score and
// grade, the rhythm numbers and a list of what it flagged; pressing a flag selects its words in the page. Where the
// browser can, the flagged words are also highlighted in the page (CSS highlights, never in the text or the file).
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { checkText, combine, loadShowFlags, saveShowFlags, sevWord, type CheckIssue, type CheckOptions, type CheckResult } from '../lib/lintcheck.ts';
import { rangesIn } from './StyledEditor.tsx';
import { bringIntoView, canHighlight, paintHighlight } from './highlight.ts';

/** One scene on the page: its words, the writing box it is in (null for the plain text box) and how to select in it. */
export interface CheckSection {
  key: string;
  /** Shown above its flags when the page holds several scenes (Whole chapter). */
  label: string;
  text: string;
  root: () => HTMLElement | null;
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
  const highlights = canHighlight();

  // Draw the flags over the page, and again whenever the page is redrawn (typing, names, Find).
  useEffect(() => {
    if (!highlights) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const paint = () => {
      const all: Range[] = [], now: Range[] = [];
      live.current.forEach((s, i) => {
        const root = s.root();
        const c = checked[i];
        if (!root || !c || c.text !== s.text) return;
        const r = c.result;
        const list = r.shown;
        const ranges = rangesIn(root, list.map((it) => ({ start: it.from, end: it.to })));
        ranges.forEach((rg, k) => { if (show) all.push(rg); if (picked === s.key + ':' + k) now.push(rg); });
      });
      paintHighlight('sf-check', all);
      paintHighlight('sf-check-now', now);
    };
    paint();
    const watch = new MutationObserver(() => { if (timer) clearTimeout(timer); timer = setTimeout(paint, 250); });
    live.current.forEach((s) => { const root = s.root(); if (root) watch.observe(root, { childList: true, subtree: true, characterData: true }); });
    return () => { watch.disconnect(); if (timer) clearTimeout(timer); };
  }, [checked, show, picked, textKey]);
  useEffect(() => () => { paintHighlight('sf-check', []); paintHighlight('sf-check-now', []); }, []);

  const jump = (si: number, k: number, it: CheckIssue) => {
    const s = sections[si];
    setPicked(s.key + ':' + k);
    const root = s.root();
    // Where the words can be marked, mark and show them without opening the keyboard; otherwise select them.
    if (root && highlights) { const [r] = rangesIn(root, [{ start: it.from, end: it.to }]); if (r) bringIntoView(r); }
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
      <p class="hint">Under 2 is clean, under 5 light, under 10 noticeable, 10 or more heavy (the same score as the team's sf lint). A flag is a prompt to look, never a verdict.</p>
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
      {highlights && (
        <label class="check-row">
          <input type="checkbox" checked={show} onChange={(e) => { const on = (e.currentTarget as HTMLInputElement).checked; setShow(on); saveShowFlags(on); }} />
          <span>Mark the flagged words on the page</span>
        </label>
      )}
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
      <p class="hint">Free and on this device: nothing is sent to the team. {highlights ? 'Press a flag to see its words in the page.' : 'Press a flag to select its words in the page.'}</p>
      {deeper}
    </div>
  );
}
