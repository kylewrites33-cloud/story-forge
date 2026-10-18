// The AI team and its skills, read from the vault's .claude folder: one file per agent (.claude/agents/<name>.md),
// one folder per skill (.claude/skills/<name>/SKILL.md), and each agent's memory (.claude/agent-memory/<name>/
// MEMORY.md for lessons, Journal.md for what it has done). The lists follow the files, so a new agent or skill shows
// up on the next sync. Which agents can use a skill comes from each agent's `skills:` list; the coordinator can run any.
import { Frontmatter } from './frontmatter.js';
import type { FileEntry, SaveEntry, Schema, VaultIndex } from './types.ts';

/** The team's files as text, by path, with the blob sha so an unchanged file is never fetched twice. */
export type TeamFiles = Record<string, { sha: string; text: string }>;

const AGENT_RE = /^\.claude\/agents\/([^/]+)\.md$/;
const SKILL_RE = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/;
const MEMORY_RE = /^\.claude\/agent-memory\/([^/]+)\/(MEMORY|Journal)\.md$/;

/** The team's files in the vault's tree. */
export function teamFiles(files: FileEntry[]): FileEntry[] {
  return files.filter((f) => AGENT_RE.test(f.path) || SKILL_RE.test(f.path) || MEMORY_RE.test(f.path));
}

/** Teams in the order the Team page shows them, each with its colour (a mid tone that reads in light and dark). */
export const TEAMS: [string, string][] = [
  ['Leadership', '#7c5cf0'],
  ['Story', '#d9534f'],
  ['Writing', '#d6608f'],
  ['Editorial', '#3f8f7a'],
  ['Memory', '#677489'],
  ['Research & Market', '#b07a2a'],
  ['Other', '#8a8a96']
];

export function teamColour(team: string): string {
  const t = TEAMS.find(([name]) => name.toLowerCase() === team.toLowerCase());
  return t ? t[1] : TEAMS[TEAMS.length - 1][1];
}

/** A colour for someone's initials, steady for a name. */
const AVATARS = ['#7c5cf0', '#e07a5f', '#d9534f', '#2a9d8f', '#f08c2e', '#b5838d', '#6a994e', '#a26db6', '#52796f', '#d6608f', '#4a6fa5', '#9c6644', '#677489', '#b07a2a'];
export function avatarColour(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 1)).toUpperCase();
}

/** "story-specialist" as "Story Specialist". */
export function agentName(slug: string): string {
  return slug.split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

const ACRONYMS: Record<string, string> = { kdp: 'KDP', ai: 'AI', ku: 'KU' };
/** "kdp-packaging" as "KDP packaging": a skill's folder name in plain words. */
export function skillLabel(name: string): string {
  const words = name.split(/[-_\s]+/).filter(Boolean).map((w) => ACRONYMS[w.toLowerCase()] || w.toLowerCase());
  if (words.length && !ACRONYMS[words[0].toLowerCase()]) words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(' ');
}

/** The first sentence of a description. */
export function firstSentence(text: string): string {
  const t = String(text || '').trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  return m ? m[1] : t;
}

/** An agent's specialty: its description's first two sentences ("Creative lead. Use proactively for premise, ..."). */
export function specialtyOf(text: string): string {
  const one = firstSentence(text);
  const rest = String(text || '').trim().slice(one.length).trim();
  return rest ? one + ' ' + firstSentence(rest) : one;
}

export interface HistoryEntry {
  /** "2026-10-17" or a full ISO time. */
  date: string;
  /** Who did it, as the team calls them ("Writer", "Coordinator"). */
  who: string;
  title: string;
  /** More, as Markdown: a journal entry's lines or a job's result. */
  text: string;
  kind: 'journal' | 'job' | 'save';
  /** Where to read more: a job note's path in the app. */
  path?: string;
}

export interface Member {
  slug: string;
  name: string;
  team: string;
  description: string;
  specialty: string;
  model: string;
  tools: string;
  /** Skills loaded whenever this agent starts, by folder name. */
  skills: string[];
  /** The curated lessons in MEMORY.md, one line each. */
  lessons: string[];
  journal: HistoryEntry[];
  path: string;
}

export interface Skill {
  name: string;
  label: string;
  description: string;
  /** Names of the agents whose `skills:` list loads it. */
  agents: string[];
  /** The skill's own line on which agents it brings in, if it has one. */
  bringsIn: string;
  path: string;
}

export interface Team {
  members: Member[];
  skills: Skill[];
}

function str(v: unknown): string {
  return v == null ? '' : Array.isArray(v) ? v.map(String).join(', ') : String(v).trim();
}

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = str(v);
  return s ? s.split(/\s*,\s*/).filter(Boolean) : [];
}

