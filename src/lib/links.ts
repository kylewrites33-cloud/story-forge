// Wiki-link helpers, ported from U.linkName and U.nameList in author-business System/Tools/sf.js.

/** "[[Mara Quill|Mara]]" -> "Mara Quill"; "[[Folder/Mara]]" -> "Mara"; "Mara" -> "Mara". */
export function linkName(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.length === 1 ? linkName(v[0]) : v.map(linkName).join(', ');
  if (typeof v === 'object') return '';
  let s = String(v).trim();
  const m = s.match(/^!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/);
  if (m) {
    s = m[1];
    const slash = s.lastIndexOf('/');
    if (slash >= 0) s = s.slice(slash + 1);
  }
  return s.replace(/\.md$/i, '').trim();
}

/** A frontmatter value as a list of plain names. */
export function nameList(v: unknown): string[] {
  if (v == null || v === '') return [];
  let list: unknown[];
  if (Array.isArray(v)) list = v;
  else if (typeof v === 'string' && v.indexOf('[[') === -1 && v.indexOf(',') >= 0) return v.split(',').map((x) => x.trim()).filter(Boolean);
  else list = [v];
  const out: string[] = [];
  list.forEach((item) => {
    if (Array.isArray(item) && item.length === 1 && Array.isArray(item[0])) item = item[0];
    const n = linkName(item);
    if (n) out.push(n);
  });
  return out;
}

/** The number at the end of an ID: "S-012" -> 12. */
export function idNumber(id: unknown): number {
  const m = String(id ?? '').match(/(\d+)(?!.*\d)/);
  return m ? parseInt(m[1], 10) : NaN;
}

export function basename(p: string): string {
  const i = p.lastIndexOf('/');
  return (i >= 0 ? p.slice(i + 1) : p).replace(/\.md$/i, '');
}

export function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(0, i) : '';
}

/** A property as a number, the way sf reads it ("3" and 3 both count); null when there is none. */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[^0-9.+\-eE]/g, ''));
  return isFinite(n) ? n : null;
}
