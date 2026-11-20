// How a change card's words read: the Edit room's cards (src/ui/Changes.tsx) and Sparrow Pocket (src/pocket/) draw a
// card's Was, versions and Kyle's page with these. Moved out of Changes.tsx on 2026-11-20 so both share one reading.
import { wordDiff } from './changes.ts';
import { styledHtml } from './styled.ts';

// The page as a Kindle shows it (Kyle, 2026-10-28: "when we're in editing mode, the document automatically converts to
// the form that it's going to show up as in Kindle"): paragraphs indented with no blank lines between them, System
// screens (format C1) indented with their "> " marks hidden, a lone ">" a small gap, the bold title in small caps.
const QUOTE = /^\s*> ?/;
const TITLE = /^\*\*[^*].*\*\*$/;
export function bookHtml(text: string): string {
  return text.split('\n').map((line) => {
    if (!line.trim()) return '';
    if (!QUOTE.test(line)) return '<div class="bk-p">' + styledHtml(line, {}) + '</div>';
    const rest = line.replace(QUOTE, '');
    if (!rest.trim()) return '<div class="bk-gap"></div>';
    return '<div class="bk-q' + (TITLE.test(rest.trim()) ? ' bk-qt' : '') + '">' + styledHtml(rest, {}) + '</div>';
  }).join('');
}

// Kyle's own words in the team's version show a little greyer than the team's new words, so he can tell them apart
// (Kyle, 2026-10-30: "anything that's my original text to be slightly grayer than your proposed text"). The new words
// are marked with two private characters before the page look is worked out, then turned into spans.
const NEW_ON = '', NEW_OFF = '';
function markNew(was: string, now: string): string {
  return wordDiff(was, now).filter((d) => d.kind !== 'del')
    .map((d) => d.kind === 'ins' ? d.text.split('\n').map((t) => t ? NEW_ON + t + NEW_OFF : t).join('\n') : d.text).join('')
    // A mark must not sit in front of a System screen's "> ", or the line would lose its look.
    .split('\n').map((line) => line.replace(/^([]+)(\s*> ?)/, '$2$1')).join('\n');
}

/** A card's words as HTML; with `was` (Kyle's words), the team's new words are wrapped in `<span class="chg-new">`. */
export function quoteHtml(text: string, was?: string): string {
  return was == null ? bookHtml(text) : bookHtml(markNew(was, text)).replace(//g, '<span class="chg-new">').replace(//g, '</span>');
}
