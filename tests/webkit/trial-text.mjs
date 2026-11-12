// A long made-up chapter for the trial checks (about 4,000 words), with every kind of styling the page shows.
export const SCENE = 'Series/Ember Road/Books/1 Ash Bell/Scenes/S-005 The Ledger.md';
const P = [
  'Mara set the ledger on the *toll desk* and turned to the year the bell was last recast. The page was gone, cut with a razor.',
  '"Somebody wanted this **forgotten**," Tobin said. He did not look up from the ==ferry tolls== he was copying.',
  'She ran a thumb down the stub. ***Clean.*** Whoever did it had taken their time, and had known which page to take.',
  'Outside the ford ice ticked against the pilings {what sound does thaw ice make here?} and the lamps along the quay went out one at a time.'
];
const SCREEN = ['The ledger answered:', '', '> **Ledger of Cinder Ford**', '> Year of recasting: [missing]', '> *One page removed.*'];
export function chapter() {
  const out = [];
  for (let i = 0; i < 44; i++) { out.push(P[i % 4].replace('Mara', i % 8 === 0 ? 'Mara' : 'She')); out.push(''); out.push('Paragraph ' + (i + 1) + ' goes on a while longer so the page has some length to it, with ' + (i + 3) + ' pens, a brass rule and the smell of lamp oil, and nobody in the toll house saying what they were thinking. '.repeat(2).trim()); out.push(''); if (i === 1 || i === 30) { out.push(...SCREEN, ''); } }
  return out.join('\n').trim() + '\n';
}
export const patch = (files) => { const t = files.get(SCENE); files.set(SCENE, t.slice(0, t.indexOf('\n---\n', 4) + 5) + '\n' + chapter()); };
