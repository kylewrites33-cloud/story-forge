// Shapes shared by the vault reader, the cache and the screens.

export interface PropertyDef {
  type?: string;
  const?: unknown;
  enum?: string | unknown[];
  default?: unknown;
  to?: string;
  items?: PropertyDef;
  pattern?: string;
  computed?: boolean;
}

export interface TypeDef {
  description?: string;
  scope: string | string[];
  folder?: string;
  idPrefix?: string;
  filename?: string;
  required?: string[];
  properties?: Record<string, PropertyDef>;
  board?: { default?: string; card?: string[] };
  body?: string;
  /** Other forms of the type, such as a character's book delta: { delta: { marker, scope, folder } }. */
  variants?: Record<string, { marker?: string; scope?: string | string[]; folder?: string; required?: string[] }>;
}

export interface BoardDef {
  title: string;
  types: string[];
  groupBy?: string;
  sortBy?: string;
  phase?: number;
}

export interface Schema {
  version: number;
  statuses: Record<string, string[]>;
  common?: { properties?: Record<string, PropertyDef> };
  types: Record<string, TypeDef>;
  boards: Record<string, BoardDef>;
}

/** A file in the vault, as git knows it. Paths are relative to the vault root. */
export interface FileEntry {
  path: string;
  sha: string;
}

/** Where the vault comes from: GitHub, or the demo vault bundled with the app. */
export interface VaultSource {
  /** A stable name for the cache, such as "github:owner/repo@main:" or "demo". */
  readonly key: string;
  readonly label: string;
  tree(): Promise<{ files: FileEntry[]; truncated: boolean }>;
  read(path: string, sha: string): Promise<string>;
  /** A note's text and blob sha as the source has them right now, bypassing every cache. Sources Kyle can change have it. */
  readFresh?(path: string): Promise<{ text: string; sha: string }>;
  /** Replace a file whose current blob sha is `sha`, or add a new file when `sha` is '', as one commit. Returns the new blob sha.
   * Throws an error with `conflict: true` when the file changed since `sha`. */
  write?(path: string, text: string, sha: string, message: string): Promise<string>;
  /** Save a picture given as base64, as write does for text. Returns the new blob sha. */
  writeBytes?(path: string, base64: string, sha: string, message: string): Promise<string>;
  /** A picture's bytes by blob sha. */
  readBytes?(path: string, sha: string): Promise<Blob>;
  /** Remove a file whose current blob sha is `sha`, as one commit. Only after its text is safe somewhere else (Archive). */
  remove?(path: string, sha: string, message: string): Promise<void>;
}

export interface NoteRecord {
  path: string;
  sha: string;
  type: string;
  data: Record<string, unknown>;
  body: string;
  error: string | null;
}

export interface SeriesEntry {
  path: string;
  folder: string;
  name: string;
  /** Paths of the series' character notes. Missing in copies saved before the Characters board. */
  characters?: string[];
  /** Paths of the series' market notes: market cases, comps, keyword sets and title candidates. Missing in copies saved before the Market board. */
  market?: string[];
  /** File names in the series' Market/Rocket Exports folder. Missing in copies saved before the Market board. */
  rocket?: string[];
  /** The series note's genre line and status, for the Series view. */
  genre?: string;
  status?: string;
}

export interface BookEntry {
  path: string;
  folder: string;
  seriesFolder: string;
  seriesName: string;
  title: string;
  number: number | null;
  stage: string;
  /** Paths of the book's scene notes. */
  scenes: string[];
  /** Paths of the book's idea notes. Missing in copies saved before the Ideas board. */
  ideas?: string[];
  /** Paths of the book's beats, conflicts and character deltas. Missing in copies saved before the Story Juice boards. */
  beats?: string[];
  conflicts?: string[];
  characters?: string[];
  /** The book's cover picture (Cover.jpg or Cover.png in the book's folder), if it has one. */
  cover?: FileEntry | null;
}

export interface VaultIndex {
  config: Record<string, unknown>;
  series: SeriesEntry[];
  books: BookEntry[];
  notes: Record<string, NoteRecord>;
  /** Paths of every task note: the vault's Tasks folder and each book's. Missing in copies saved before the to-do list. */
  tasks?: string[];
  /** Plain sentences about notes the app could not read or place. */
  warnings: string[];
}

/** What the cache keeps for one source: enough to draw every screen with no connection. */
export interface Snapshot {
  key: string;
  schemaSha: string;
  schemaText: string;
  index: VaultIndex;
  lastSync: string;
}
