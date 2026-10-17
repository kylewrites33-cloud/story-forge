// How property values read on cards and in the note view.
import { linkName, nameList, toNumber } from './links.ts';
import type { PropertyDef } from './types.ts';

const LABELS: Record<string, string> = { pov: 'POV', id: 'ID', ai: 'AI', ku: 'KU' };

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