/** Journal entries: every heading that starts with a date, and the lines under it up to the next heading. */
export function journalEntries(text: string, who: string): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  let cur: HistoryEntry | null = null;
  const lines: string[] = [];
  const close = () => {
    if (cur) { cur.text = lines.join('\n').trim(); out.push(cur); }
    cur = null;
    lines.length = 0;
  };
  String(text || '').split(/\r?\n/).forEach((line) => {
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      close();
      const m = /^(\d{4}-\d{2}-\d{2})\s*(.*)$/.exec(h[1].trim());
      if (m) {
        const title = m[2].replace(/^\([^)]*\)\s*/, '').replace(/^[·:—–-]+\s*/, '').trim();
        cur = { date: m[1], who, title: title || 'Journal entry', text: '', kind: 'journal' };
      }
      return;
    }
    if (cur) lines.push(line);
  });
  close();
  return out;
}

/** The lessons in a MEMORY.md: list lines under "## Lessons", up to the next section (the Archive holds retired ones). */
export function lessonsOf(text: string): string[] {
  const out: string[] = [];
  let inLessons = false;
  String(text || '').split(/\r?\n/).forEach((line) => {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) { inLessons = /^lessons\b/i.test(h[1].trim()); return; }
    if (inLessons && /^\s*-\s+\S/.test(line)) out.push(line.replace(/^\s*-\s+/, '').trim());
  });
  return out;
}

