// How property values read on cards and in the note view.
import { linkName, nameList, toNumber } from './links.ts';
import type { PropertyDef } from './types.ts';

const LABELS: Record<string, string> = { pov: 'POV', id: 'ID', ai: 'AI', ku: 'KU', sub_subgenre: 'Niche', protagonist_type: 'Hero', headline: 'Summary',
  wants: 'Wants over time', open: 'Not decided yet' };

/** A list of sentences (a character's wants, looks or abilities, each with its scene) reads as lines, not one comma run
 * (Kyle, 2026-10-23). */
export function longList(v: unknown): boolean {
  return Array.isArray(v) && v.length > 1 && listLines(v).some((x) => x.length > 40);
}

/** A list's items as plain lines. An unquoted "B2 S-024: Terrakinesis" reads back as a one-key object; it shows as written. */
export function listLines(v: unknown): string[] {
  return (Array.isArray(v) ? v : [v]).map((x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.entries(x as Record<string, unknown>).map(([k, y]) => k + ': ' + String(y)).join('; ')
    : String(x ?? ''))).filter(Boolean);
}

export function label(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isEmptyValue(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

export function formatValue(key: string, v: unknown, def: PropertyDef | null): string {
  if (isEmptyValue(v)) return '';
  if (key === 'words') {
    const n = toNumber(v) || 0;
    return n.toLocaleString('en-US') + (n === 1 ? ' word' : ' words');
  }
  if (key === 'monthly_earnings') {
    const n = toNumber(v);
    if (n != null) return '$' + n.toLocaleString('en-US') + ' a month';
  }
  if (key === 'price') {
    const n = toNumber(v);
    if (n != null) return '$' + n.toFixed(2);
  }
  if (def && def.type === 'list') return nameList(v).join(', ');
  if (def && def.type === 'link') return linkName(v);
  if (Array.isArray(v)) return nameList(v).join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString('en-US');
  if (typeof v === 'object') return JSON.stringify(v);
  return linkName(v) || String(v);
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (isNaN(then.getTime())) return 'never';
  const mins = Math.round((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
  const sameDay = then.toDateString() === now.toDateString();
  const time = then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return 'today at ' + time;
  return then.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' at ' + time;
}

/** What a scene is called on screen: its one-line summary (`headline`, written by the team, editable by Kyle), or its
 * title (the file's name, often the scene's first words) until it has one. */
export function sceneHeader(data: Record<string, unknown>, fallback = ''): string {
  const h = typeof data.headline === 'string' ? data.headline.trim() : '';
  if (h) return h;
  const t = data.title == null ? '' : String(data.title).trim();
  return t || (data.id == null ? '' : String(data.id)) || fallback;
}
