// "Now" and secrets on a codex card (the note view and the writing screen's codex card): where the character, place,
// item or lore stands at the open scene from its latest progression, and its > [!secret] callouts with whether the team
// may see each one yet.
import type { CodexNow } from '../lib/codexnow.ts';

const STATE: Record<string, string> = { known: 'the team may see it', here: 'this scene reveals it', held: 'hidden from the team' };

export function CodexNowBox({ now }: { now: CodexNow }) {
  const shown = now.secrets.filter((s) => s.state !== 'held').length;
  const where = now.scene ? (now.open ? 'at this scene (' + now.scene + ')' : 'where the writing is (' + now.scene + ')') : '';
  if (!now.latest && !now.secrets.length && !now.never) return null;
  return (
    <div class="codex-now">
      {now.latest
        ? (
          <p><span class="panel-key">Now{where ? ', ' + where : ''}</span>
            {now.latest.change}
            <span class="meta"> · {now.latest.book.number != null ? 'Book ' + now.latest.book.number + ', ' : ''}{now.latest.at}{now.latest.kind ? ' · ' + now.latest.kind : ''}{now.earlier ? ' · ' + now.earlier + (now.earlier === 1 ? ' change' : ' changes') + ' before it' : ''}</span>
          </p>
        )
        : now.scene ? <p><span class="panel-key">Now, {where}</span><span class="meta">No change recorded up to here.</span></p> : null}
      {now.secrets.length > 0 && (
        <div>
          <p><span class="panel-key">Secrets</span>
            {now.secrets.length === 1 ? '1 secret' : now.secrets.length + ' secrets'}{where ? '; ' + (now.never ? 'none' : shown === 0 ? 'none' : shown === now.secrets.length ? 'all' : shown + ' of ' + now.secrets.length) + ' open to the team ' + where : ''}.
          </p>
          <ul class="codex-secrets">
            {now.secrets.map((s, i) => (
              <li key={i} class={'secret-' + s.state}>
                {s.title && /S-\d{3}/i.test(s.title) ? 'Revealed by ' + s.title : 'Untimed: revealed when a scene\'s reveal list names this note'}
                {where ? <span class="meta"> · {now.never ? 'hidden from the team (AI: never)' : STATE[s.state]}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {now.never && <p class="meta">AI is set to never: the team never sees this note.</p>}
    </div>
  );
}
