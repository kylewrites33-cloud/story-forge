// Find a scene, name or idea from any page (design review, 2026-10-22): the Chapter Grid's search, made available
// everywhere. "33" finds chapter 33; words find scene titles and headlines, codex names and aliases, and idea titles.
import { codexFor } from './codex.ts';
import { chapterName, sceneLabel } from './board.ts';
import { sceneHeader } from './format.ts';
import type { BookEntry, VaultIndex } from './types.ts';

export interface FindHit { kind: 'scene' | 'codex' | 'idea'; path: string; title: string; sub: string }

export function findIn(index: VaultIndex, book: BookEntry | null, query: string, limit = 30): FindHit[] {
  const q = query.trim().toLowerCase();
  if (!q || !book) return [];
  const has = (s: unknown) => typeof s === 'string' && s.toLowerCase().indexOf(q) >= 0;
  const num = /^\d+$/.test(q) ? Number(q) : null;
  const out: FindHit[] = [];
  const scenes = book.scenes.map((p) => index.notes[p]).filter(Boolean);
  book.scenes.forEach((p) => {
    const n = index.notes[p];
    if (!n || n.data.kind === 'test') return;
    const ch = typeof n.data.chapter === 'number' ? n.data.chapter : null;
    if ((num != null && ch === num) || has(n.data.title) || has(n.data.headline) || has(n.data.id) || has(n.data.chapter_title) || has(chapterName(scenes, ch))) {
      const named = sceneLabel(scenes, n);
      out.push({ kind: 'scene', path: p, title: named.scene || sceneHeader(n.data, p), sub: (named.chapter || 'Scene') + (n.data.status ? ' · ' + n.data.status : '') });
    }
  });
  if (num == null) {
    codexFor(index, book).forEach((e) => {
      const aliases = Array.isArray(e.note.data.aliases) ? e.note.data.aliases : [];
      if (has(e.name) || aliases.some(has)) out.push({ kind: 'codex', path: e.note.path, title: e.name, sub: e.type[0].toUpperCase() + e.type.slice(1) });
    });
    (book.ideas || []).forEach((p) => {
      const n = index.notes[p];
      if (n && (has(n.data.title) || has(n.data.summary))) out.push({ kind: 'idea', path: p, title: String(n.data.title || p), sub: 'Idea' + (n.data.status ? ' · ' + n.data.status : '') });
    });
  }
  return out.slice(0, limit);
}
