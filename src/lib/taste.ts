// The Taste page's numbers: what Kyle keeps, puts aside and drops, by idea kind, by the agent who proposed it and by
// brainstorm round, and the one-press reasons he gives most. Everything comes from the ideas' own properties
// (status, the later tag, kind, source, round, reasons), so the page costs nothing and works offline.
import { pileOf, reasonLabel, reasonsOf, sourceOf } from './ideas.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

/** Kyle's two taste notes at the vault root, shown on the page as they are. */
export const TASTE_FILES: { path: string; title: string }[] = [
  { path: 'Taste/Taste Profile.md', title: 'Taste Profile' },
  { path: 'Taste/Style Fingerprint.md', title: 'Style Fingerprint' }
];

export interface TasteRow {
  key: string;
  kept: number;
  later: number;
  dropped: number;
  /** Not decided yet: to decide or to rewrite. */
  open: number;
  /** Kept out of kept and dropped, 0 to 1, or null when nothing was decided. */
  keepRate: number | null;
}

export interface TasteStats {
  ideas: number;
  kept: number;
  later: number;
  dropped: number;
  byKind: TasteRow[];
  bySource: TasteRow[];
  /** Brainstorm rounds in order (1, 2, 3); ideas with no round are left out. */
  byRound: TasteRow[];
  /** The most given reasons, at most twelve, most first. */
  reasons: { key: string; label: string; count: number }[];
}

/** Every idea in these books (all books when none are given). */
export function tasteIdeas(index: VaultIndex, books?: BookEntry[]): NoteRecord[] {
  return (books || index.books).flatMap((b) => (b.ideas || []).map((p) => index.notes[p]).filter((n) => n && n.type === 'idea'));
}

function rows(notes: NoteRecord[], keyOf: (n: NoteRecord) => string): TasteRow[] {
  const by: Record<string, TasteRow> = {};
  notes.forEach((n) => {
    const key = keyOf(n);
    if (!key) return;
    const r = by[key] || (by[key] = { key, kept: 0, later: 0, dropped: 0, open: 0, keepRate: null });
    const pile = pileOf(n.data);
    if (pile === 'kept') r.kept++;
    else if (pile === 'dropped') r.dropped++;
    else if (pile === 'later') r.later++;
    else r.open++;
  });
  return Object.values(by).map((r) => ({ ...r, keepRate: r.kept + r.dropped ? r.kept / (r.kept + r.dropped) : null }));
}

const total = (r: TasteRow) => r.kept + r.later + r.dropped + r.open;

export function tasteStats(notes: NoteRecord[]): TasteStats {
  const all = rows(notes, () => 'all')[0];
  const reasons: Record<string, number> = {};
  notes.forEach((n) => reasonsOf(n.data).forEach((k) => { reasons[k] = (reasons[k] || 0) + 1; }));
  const roundOf = (n: NoteRecord) => {
    const v = typeof n.data.round === 'number' ? n.data.round : parseInt(String(n.data.round ?? ''), 10);
    return isFinite(v) && v > 0 ? String(Math.round(v)) : '';
  };
  const bigFirst = (a: TasteRow, b: TasteRow) => total(b) - total(a) || a.key.localeCompare(b.key);
  return {
    ideas: notes.length,
    kept: all ? all.kept : 0,
    later: all ? all.later : 0,
    dropped: all ? all.dropped : 0,
    byKind: rows(notes, (n) => String(n.data.kind || '')).sort(bigFirst),
    bySource: rows(notes, (n) => sourceOf(n.data)).sort(bigFirst),
    byRound: rows(notes, roundOf).sort((a, b) => Number(a.key) - Number(b.key)),
    reasons: Object.keys(reasons).map((key) => ({ key, label: reasonLabel(key), count: reasons[key] }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 12)
  };
}

/** "67%", or "–" when nothing was decided. */
export function percent(rate: number | null): string {
  return rate == null ? '–' : Math.round(rate * 100) + '%';
}

/** A file's text without its properties block, for showing a note as a page. */
export function withoutProperties(text: string): string {
  return text.replace(/^﻿?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '');
}