/** The skill's "**Agents**:" line, as plain words. */
export function bringsInOf(body: string): string {
  const m = /^\s*-?\s*\*\*Agents\*\*:\s*(.+)$/m.exec(String(body || ''));
  return m ? m[1].replace(/`([^`]*)`/g, '$1').trim() : '';
}

export function buildTeam(files: TeamFiles | undefined): Team {
  const members: Member[] = [];
  const skills: Skill[] = [];
  const memory: Record<string, { lessons?: string; journal?: string }> = {};
  Object.keys(files || {}).sort().forEach((path) => {
    const text = files![path].text;
    const mm = MEMORY_RE.exec(path);
    if (mm) {
      const m = (memory[mm[1]] = memory[mm[1]] || {});
      if (mm[2] === 'MEMORY') m.lessons = text; else m.journal = text;
      return;
    }
    const a = AGENT_RE.exec(path);
    const s = SKILL_RE.exec(path);
    if (!a && !s) return;
    const p = Frontmatter.parse(text);
    const d = (p.data || {}) as Record<string, unknown>;
    if (a) {
      const slug = a[1];
      const name = agentName(str(d.name) || slug);
      const description = str(d.description);
      members.push({
        slug, name, description, specialty: specialtyOf(description),
        team: str(d.team) || 'Other', model: str(d.model), tools: str(d.tools), skills: list(d.skills),
        lessons: [], journal: [], path
      });
    } else if (s) {
      const name = str(d.name) || s[1];
      skills.push({ name, label: skillLabel(name), description: str(d.description), agents: [], bringsIn: bringsInOf(p.body || ''), path });
    }
  });
  members.forEach((m) => {
    const mem = memory[m.slug];
    if (!mem) return;
    m.lessons = lessonsOf(mem.lessons || '');
    m.journal = journalEntries(mem.journal || '', m.name).sort((x, y) => y.date.localeCompare(x.date));
  });
  skills.forEach((sk) => {
    sk.agents = members.filter((m) => m.skills.indexOf(sk.name) >= 0).map((m) => m.name);
  });
  const teamAt = (t: string) => { const i = TEAMS.findIndex(([n]) => n.toLowerCase() === t.toLowerCase()); return i < 0 ? TEAMS.length : i; };
  members.sort((x, y) => teamAt(x.team) - teamAt(y.team) || x.name.localeCompare(y.name));
  skills.sort((x, y) => x.name.localeCompare(y.name));
  return { members, skills };
}

const same = (a: unknown, b: string) => str(a).toLowerCase() === b.toLowerCase();

/** Jobs an agent ran, as history: the job's title and result, timed when it finished (or was asked). */
export function jobHistory(index: VaultIndex): HistoryEntry[] {
  return (index.jobs || []).map((p) => index.notes[p]).filter((n) => n && str(n.data.agent) && str(n.data.status) !== 'cancelled').map((n) => ({
    date: str(n.data.finished || n.data.started || n.data.created),
    who: str(n.data.agent),
    title: (str(n.data.id) ? str(n.data.id) + ' · ' : '') + str(n.data.title),
    text: str(n.data.result),
    kind: 'job' as const,
    path: n.path
  }));
}

/** Agent saves to the vault (commits with an Agent: line) as history. Kyle's own saves are left out. */
export function saveHistory(saves: SaveEntry[]): HistoryEntry[] {
  return saves.filter((s) => s.agent).map((s) => ({ date: s.date, who: s.agent, title: s.message, text: '', kind: 'save' as const }));
}

/** Everything the team has done, newest first. */
export function history(team: Team, index: VaultIndex, saves: SaveEntry[] = []): HistoryEntry[] {
  const all = ([] as HistoryEntry[]).concat(...team.members.map((m) => m.journal), jobHistory(index), saveHistory(saves));
  return all.filter((e) => e.date).sort((x, y) => y.date.localeCompare(x.date) || x.who.localeCompare(y.who));
}

export interface MemberStats {
  /** Proposals with this agent as their source. */
  ideas: number;
  kept: number;
  /** Proposals Kyle kept or dropped. */
  decided: number;
  /** The newest date in the agent's journal or jobs, or ''. */
  lastUsed: string;
}

/** Ideas, kept share and last used for one agent, from the notes the app has and the agent's journal. */
export function memberStats(m: Member, index: VaultIndex | null, schema: Schema | null): MemberStats {
  let ideas = 0, kept = 0, decided = 0;
  let lastUsed = m.journal.length ? m.journal[0].date : '';
  if (index) {
    Object.values(index.notes).forEach((n) => {
      const def = schema && schema.types[n.type];
      const status = def && def.properties && def.properties.status;
      if (!status || (status as { enum?: unknown }).enum !== 'proposal' || !same(n.data.source, m.name)) return;
      ideas++;
      const st = str(n.data.status);
      if (st === 'keep' || st === 'done') { kept++; decided++; }
      if (st === 'discard') decided++;
    });
    jobHistory(index).forEach((e) => { if (same(e.who, m.name) && e.date > lastUsed) lastUsed = e.date; });
  }
  return { ideas, kept, decided, lastUsed };
}

/** "75%", or a dash when Kyle has decided none of the agent's ideas yet. */
export function keptLabel(s: MemberStats): string {
  return s.decided ? Math.round((s.kept / s.decided) * 100) + '%' : '—';
}

/** "today", "yesterday", "3 days ago", "never". */
export function lastUsedLabel(date: string, now: Date = new Date()): string {
  if (!date) return 'never';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - then.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 60) return days + ' days ago';
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Sort the team: recently used first, A to Z, or by team (then name). */
export type TeamSort = 'recent' | 'az' | 'team';
export function sortMembers(members: Member[], stats: Record<string, MemberStats>, by: TeamSort): Member[] {
  const teamAt = (t: string) => { const i = TEAMS.findIndex(([n]) => n.toLowerCase() === t.toLowerCase()); return i < 0 ? TEAMS.length : i; };
  return members.slice().sort((x, y) => {
    if (by === 'recent') return (stats[y.slug]?.lastUsed || '').localeCompare(stats[x.slug]?.lastUsed || '') || x.name.localeCompare(y.name);
    if (by === 'team') return teamAt(x.team) - teamAt(y.team) || x.name.localeCompare(y.name);
    return x.name.localeCompare(y.name);
  });
}

/** Read the team's files, reusing the ones whose sha has not changed since the last sync. */
export async function readTeam(files: FileEntry[], read: (path: string, sha: string) => Promise<string>, previous?: TeamFiles): Promise<TeamFiles> {
  const out: TeamFiles = {};
  const wanted = teamFiles(files);
  let next = 0;
  const worker = async () => {
    while (next < wanted.length) {
      const f = wanted[next++];
      const old = previous && previous[f.path];
      out[f.path] = old && old.sha === f.sha ? old : { sha: f.sha, text: await read(f.path, f.sha) };
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, wanted.length) }, worker));
  return out;
}
