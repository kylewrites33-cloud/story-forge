import type { VaultIndex } from './types.ts';

/** One problem a check found in a book, in plain words, with the page that shows it. */
export type Warning = { text: string; href: string; check: string };

/** A check: the warnings it finds in the book at this folder. */
export type WarningCheck = (index: VaultIndex, bookFolder: string) => Warning[];

