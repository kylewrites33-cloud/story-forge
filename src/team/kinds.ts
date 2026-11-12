// The kinds of job, from the one list in the vault's schema (`types.job.kinds`, 2026-11-12, step 4 of the code structure
// redesign). The runner (the vault's System/Tools/jobs.mjs) reads the same list for who runs a kind and what the agent
// is told; the app reads it for what a kind is called, the title a job gets when Kyle gives none, and the fixed
// instructions some kinds carry in their ask. A new kind is an entry in that list, not a change here.
import type { Schema } from '../lib/types.ts';

/** One kind as the schema lists it. The app uses these fields; `agent` and `steps` are the runner's. */
export interface KindDef {
  /** What the app calls it, in Kyle's words. */
  label?: string;
  /** The title of a job when Kyle gives none; `<<what>>` is the target and its name. */
  title?: string;
  /** The title when there is no target. */
  title_without?: string;
  agent?: string;
  /** The fixed part of the ask (`<<target>>`; `<<words|target>>` is Kyle's words, or the target when he typed none). */
  ask?: string;
  /** Added when Kyle typed something (`<<words>>`), and when he did not. */
  ask_with_words?: string;
  ask_without_words?: string;
}

let kinds: Record<string, KindDef> = {};

/** Take the list from the vault's schema. A schema from before the list (a copy kept on the device) leaves the last
 * list in place. */
export function kindsFrom(schema: Schema | null | undefined): void {
  const job = schema && schema.types ? (schema.types.job as unknown as { kinds?: Record<string, KindDef> } | undefined) : undefined;
  if (job && job.kinds && Object.keys(job.kinds).length) kinds = job.kinds;
}

export function kindDef(kind: unknown): KindDef {
  return kinds[String(kind || '')] || {};
}

/** Every kind the list has, in its order. */
export function kindNames(): string[] {
  return Object.keys(kinds);
}

const fill = (text: string, v: { target?: string; words?: string; what?: string }): string =>
  text.replace(/<<(target|words|what)(?:\|([^>]*))?>>/g, (_m, name: 'target' | 'words' | 'what', or: string | undefined) => v[name] || (or === 'target' ? v.target || '' : or || ''));

/** What a kind is called in Kyle's words. */
export function kindLabel(kind: unknown): string {
  return kindDef(kind).label || 'Ask the team';
}

/** The title a job gets when Kyle gives no words: "Draft S-045 Grey at the barn", "Notes on Chapter 30". */
export function kindTitle(kind: unknown, target: string, targetTitle = ''): string {
  const k = kindDef(kind);
  const what = [target, targetTitle].filter(Boolean).join(' ');
  if (!k.title) return 'Ask the team';
  return !what && k.title_without != null ? k.title_without : fill(k.title, { what });
}

/** The ## Ask for a kind with fixed instructions: exactly what to do, then Kyle's own words. For any other kind, his
 * words alone. */
export function kindAsk(kind: unknown, target: string, words: string): string {
  const k = kindDef(kind);
  const w = words.trim();
  if (k.ask == null) return w;
  return fill(k.ask + ((w ? k.ask_with_words : k.ask_without_words) || ''), { target, words: w });
}
