// The workflow: every step of a book, who does it and whether it is one mind or several, read from the vault's
// System/Workflow.md (Kyle, 2026-10-19). Each "## " section with a table whose header has Step and Who is a stage;
// the other sections (what changed, how we judge it, Kyle's notes) are shown as they are. Kyle's notes on the
// workflow are added as dated lines under "## Kyle's notes", so the next version can answer them.
import { Frontmatter } from './frontmatter.js';
import { cells, isTableStart } from './markdown.ts';

export const WORKFLOW_PATH = 'System/Workflow.md';
export const NOTES_HEADING = "Kyle's notes";

export interface WorkflowStep {
  /** The step's number in the workflow, or 0 when the row has none. */
  number: number;
  /** The step's words without its number. */
  step: string;
  who: string;
  minds: string;
  needs: string;
  why: string;
  /** True when the step is more than one mind (anything but "One..."). */
  several: boolean;
  /** Names of the agents the Who cell mentions, in roster order. */
  agents: string[];
}

export interface WorkflowStage {
  title: string;
  /** Markdown around the table (a line on why the stage is ordered as it is). */
  intro: string;
  steps: WorkflowStep[];
}

export interface WorkflowSection {
  title: string;
  markdown: string;
}

export interface Workflow {
  title: string;
  version: string;
  updated: string;
  /** Markdown before the first stage. */
  intro: string;
  stages: WorkflowStage[];
  /** Sections without a step table, in order. */
  sections: WorkflowSection[];
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/** Read the workflow note. Agents named in each step's Who cell are matched against `agentNames`. */
export function parseWorkflow(text: string, agentNames: string[] = []): Workflow | null {
  if (!text || !text.trim()) return null;
  const p = Frontmatter.parse(text);
  const d = (p.data || {}) as Record<string, unknown>;
  const lines = String(p.body || '').replace(/\r\n?/g, '\n').split('\n');
  let title = str(d.title) || 'Workflow';
  const intro: string[] = [];
  const stages: WorkflowStage[] = [];
  const sections: WorkflowSection[] = [];
  let cur: { title: string; lines: string[] } | null = null;
  const close = () => {
    if (!cur) return;
    const stage = stageOf(cur.title, cur.lines, agentNames);
    if (stage) stages.push(stage);
    else sections.push({ title: cur.title, markdown: cur.lines.join('\n').trim() });
    cur = null;
  };
  lines.forEach((line) => {
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1 && !cur && !stages.length) { title = h1[1].trim(); return; }
    const h2 = /^##\s+(.*?)\s*#*\s*$/.exec(line);
    if (h2) { close(); cur = { title: h2[1], lines: [] }; return; }
    if (cur) cur.lines.push(line); else intro.push(line);
  });
  close();
  return { title, version: str(d.version), updated: str(d.updated), intro: intro.join('\n').trim(), stages, sections };
}

function stageOf(title: string, lines: string[], agentNames: string[]): WorkflowStage | null {
  const at = lines.findIndex((_l, i) => isTableStart(lines, i));
  if (at < 0) return null;
  const head = cells(lines[at]).map((c) => c.toLowerCase());
  const col = (name: string) => head.findIndex((c) => c === name || c.startsWith(name));
  if (col('step') < 0 || col('who') < 0) return null;
  const rows: string[][] = [];
  let i = at + 2;
  while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
  const cell = (r: string[], name: string) => { const k = col(name); return k < 0 ? '' : r[k] || ''; };
  const steps = rows.map((r) => {
    const raw = cell(r, 'step');
    const m = /^(\d+)\.\s*(.*)$/.exec(raw);
    const who = cell(r, 'who');
    const minds = cell(r, 'minds');
    const low = who.toLowerCase();
    return {
      number: m ? Number(m[1]) : 0, step: m ? m[2] : raw, who, minds, needs: cell(r, 'needs'), why: cell(r, 'why'),
      several: !!minds && !/^one\b/i.test(minds), agents: agentNames.filter((n) => low.indexOf(n.toLowerCase()) >= 0)
    };
  });
  const introLines = lines.slice(0, at).concat(lines.slice(i));
  return { title, intro: introLines.join('\n').trim(), steps };
}

/** Every step, in order. */
export function allSteps(w: Workflow | null): WorkflowStep[] {
  return w ? ([] as WorkflowStep[]).concat(...w.stages.map((s) => s.steps)) : [];
}

/** The steps an agent works on, with the stage each sits in. */
export function stepsFor(w: Workflow | null, agent: string): { stage: string; step: WorkflowStep }[] {
  if (!w) return [];
  const out: { stage: string; step: WorkflowStep }[] = [];
  w.stages.forEach((s) => s.steps.forEach((st) => { if (st.agents.indexOf(agent) >= 0) out.push({ stage: s.title, step: st }); }));
  return out;
}

/** The note with one more dated line under "## Kyle's notes" (the section is added if missing; "(None yet.)" goes). */
export function addWorkflowNote(text: string, note: string, date: string): string {
  const line = '- ' + date + ': ' + note.trim().replace(/\s*\n+\s*/g, ' ');
  const src = String(text || '').replace(/\s+$/, '');
  const lines = src.split('\n');
  const at = lines.findIndex((l) => /^##\s+/.test(l) && l.replace(/^##\s+/, '').trim().toLowerCase() === NOTES_HEADING.toLowerCase());
  if (at < 0) return src + '\n\n## ' + NOTES_HEADING + '\n\n' + line + '\n';
  let end = lines.findIndex((l, i) => i > at && /^##?\s+/.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(at + 1, end).filter((l) => !/^\s*\(none yet\.?\)\s*$/i.test(l));
  while (body.length && !body[body.length - 1].trim()) body.pop();
  const next = [''].concat(body.filter((_l, i) => i > 0 || body[0].trim()), [line]);
  if (next.length > 1 && !next[1].trim()) next.splice(1, 1);
  const out = lines.slice(0, at + 1).concat(next, end < lines.length ? [''] : [], lines.slice(end));
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
}
