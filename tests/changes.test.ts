import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewriteSpan,
  applyChange, findWords, finalText, marksMessage, parseChanges, placeChanges, revertChange, segments, setStatus, setStatuses
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


test('choices on several changes set each one line, and leave the line the vault\'s history shows', () => {
  const text = '---\ntype: chapter-changes\n---\n' + BODY;
  const next = setStatuses(text, { 'C-01': 'kept', 'C-02': 'no' });
  assert.match(next, /## C-01 · small\nScene: S-003\nWhy: Typo.\nKyle: kept/);
  assert.deepEqual(parseChanges(next.slice(next.indexOf(BODY.slice(0, 20)))).changes.map((c) => c.status).slice(0, 2), ['kept', 'no']);
  assert.equal(setStatuses(text, {}), text);
  // The lines the choices do not touch are as they were.
  const a = text.split('\n'), b = next.split('\n');
  assert.equal(a.length, b.length);
  assert.equal(a.filter((l, i) => l !== b[i]).length, 2);
  assert.match(marksMessage('B/Changes/Chapter 3 changes.md', { 'C-01': 'kept' }), /^changes: Kyle kept C-01 in Chapter 3 changes\n\nChosen in the Sparrow app\.$/);
  assert.match(marksMessage('B/Changes/Chapter 3 changes.md', { 'C-01': 'kept', 'C-02': 'no' }), /^changes: Kyle chose on 2 changes in Chapter 3 changes\n/);
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
  assert.equal(shortLabel(c('System screen in format C1 (Style Guide, System screens; Kyle, 2026-10-28).')), 'System screen');
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

test('rewriteSpan finds the words Kyle put in place of a change, by the words around it in Draft 1', () => {
  const old = 'He walked in.\n\n*These should last another 2 months at least.*\n\nThen he slept.';
  const page = 'He walked in.\n\n*Good for two more months before they go.*\n\nThen he slept.';
  const s = rewriteSpan(page, '*These should last another 2 months at least.*', old)!;
  assert.equal(page.slice(s.at, s.end), '*Good for two more months before they go.*');
  assert.equal(rewriteSpan(page, 'not in the old copy', old), null);
});

test('todoTicks: a to-do is done once every change naming it is decided and one went in', async () => {
  const { todoTicks, todoIds } = await import('../src/lib/changes.ts');
  const ch = (id: string, why: string, status: string) => ({ id, kind: 'new', scene: 'S-001', why, status, was: 'a', now: 'b', other: null }) as never;
  assert.deepEqual(todoIds(ch('C-1', 'To-do T-004 / T-006: wolf', 'open')), ['T-004', 'T-006']);
  const list = [ch('C-1', 'To-do T-002: pain', 'mine'), ch('C-2', 'To-do T-002: more pain', 'open'), ch('C-3', 'To-do T-001: circle', 'kept'), ch('C-4', 'To-do T-009', 'no'), ch('C-5', 'Typo', 'kept')];
  assert.deepEqual(todoTicks(list, ['C-1', 'C-3', 'C-4', 'C-5']), [
    { id: 'T-002', done: false, note: '' },
    { id: 'T-001', done: true, note: 'Edit room: C-3 kept.' }
  ]);
  list[1] = ch('C-2', 'To-do T-002: more pain', 'other');
  assert.deepEqual(todoTicks(list, ['C-2']), [{ id: 'T-002', done: true, note: 'Edit room: C-1 your own words, C-2 other version kept.' }]);
});

test('a change can carry what Kyle asked, what it does and the team check, each on its own line', async () => {
  const { todoIds } = await import('../src/lib/changes.ts');
  const body = '## C-01 · new\nScene: S-001\nWhy: To-do T-048\nAsked: the Genius Farmer book by his side\nChange: Puts the booklet beside him.\nCheck: the booklet is old, ch 6 to 8.\nKyle: open\n\nWas:\n> a\n\nNow:\n> b\n';
  const c = parseChanges(body).changes[0];
  assert.equal(c.why, 'To-do T-048');
  assert.equal(c.asked, 'the Genius Farmer book by his side');
  assert.equal(c.does, 'Puts the booklet beside him.');
  assert.equal(c.check, 'the booklet is old, ch 6 to 8.');
  assert.deepEqual(todoIds(c), ['T-048']);
  assert.equal(parseChanges(setStatus(body, 'C-01', 'kept')).changes[0].status, 'kept');
});

// Kyle's reply to the Writer on a card (2026-11-12: "i need to be able to reply within the changes, to explain to the
// writer why i made a choice, and for the writer to create a new card based on my reply").
test('a reply goes on its own line under the card, and the card the Writer makes from it points back', async () => {
  const { addReply, parseChanges, shortLabel, answersTo } = await import('../src/lib/changes.ts');
  const body = '## C-01 · line\nScene: S-001\nWhy: Sense.\nKyle: no\n\nWas:\n> a tin lantern\n\nNow:\n> a brass lantern\n\n## C-02 · small\nScene: S-001\nWhy: Typo.\nKyle: open\n\nWas:\n> teh\n\nNow:\n> the\n';
  const one = addReply(body, 'C-01', '  The lantern is tin\n on purpose:  it is cheap.  ');
  assert.match(one, /^Kyle: no\nReply: The lantern is tin on purpose: it is cheap\.\n\nWas:/m);
  const two = addReply(one, 'c-01', 'And Mara owns nothing brass.');
  assert.match(two, /Reply: The lantern is tin on purpose: it is cheap\.\nReply: And Mara owns nothing brass\.\n\nWas:/);
  assert.equal(addReply(body, 'C-09', 'nothing'), body, 'a card that is not there changes nothing');
  assert.equal(addReply(body, 'C-01', '   '), body);
  const answered = two + '\n## C-03 · line\nScene: S-001\nWhy: Your reply on C-01\nRe: C-01\nAsked: The lantern is tin on purpose: it is cheap.\nChange: Makes the cheapness show.\nKyle: open\n\nWas:\n> a tin lantern\n\nNow:\n> a dented tin lantern\n';
  const { changes } = parseChanges(answered);
  assert.deepEqual(changes[0].replies, ['The lantern is tin on purpose: it is cheap.', 'And Mara owns nothing brass.']);
  assert.equal(changes[0].status, 'no');
  assert.equal(changes[0].was, 'a tin lantern');
  assert.equal(changes[1].replies, undefined);
  assert.equal(changes[2].re, 'C-01');
  assert.equal(changes[2].asked, 'The lantern is tin on purpose: it is cheap.');
  assert.equal(shortLabel(changes[2]), 'Your reply on C-01');
  assert.deepEqual(answersTo(changes, 'C-01').map((c) => c.id), ['C-03']);
  // A card still open that the Writer answered is retired: the new card stands in for it (Kyle, 2026-11-12: "shouldn't
  // the writer scrap the old card"). A card Kyle already decided keeps his choice.
  assert.equal(changes[0].replacedBy, undefined);
  const openOld = answered.replace('Kyle: no\nReply:', 'Kyle: open\nReply:');
  const again = parseChanges(openOld).changes;
  assert.equal(again[0].status, 'replaced');
  assert.equal(again[0].replacedBy, 'C-03');
  assert.equal(again[2].status, 'open');
  const { placeChanges } = await import('../src/lib/changes.ts');
  const on = placeChanges('a tin lantern', again, 'S-001');
  assert.deepEqual(on.placed.map((p) => p.change.id), ['C-03'], 'only the new card is on the page');
});
