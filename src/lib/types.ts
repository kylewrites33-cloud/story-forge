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
  variants?: Record<string, unknown>;
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
  /** Replace a file whose current blob sha is `sha`, as one commit. Returns the new blob sha.
   * Throws an error with `conflict: true` when the file changed since `sha`. */
  write?(path: string, text: string, sha: string, message: string): Promise<string>;
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
}

export interface VaultIndex {
  config: Record<string, unknown>;
  series: SeriesEntry[];
  books: BookEntry[];
  notes: Record<string, NoteRecord>;
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
