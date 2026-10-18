// The beat ruler on the Chapter Grid: where each Save the Cat beat should fall, by percent of the book's words, and
// whether the scenes tagged with each of the book's save-the-cat beat notes land early, on time or late.
// Percentages: Blake Snyder, Save the Cat! (2005), and Jessica Brody, Save the Cat! Writes a Novel (2018), as the vault's
// save-the-cat skill sets them out.
import { linkName, nameList } from './links.ts';
import { scenePositions, storyScenes } from './tension.ts';
import type { BookEntry, NoteRecord, VaultIndex } from './types.ts';

export const RULER_SOURCE = 'Blake Snyder, Save the Cat! (2005); Jessica Brody, Save the Cat! Writes a Novel (2018); percentages as in the vault\'s save-the-cat skill';

/** The fifteen beats with where they fall: one point (from = to) or a stretch, in percent of the book. */
export interface BeatDef { id: string; name: string; short: string; from: number; to: number }

export const SAVE_THE_CAT: BeatDef[] = [
  { id: 'opening-image', name: 'Opening Image', short: 'Open', from: 0, to: 1 },
  { id: 'theme-stated', name: 'Theme Stated', short: 'Theme', from: 5, to: 5 },
  { id: 'setup', name: 'Setup', short: 'Setup', from: 1, to: 10 },
  { id: 'catalyst', name: 'Catalyst', short: 'Cat', from: 10, to: 10 },
  { id: 'debate', name: 'Debate', short: 'Debate', from: 10, to: 20 },
  { id: 'break-into-two', name: 'Break Into Two', short: 'B2', from: 20, to: 20 },
  { id: 'b-story', name: 'B Story', short: 'B St', from: 22, to: 22 },
  { id: 'fun-and-games', name: 'Fun and Games', short: 'Fun', from: 20, to: 50 },
  { id: 'midpoint', name: 'Midpoint', short: 'Mid', from: 50, to: 50 },
  { id: 'bad-guys-close-in', name: 'Bad Guys Close In', short: 'Bad', from: 50, to: 75 },
  { id: 'all-is-lost', name: 'All Is Lost', short: 'Lost', from: 75, to: 75 },
  { id: 'dark-night', name: 'Dark Night of the Soul', short: 'Night', from: 75, to: 80 },
  { id: 'break-into-three', name: 'Break Into Three', short: 'B3', from: 80, to: 80 },
  { id: 'finale', name: 'Finale', short: 'Finale', from: 80, to: 99 },
  { id: 'final-image', name: 'Final Image', short: 'End', from: 99, to: 100 }
];

/** How far, in percentage points, a scene may sit outside its beat's place and still count as on time. */
export const TOLERANCE = 3;

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Which of the fifteen beats a beat note is: its position names the id ("save-the-cat catalyst"), or its title is the
 * beat's name ("Catalyst", "Dark night"). */
export function beatDefFor(note: NoteRecord): BeatDef | null {
  const pos = slug(String(note.data.position || ''));
  const title = slug(String(note.data.title || ''));
  const byId = SAVE_THE_CAT.slice().sort((a, b) => b.id.length - a.id.length).find((d) => new RegExp('(^|-)' + d.id + '(-|$)').test(pos));
  if (byId) return byId;
  return SAVE_THE_CAT.find((d) => d.id === title || slug(d.name) === title || (d.id === 'dark-night' && title.startsWith('dark-night'))) || null;
}

export type Verdict = 'early' | 'on-time' | 'late' | 'no-scenes';

export interface RulerBeat {
  def: BeatDef;
  note: NoteRecord;
  /** The tagged scenes' IDs, in reading order. */
  scenes: string[];
  /** Where the tagged scenes sit, in percent of the book: from the first one's start to the last one's end. */
  at: { from: number; to: number } | null;
  verdict: Verdict;
}

export function verdictFor(def: BeatDef, at: { from: number; to: number } | null, tol = TOLERANCE): Verdict {
  if (!at) return 'no-scenes';
  if (at.to < def.from - tol) return 'early';
  if (at.from > def.to + tol) return 'late';
  return 'on-time';
}

/** The book's save-the-cat beat notes on the ruler, with their scenes: a scene's `beat` link, or the beat's `scenes` list
 * ("S-012" or "[[S-012 Title]]"). */
export function beatRuler(index: VaultIndex, book: BookEntry): RulerBeat[] {
  const scenes = storyScenes(index, book);
  const spans = scenePositions(scenes);
  const ids = scenes.map((s) => String(s.data.id || '').toUpperCase());
  const beats = (book.beats || []).map((p) => index.notes[p]).filter((n): n is NoteRecord => Boolean(n) && n.data.framework === 'save-the-cat');
  const out: RulerBeat[] = [];
  beats.forEach((b) => {
    const def = beatDefFor(b);
    if (!def) return;
    // A scene's beat link names the note's file ("B-012 Catalyst"), its ID or its title.
    const id = String(b.data.id || '').toLowerCase();
    const names = [id, String(b.data.title || '').toLowerCase(), b.path.replace(/^.*\//, '').replace(/\.md$/, '').toLowerCase()].filter(Boolean);
    const tagged = new Set<number>();
    scenes.forEach((s, i) => {
      const link = linkName(s.data.beat).toLowerCase();
      if (link && (names.indexOf(link) >= 0 || (id && link.startsWith(id + ' ')))) tagged.add(i);
    });
    nameList(b.data.scenes).forEach((x) => {
      const m = x.match(/\bS-\d{3}\b/i);
      const i = m ? ids.indexOf(m[0].toUpperCase()) : -1;
      if (i >= 0) tagged.add(i);
    });
    const list = [...tagged].sort((a, c) => a - c);
    const at = list.length ? { from: spans[list[0]].start, to: spans[list[list.length - 1]].end } : null;
    out.push({ def, note: b, scenes: list.map((i) => ids[i]), at, verdict: verdictFor(def, at) });
  });
  return out.sort((a, b) => a.def.from - b.def.from || SAVE_THE_CAT.indexOf(a.def) - SAVE_THE_CAT.indexOf(b.def));
}

/** Kyle's words for a verdict. */
export const VERDICT_LABEL: Record<Verdict, string> = { early: 'early', 'on-time': 'on time', late: 'late', 'no-scenes': 'no scene yet' };

/** "10%" or "20–50%". */
export function placeLabel(def: BeatDef): string {
  return def.from === def.to ? def.from + '%' : def.from + '–' + def.to + '%';
}
