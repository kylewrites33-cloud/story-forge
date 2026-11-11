// Publisher Rocket exports Kyle adds from the app. They are saved as they are, beside the market notes, for the Market
// Analyst to read; the app never reads or changes them after that.
import type { DeviceFile, FileEntry } from './types.ts';

export const ROCKET_FOLDER = 'Market/Rocket Exports';

/** The largest file the app sends; GitHub's contents API takes about 1 MB once encoded. */
export const MAX_BYTES = 700 * 1024;

export function rocketFolder(seriesFolder: string): string {
  return seriesFolder + '/' + ROCKET_FOLDER;
}

/** The Rocket files a series already has, by file name, from the vault's file list. */
export function rocketFiles(files: FileEntry[], seriesFolder: string): string[] {
  const prefix = rocketFolder(seriesFolder) + '/';
  return files.filter((f) => f.path.startsWith(prefix) && f.path.indexOf('/', prefix.length) < 0).map((f) => f.path.slice(prefix.length)).sort();
}

/** A safe file name for the vault: no slashes or characters Obsidian and git dislike, ".csv" at the end,
 * and " (2)", " (3)"... when the name is taken, so an earlier export is never replaced. */
export function rocketName(name: string, taken: string[]): string {
  const base = name.replace(/\.csv$/i, '').replace(/[\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Rocket export';
  let out = base + '.csv';
  for (let n = 2; taken.indexOf(out) >= 0; n++) out = base + ' (' + n + ').csv';
  return out;
}

/** A plain sentence saying why this file cannot be added, or null when it can. */
export function rocketProblem(name: string, bytes: number): string | null {
  if (!/\.csv$/i.test(name)) return name + ' is not a CSV file. In Publisher Rocket, use Export and choose CSV, then add that file.';
  if (bytes === 0) return name + ' is empty. Export it from Publisher Rocket again.';
  if (bytes > MAX_BYTES) return name + ' is too big for the app to send (' + Math.round(bytes / 1024) + ' KB; the limit is ' + Math.round(MAX_BYTES / 1024) + ' KB). Drop it in the project chat instead.';
  return null;
}

/** A Rocket file as the one saving system saves it: under a safe name, the next free one if that name is taken. */
export function rocketFile(seriesFolder: string, name: string, text: string): DeviceFile {
  const file = rocketName(name, []);
  return { path: rocketFolder(seriesFolder) + '/' + file, taken: 'next', text: text.replace(/^\uFEFF/, ''), message: 'market: add Rocket file ' + file + '\n\nAdded on the Market board in the Sparrow app.' };
}
