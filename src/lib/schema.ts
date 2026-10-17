// Reads System/schema.json and answers the questions the screens ask of it.
import type { BoardDef, PropertyDef, Schema, TypeDef } from './types.ts';

export const SCHEMA_PATH = 'System/schema.json';
export const CONFIG_PATH = 'System/Config.md';

/** Parse the schema text. Throws an error whose message is a plain sentence. */
export function parseSchema(text: string): Schema {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(SCHEMA_PATH + ' is not valid JSON: ' + (e as Error).message);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(SCHEMA_PATH + ' does not hold a schema object.');
  const s = raw as Partial<Schema>;
  if (typeof s.version !== 'number') throw new Error(SCHEMA_PATH + ' has no version number.');
  if (!s.types || typeof s.types !== 'object') throw new Error(SCHEMA_PATH + ' lists no note types.');
  for (const name of ['series', 'book', 'scene']) {
    if (!s.types[name]) throw new Error(SCHEMA_PATH + ' has no "' + name + '" type, and the app needs it.');
  }
  return { version: s.version, statuses: s.statuses || {}, common: s.common, types: s.types, boards: s.boards || {} };
}

export function typeDef(schema: Schema, type: string): TypeDef | null {
  return schema.types[type] || null;
}

/** A property's definition, from the type or from the properties every type shares. */
export function propDef(schema: Schema, type: string, key: string): PropertyDef | null {
  const def = schema.types[type];
  return (def && def.properties && def.properties[key]) || (schema.common && schema.common.properties && schema.common.properties[key]) || null;
}

/** The values an enum allows: a named status set, or a literal list. */
export function enumValues(schema: Schema, p: PropertyDef | null): string[] {
  if (!p || p.enum === undefined) return [];
  if (typeof p.enum === 'string') return schema.statuses[p.enum] || [];
  return p.enum.map(String);
}

/** The properties a board card shows for this type, in the schema's order. */
export function cardFields(schema: Schema, type: string): string[] {
  const def = schema.types[type];
  return (def && def.board && def.board.card) || ['title', 'status'];
}

/** The board a type opens on by default, with its key. */
export function defaultBoard(schema: Schema, type: string): { key: string; board: BoardDef } | null {
  const def = schema.types[type];
  const key = def && def.board && def.board.default;
  if (!key || !schema.boards[key]) return null;
  return { key, board: schema.boards[key] };
}

/** Every property of a note in display order: the type's own properties first, then shared ones, then anything else. */
export function propertyOrder(schema: Schema, type: string, data: Record<string, unknown>): string[] {
  const def = schema.types[type];
  const own = Object.keys((def && def.properties) || {});
  const common = Object.keys((schema.common && schema.common.properties) || {});
  const known = own.concat(common.filter((k) => own.indexOf(k) < 0));
  const extra = Object.keys(data).filter((k) => known.indexOf(k) < 0);
  return known.filter((k) => k in data).concat(extra);
}

/** The note types the app indexes: series and books, plus every type on a board of the given phase or earlier. */
export function indexedTypes(schema: Schema, phase: number): string[] {
  const out = ['series', 'book'];
  Object.values(schema.boards).forEach((b) => {
    if ((b.phase ?? 1) <= phase) b.types.forEach((t) => { if (out.indexOf(t) < 0 && schema.types[t]) out.push(t); });
  });
  return out;
}
