import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyChange, findWords, finalText, flushChoices, loadChoices, parseChanges, placeChanges, revertChange, saveChoices, segments, setStatus, withChoices
} from '../src/lib/changes.ts';

const BODY = `Touched about a fifth of the chapter. Carries out call I-014.

## C-01 · small
Scene: S-003
Why: Typo.
Kyle: open

Was:
> He walkd in.

Now:
> He walked in.

## C-02 · new
Scene: S-003
Why: Story call I-014, fix B.
Kyle: open

Was:
> The cart tipped.

Now:
> The cart tipped.
>
> Meg laughed first.

Or:
> The cart tipped. Nobody laughed.

## C-03 · line
Scene: S-003
Why: Sense.
Kyle: no

Was:
> a good time

Now:
> good timing
`;

const TEXT = 'He walkd in.\n\nIt was a good time. The cart tipped.\n\nThe end.';

test('a changes note reads back as the report and its changes', () => {
  const { intro, changes } = parseChanges(BODY);
  assert.equal(intro, 'Touched about a fifth of the chapter. Carries out call I-014.');
  assert.equal(changes.length, 3);
  assert.deepEqual(changes[0], { id: 'C-01', kind: 'small', scene: 'S-003', why: 'Typo.', status: 'open', was: 'He walkd in.', now: 'He walked in.', other: null });
  assert.equal(changes[1].now, 'The cart tipped.\n\nMeg laughed first.');
  assert.equal(changes[1].other, 'The cart tipped. Nobody laughed.');
  assert.equal(changes[2].status, 'no');
});

test('setting a status changes only that line', () => {
  const next = setStatus(BODY, 'C-02', 'kept');
  assert.equal(next.split('\n').filter((l, i) => l !== BODY.split('\n')[i]).join('|'), 'Kyle: kept');
  assert.equal(parseChanges(next).changes[1].status, 'kept');
  assert.equal(parseChanges(next).changes[0].status, 'open');
  const bare = '## C-01 · small\nScene: S-001\nWhy: x\n\nWas:\n> a\n\nNow:\n> b\n';
  assert.equal(parseChanges(setStatus(bare, 'C-01', 'other')).changes[0].status, 'other');
});

test('changes are placed on the page in reading order, and lost when their words are gone', () => {
  const { changes } = parseChanges(BODY);
  const { placed, lost } = placeChanges(TEXT, changes, 'S-003');
  assert.deepEqual(placed.map((p) => p.change.id), ['C-01', 'C-02']);
  assert.equal(lost.length, 0);
  const segs = segments(TEXT, placed);
  assert.deepEqual(segs.map((s) => s.kind), ['change', 'same', 'change', 'same']);
  assert.equal(finalText(TEXT, placed), 'He walked in.\n\nIt was a good time. The cart tipped.\n\nMeg laughed first.\n\nThe end.');
  assert.deepEqual(placeChanges('Nothing here.', changes, 'S-003').lost.map((c) => c.id), ['C-01', 'C-02']);
  assert.equal(placeChanges(TEXT, changes, 'S-009').placed.length, 0);
});

test('words are found across a different run of spaces', () => {
  assert.deepEqual(findWords('one  two\nthree', 'one two three'), { at: 0, end: 14 });
  assert.equal(findWords('abc', 'x (y)'), null);
});

test('keeping a change and taking it back again', () => {
  const c = parseChanges(BODY).changes[1];
  const kept = applyChange(TEXT, c)!;
  assert.match(kept.text, /Meg laughed first/);
  assert.equal(revertChange(kept.text, c), TEXT);
  const other = applyChange(TEXT, c, 'other')!;
  assert.match(other.text, /Nobody laughed/);
  assert.equal(revertChange(other.text, c, 'other'), TEXT);
});

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

