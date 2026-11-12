// The one way to read a note's properties. A name the schema does not have fails the type check, so a misspelt
// property is caught before it ships; the names are src/lib/prop-names.ts, written from the schema.
import type { Prop } from './prop-names.ts';

/** Anything that carries a note's properties. */
interface HasProps { data: Record<string, unknown> }

/** A property as text; '' when it is missing or empty. */
export function propText(n: HasProps, key: Prop): string {
  return String(n.data[key] || '');
}

/** A property as a number; 0 when it is missing or not a number. */
export function propNum(n: HasProps, key: Prop): number {
  return Number(n.data[key]) || 0;
}
