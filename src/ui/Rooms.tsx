// Each room's pages and their addresses. Since the design review (2026-10-22) they are listed under the room in the
// sidebar and in the top bar's menu; they were tabs across the top of the room before.
import type { Schema } from '../lib/types.ts';
import { boardLinks, type BoardLink } from './StoryBoards.tsx';
import { href } from './route.ts';

/** The book's boards with Book details added, keyed by board. In Workflow mode the Chapter Grid has its own address. */
export function roomLinks(schema: Schema, folder: string, workflow: boolean): Record<string, BoardLink> {
  const out: Record<string, BoardLink> = {};
  boardLinks(schema, folder).forEach((l) => { out[l.key] = l; });
  out.details = { key: 'details', title: 'Book details', to: href.board('details', folder), icon: 'image' };
  if (workflow && out['chapter-grid']) out['chapter-grid'] = { ...out['chapter-grid'], to: href.board('chapter-grid', folder) };
  if (out.overview) out.overview = { ...out.overview, title: 'Overview' };
  out.decide = { key: 'decide', title: 'Decide one at a time', to: href.board('decide', folder), icon: 'cards' };
  // The Edit room's pages for Workflow 1.2's editing stage (2026-10-24).
  out.changes = { key: 'changes', title: 'Changes', to: href.board('changes', folder), icon: 'swap' };
  out['story-calls'] = { key: 'story-calls', title: 'Story calls', to: href.board('story-calls', folder), icon: 'cards' };
  out.steps = { key: 'steps', title: 'Steps', to: href.flow(folder), icon: 'outline' };
  if (out.characters) {
    out.places = { key: 'places', title: 'Places', to: href.board('places', folder), icon: 'map' };
    out.items = { key: 'items', title: 'Items', to: href.board('items', folder), icon: 'item' };
    out.lore = { key: 'lore', title: 'Lore', to: href.board('lore', folder), icon: 'lore' };
  }
  return out;
}