test('a choice waits on the device, then saves the one line', async () => {
  const s = memStore();
  const files = new Map([['B/Changes/Chapter 3 changes.md', '---\ntype: chapter-changes\n---\n' + BODY]]);
  let online = false;
  const messages: string[] = [];
  const source = {
    key: 'k', label: 'k',
    tree: async () => ({ files: [], truncated: false }),
    read: async () => '',
    readFresh: async (p: string) => { if (!online) throw new Error('offline'); return { text: files.get(p)!, sha: 'x' }; },
    write: async (p: string, t: string, _sha: string, msg: string) => { files.set(p, t); messages.push(msg); return 'y'; }
  };
  await assert.rejects(saveChoices(source, 'B/Changes/Chapter 3 changes.md', { 'C-01': 'kept' }, s));
  assert.deepEqual(loadChoices('k', s), { 'B/Changes/Chapter 3 changes.md': { 'C-01': 'kept' } });
  assert.equal(withChoices(parseChanges(BODY).changes, 'B/Changes/Chapter 3 changes.md', 'k', s)[0].status, 'kept');
  online = true;
  assert.equal(await flushChoices(source, s), 1);
  assert.deepEqual(loadChoices('k', s), {});
  assert.match(files.get('B/Changes/Chapter 3 changes.md')!, /## C-01 · small\nScene: S-003\nWhy: Typo.\nKyle: kept/);
  assert.match(messages[0], /^changes: Kyle kept C-01 in Chapter 3 changes/);
});

test('a story call offers its fixes as buttons', async () => {
  const { fixesOf, isStoryCall } = await import('../src/lib/changes.ts');
  assert.deepEqual(fixesOf('Grey says yes too soon.\n\nFix A: He refuses in chapter 4.\n- **Fix B:** He agrees, then backs out in chapter 6.\nNot a fix line.'),
    [{ letter: 'A', text: 'He refuses in chapter 4.' }, { letter: 'B', text: 'He agrees, then backs out in chapter 6.' }]);
  assert.equal(isStoryCall({ path: 'x', sha: '', type: 'idea', data: { step: '36' }, body: '', error: null }), true);
  assert.equal(isStoryCall({ path: 'x', sha: '', type: 'idea', data: { step: 18 }, body: '', error: null }), false);
});

test('a story call reads A: with its short version in bold', async () => {
  const { callBody } = await import('../src/lib/changes.ts');
  const out = callBody('Which name?\nFix A: DumbButt69. Ch 35 changes.\nFix B: Fix A, but keep the flub.\nRecommended: Fix A.');
  assert.match(out, /\*\*A:\*\* \*\*DumbButt69\.\*\* Ch 35 changes\./);
  assert.match(out, /\*\*B:\*\* \*\*A, but keep the flub\.\*\*/);
  assert.match(out, /Recommended: A\./);
  assert.doesNotMatch(out, /Fix/);
});

test('a change marks only the words that differ, and says what it is', async () => {
  const { wordDiff, shortLabel } = await import('../src/lib/changes.ts');
  assert.deepEqual(wordDiff('crackle. Grey Merrifield tugged', 'crackle. Basil Merrifield tugged'),
    [{ kind: 'same', text: 'crackle. ' }, { kind: 'del', text: 'Grey' }, { kind: 'ins', text: 'Basil' }, { kind: 'same', text: ' Merrifield tugged' }]);
  assert.deepEqual(wordDiff('a big red dog', 'a small blue dog'), [{ kind: 'same', text: 'a ' }, { kind: 'del', text: 'big red' }, { kind: 'ins', text: 'small blue' }, { kind: 'same', text: ' dog' }]);
  const c = (why: string, was = 'x', now = 'y') => ({ id: 'C-01', kind: 'small' as const, scene: 'S-001', why, status: 'open' as const, was, now, other: null });
  assert.equal(shortLabel(c('Name: you renamed Grey to Basil (2026-10-27).')), 'Name: Grey → Basil');
  assert.equal(shortLabel(c('Name: you renamed Cyrus to Rye, Grey to Basil (2026-10-27).')), 'Names: Cyrus → Rye, Grey → Basil');
  assert.equal(shortLabel(c('Proofread (both readers): Typo: "teh" should be "the".', 'teh cat', 'the cat')), 'Typo: teh → the');
  assert.equal(shortLabel(c('Proofread (one reader of two, so check it): Punctuation: a comma.', 'a, b', 'a b')), 'Punctuation: cut , (check)');
  assert.equal(shortLabel(c('Story call I-089: where did Peppermint grow up?')), 'Story call I-089');
});

test('accept everywhere: a change made of word swaps, and the rule that takes it', async () => {
  const { swapsOf, ruleFits, addRules, loadRules } = await import('../src/lib/changes.ts');
  const c = (was: string, now: string) => ({ id: 'C-01', kind: 'small' as const, scene: 'S-001', why: '', status: 'open' as const, was, now, other: null });
  assert.deepEqual(swapsOf(c('tavern," Grey said. He', 'tavern," Basil said. He')), [['Grey', 'Basil']]);
  assert.deepEqual(swapsOf(c('Grey told Cyrus', 'Basil told Rye')), [['Grey', 'Basil'], ['Cyrus', 'Rye']]);
  assert.equal(swapsOf(c('She ran.', 'She ran. Then she stopped.')), null);
  const mem: Record<string, string> = {};
  const s = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } };
  addRules('v', [['Grey', 'Basil']], s);
  const rules = loadRules('v', s);
  assert.equal(ruleFits(c('Grey said', 'Basil said'), rules), true);
  assert.equal(ruleFits(c('Grey told Cyrus', 'Basil told Rye'), rules), false);
  assert.equal(ruleFits({ ...c('Grey said', 'Basil said'), status: 'kept' }, rules), false);
});
