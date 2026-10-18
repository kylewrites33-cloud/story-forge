import type { VaultIndex } from './types.ts';
import { promiseWarnings } from './promises.ts';
import { plotGapWarnings } from './plotgrid.ts';

/** One problem a check found in a book, in plain words, with the page that shows it. */
export type Warning = { text: string; href: string; check: string };

/** A check: the warnings it finds in the book at this folder. */
export type WarningCheck = (index: VaultIndex, bookFolder: string) => Warning[];

/** Every check whose warnings the book's Overview gathers. */
export const CHECKS: WarningCheck[] = [promiseWarnings, plotGapWarnings];

export function bookWarnings(index: VaultIndex, bookFolder: string): Warning[] {
  return CHECKS.flatMap((check) => check(index, bookFolder));
}
