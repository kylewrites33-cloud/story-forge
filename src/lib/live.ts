// The open page stays live (Kyle, 2026-10-18: "push it to the doc (assuming i dont need to refresh the page each
// time)"). When a scene changes somewhere else while Kyle has it open (a Claude session put a paragraph in, another
// device saved), its lines are merged into his page: lines only the other side changed come in, lines only he changed
// stay his, and where both changed the same line his wins and the other version is kept as a copy. Lines that came in
// get a dot in the app (never in the file) until he clicks into them.

/** Pairs of equal lines (i in a, j in b), in order: a longest common subsequence. */
function matches(a: string[], b: string[]): [number, number][] {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const out: [number, number][] = [];
  for (let k = 0; k < pre; k++) out.push([k, k]);
  const A = a.slice(pre, a.length - suf), B = b.slice(pre, b.length - suf);
  const n = A.length, m = B.length;
  if (n && m && n * m <= 4_000_000) {
    // Lengths of the common subsequence of A[i..] and B[j..], one row at a time.
    const L: Uint32Array[] = [];
    for (let i = 0; i <= n; i++) L.push(new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push([pre + i, pre + j]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) i++;
      else j++;
    }
  }
  for (let k = suf; k > 0; k--) out.push([a.length - k, b.length - k]);
  return out;
}

/** The places where b differs from a: a's lines [a0, a1) became b's lines [b0, b1). */
export interface Hunk { a0: number; a1: number; b0: number; b1: number }

export function hunks(a: string[], b: string[]): Hunk[] {
  const out: Hunk[] = [];
  let pa = 0, pb = 0;
  matches(a, b).concat([[a.length, b.length]]).forEach(([i, j]) => {
    if (i > pa || j > pb) out.push({ a0: pa, a1: i, b0: pb, b1: j });
    pa = i + 1;
    pb = j + 1;
  });
  return out;
}

export interface Merged {
  text: string;
  /** Lines that came in from the other version, for the dots. */
  added: string[];
  /** Something the other version changed could not come in (Kyle changed the same lines): keep it as a copy. */
  clash: boolean;
}

/** Merge the other version into Kyle's, line by line, from the text both started from. */
export function merge3(base: string, mine: string, theirs: string): Merged {
  if (theirs === base || theirs === mine) return { text: mine, added: [], clash: false };
  if (mine === base) {
    const B = base.split('\n'), T = theirs.split('\n');
    const added: string[] = [];
    hunks(B, T).forEach((h) => { for (let j = h.b0; j < h.b1; j++) if (T[j].trim()) added.push(T[j]); });
    return { text: theirs, added, clash: false };
  }
  const B = base.split('\n'), M = mine.split('\n'), T = theirs.split('\n');
  // Where each of the base's lines is in Kyle's version (-1: he changed or removed it).
  const inMine = new Array<number>(B.length).fill(-1);
  // Kyle's own lines: the ones that are not the base's.
  const his = new Array<boolean>(M.length).fill(true);
  matches(B, M).forEach(([i, j]) => { inMine[i] = j; his[j] = false; });
  // Whether Kyle's own lines, between the written base lines around a hunk, already hold its new lines in order. Then
  // both sides made the same change (2026-10-21: one save went in twice, so "Peppermint was right." came back every 30
  // seconds) and it must not come in a second time.
  const already = (h: Hunk, lines: string[]): boolean => {
    const want = lines.filter((l) => l.trim());
    let lo = 0, hi = M.length;
    for (let k = h.a0 - 1; k >= 0; k--) if (B[k].trim() && inMine[k] >= 0) { lo = inMine[k] + 1; break; }
    for (let k = h.a1; k < B.length; k++) if (B[k].trim() && inMine[k] >= 0) { hi = inMine[k]; break; }
    // Only empty lines added where Kyle is writing too: his spacing stands.
    if (!want.length) return h.a0 === h.a1 && his.slice(lo, hi).some(Boolean);
    let w = 0;
    for (let j = lo; j < hi && w < want.length; j++) if (his[j] && M[j] === want[w]) w++;
    return w === want.length;
  };
  const ops: { at: number; del: number; lines: string[]; order: number }[] = [];
  const added: string[] = [];
  let clash = false;
  hunks(B, T).forEach((h, order) => {
    const lines = T.slice(h.b0, h.b1);
    if (already(h, lines)) return;
    if (h.a0 === h.a1) {
      // Only new lines: after the base line before them, or before the base line after them, or at the end.
      let at = -1;
      if (h.a0 > 0 && inMine[h.a0 - 1] >= 0) at = inMine[h.a0 - 1] + 1;
      else if (h.a0 === 0) at = 0;
      else if (h.a0 < B.length && inMine[h.a0] >= 0) at = inMine[h.a0];
      if (at < 0) at = M.length;
      ops.push({ at, del: 0, lines, order });
    } else {
      // Changed or removed lines: only if Kyle left all of them as they were, side by side.
      const first = inMine[h.a0];
      let ok = first >= 0;
      for (let k = h.a0; ok && k < h.a1; k++) ok = inMine[k] === first + (k - h.a0);
      if (!ok) { clash = true; return; }
      ops.push({ at: first, del: h.a1 - h.a0, lines, order });
    }
    lines.forEach((l) => { if (l.trim()) added.push(l); });
  });
  // From the end backwards, so earlier places stay where they were; at one place, later hunks first.
  ops.sort((x, y) => y.at - x.at || y.order - x.order);
  const out = M.slice();
  ops.forEach((o) => { out.splice(o.at, o.del, ...o.lines); });
  return { text: out.join('\n'), added, clash };
}

/** How a cursor position in `before` moves when the text becomes `after` (one changed stretch in the middle). */
export function mapFor(before: string, after: string): (n: number) => number {
  let pre = 0;
  while (pre < before.length && pre < after.length && before[pre] === after[pre]) pre++;
  let suf = 0;
  while (suf < before.length - pre && suf < after.length - pre && before[before.length - 1 - suf] === after[after.length - 1 - suf]) suf++;
  const d = after.length - before.length;
  return (n) => (n <= pre ? n : n >= before.length - suf ? n + d : Math.min(n, after.length - suf));
}

// ---- The dots: lines the team or another place added, until Kyle clicks into them (this device only) ----

const DOTS = 'story-forge.added.';
const MAX_DOTS = 200;

export function loadDots(sourceKey: string, path: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(DOTS + sourceKey) || '{}');
    return Array.isArray(all[path]) ? all[path].filter((x: unknown) => typeof x === 'string') : [];
  } catch { return []; }
}

export function saveDots(sourceKey: string, path: string, lines: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(DOTS + sourceKey) || '{}');
    if (lines.length) all[path] = lines.slice(-MAX_DOTS); else delete all[path];
    localStorage.setItem(DOTS + sourceKey, JSON.stringify(all));
  } catch { /* the dots last until the page reloads */ }
}

/** The line the cursor is in. */
export function lineAt(text: string, at: number): string {
  const s = text.lastIndexOf('\n', at - 1) + 1;
  let e = text.indexOf('\n', at);
  if (e < 0) e = text.length;
  return text.slice(s, e);
}
