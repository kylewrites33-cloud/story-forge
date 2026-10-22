// The book's rooms (Kyle, 2026-10-21): the sidebar shows six rooms instead of every board. The room on screen opens its
// pages beneath it in the sidebar, one level down (design review, 2026-10-22; they were tabs across the top before).
// Home is the Overview. Plan opens with Steps, the old Workflow mode; the Codex has Places, Items and Lore.
// Kyle, 2026-10-22: the rooms under Home are Plan, Write, Edit (was Review) and Publish; the Codex sits lower, with
// Team and To-do. Write (was Manuscript) has no pages: it opens the writing screen at the scene he was last in. The
// Chapter Grid moved into Plan and the Edit Queue into To-do.

export interface Room { key: string; title: string; icon: string; boards: string[] }

export const ROOMS: Room[] = [
  { key: 'home', title: 'Home', icon: 'home', boards: ['overview', 'decide'] },
  { key: 'plan', title: 'Plan', icon: 'threads', boards: ['steps', 'chapter-grid', 'ideas', 'story-juice', 'beat-sheet', 'conflict-matrix', 'promises', 'plot-grid', 'timeline', 'arcs', 'notes'] },
  { key: 'write', title: 'Write', icon: 'pen', boards: [] },
  { key: 'review', title: 'Edit', icon: 'scan', boards: ['tension', 'themes', 'sessions', 'taste'] },
  { key: 'publish', title: 'Publish', icon: 'upload', boards: ['market', 'details'] },
  { key: 'codex', title: 'Codex', icon: 'people', boards: ['characters', 'places', 'items', 'lore', 'matrix', 'cast-web'] }
];

/** Rooms the sidebar lists in its lower group, with Team and To-do, instead of under the book (Kyle, 2026-10-22). */
export const LOWER_ROOMS = ['codex'];

/** The room a board belongs to, or null for a board in no room. */
export function roomOf(board: string): Room | null {
  return ROOMS.find((r) => r.boards.indexOf(board) >= 0) || null;
}

/** The Codex's own pages for each kind of entry, and the note type each lists. */
export const CODEX_PAGES: Record<string, string> = { characters: 'character', places: 'place', items: 'item', lore: 'lore' };

/** The team's places, the pages of the Team room. */
export const TEAM_PLACES: { key: string; title: string; icon: string }[] = [
  { key: 'chat', title: 'Chat', icon: 'chat' },
  { key: 'jobs', title: 'Jobs', icon: 'team' },
  { key: 'team', title: 'Agents', icon: 'people' },
  { key: 'skills', title: 'Skills', icon: 'idea' },
  { key: 'recipes', title: 'Recipes', icon: 'recipe' },
  { key: 'workflow', title: 'Workflow table', icon: 'list' }
];

/** True when a place belongs to the Team room (History is the Agents tab's own page). */
export function isTeamPlace(place: string): boolean {
  return place === 'history' || TEAM_PLACES.some((p) => p.key === place);
}
