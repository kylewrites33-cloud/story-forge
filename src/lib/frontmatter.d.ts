export interface ParsedNote {
  data: Record<string, unknown>;
  body: string;
  error: string | null;
  hasFm: boolean;
  yaml: string | null;
}

export declare const Frontmatter: {
  parseYaml(text: string): unknown;
  safeParse(text: string): { data: Record<string, unknown>; error: string | null };
  stringify(obj: unknown): string;
  needsQuote(s: string): boolean;
  emitScalar(v: unknown): string;
  split(text: string): { yaml: string | null; body: string; hasFm: boolean; open: string; close: string };
  parse(text: string): ParsedNote;
  join(data: Record<string, unknown>, body: string): string;
  update(text: string, fn: (data: Record<string, unknown>) => unknown): string;
  setScalar(text: string, key: string, value: unknown): string;
};
