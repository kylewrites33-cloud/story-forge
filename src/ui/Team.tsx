// The AI team, its skills and what it has done: the Team page (a table like the first Story Forge's, with Recently
// used, A to Z and By team), one page per agent, the Skills page (every skill and who can use it) and History.
// Everything comes from the vault's .claude folder, the job notes and the vault's recent saves.
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { render } from '../lib/markdown.ts';
import {
  avatarColour, buildTeam, history, initials, keptLabel, lastUsedLabel, memberStats, sortMembers, teamColour, TEAMS,
  type HistoryEntry, type MemberStats, type Team, type TeamSort
} from '../lib/team.ts';
import type { SaveEntry, Schema, VaultIndex, VaultSource } from '../lib/types.ts';
import { Icon } from './Icon.tsx';
import { when } from './Jobs.tsx';
import { href } from './route.ts';

const PREFILL = 'sf-chat-prefill';

/** Words to start a new conversation with, set by Talk and taken once by the Chat screen. */
export function takeChatPrefill(): string {
  try {
    const v = sessionStorage.getItem(PREFILL) || '';
    sessionStorage.removeItem(PREFILL);
    return v;
  } catch { return ''; }
}

function talkTo(name: string) {
  try { sessionStorage.setItem(PREFILL, name + ', '); } catch { /* the conversation starts empty */ }
}

export function useTeam(index: VaultIndex | null): Team {
  return useMemo(() => buildTeam(index ? index.team : undefined), [index && index.team]);
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span class="avatar" aria-hidden="true" style={{ background: avatarColour(name), width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.38) + 'px' }}>
      {initials(name)}
    </span>
  );
}

function TalkButton({ name, canTalk }: { name: string; canTalk: boolean }) {
  if (!canTalk) return null;
  return <a class="button talk" href={href.chat('new')} onClick={() => talkTo(name)}><Icon name="chat" size={18} /> Talk</a>;
}

function NoTeam() {
  return (
    <div class="empty-box">
      <h2>No team in this vault yet</h2>
      <p>The team lives in the vault's .claude folder: one file per agent in .claude/agents, one folder per skill in .claude/skills. Press Sync after adding them.</p>
    </div>
  );
}

const SORTS: { key: TeamSort; label: string }[] = [
  { key: 'recent', label: 'Recently used' },
  { key: 'az', label: 'A–Z' },
  { key: 'team', label: 'By team' }
];

function loadSort(): TeamSort {
  try { const v = localStorage.getItem('sf-team-sort'); return v === 'az' || v === 'team' ? v : 'recent'; } catch { return 'recent'; }
}

/** The whole team as a table: agent, specialty, last used, ideas, kept, lessons and Talk. */
export function TeamScreen({ index, schema, canTalk }: { index: VaultIndex; schema: Schema | null; canTalk: boolean }) {
  const team = useTeam(index);
  const [sort, setSort] = useState<TeamSort>(loadSort);
  const stats = useMemo(() => {
    const out: Record<string, MemberStats> = {};
    team.members.forEach((m) => { out[m.slug] = memberStats(m, index, schema); });
    return out;
  }, [team, index, schema]);
  const pick = (s: TeamSort) => { setSort(s); try { localStorage.setItem('sf-team-sort', s); } catch { /* per visit only */ } };
  const rows = sortMembers(team.members, stats, sort);
  return (
    <section class="team-screen">
      <h1>The team</h1>
      <p class="meta">
        {team.members.length} agents, {team.skills.length} skills. Ideas counts the proposals each agent wrote; Kept is the share of
        those you kept, of the ones you decided. <a href={href.skills()}>See every skill</a> · <a href={href.history()}>What the team has done</a>
      </p>
      {!team.members.length ? <NoTeam /> : (
        <>
          <div class="tabs" role="tablist" aria-label="Order">
            {SORTS.map((s) => <button key={s.key} type="button" role="tab" aria-selected={sort === s.key} onClick={() => pick(s.key)}>{s.label}</button>)}
          </div>
          <div class="team-table" role="table" aria-label="The team">
            <div class="team-row team-head" role="row">
              <span role="columnheader">Agent</span><span role="columnheader">Specialty</span><span role="columnheader">Last used</span>
              <span role="columnheader" class="num">Ideas</span><span role="columnheader" class="num">Kept</span><span role="columnheader" class="num">Lessons</span>
              <span role="columnheader"><span class="sr-only">Talk</span></span>
            </div>
            {rows.map((m, i) => {
              const st = stats[m.slug];
              const heading = sort === 'team' && (i === 0 || rows[i - 1].team !== m.team);
              return (
                <Fragment key={m.slug}>
                  {heading && <div class="team-group" role="row" key={'g' + m.team}><span role="cell">{m.team}</span></div>}
                  <div class="team-row" role="row" style={{ borderLeftColor: teamColour(m.team) }}>
                    <a class="team-agent" role="cell" href={href.team(m.slug)}>
                      <Avatar name={m.name} />
                      <span class="team-agent-text"><span class="team-name">{m.name}</span><span class="meta">{m.team}{m.model && m.model !== 'inherit' ? ' · ' + m.model : ''}</span></span>
                    </a>
                    <span role="cell" class="team-specialty">{m.specialty}</span>
                    <span role="cell" class="team-last">{lastUsedLabel(st.lastUsed)}</span>
                    <span role="cell" class="num">{st.ideas}</span>
                    <span role="cell" class="num">{keptLabel(st)}</span>
                    <span role="cell" class="num">{m.lessons.length}</span>
                    <span role="cell" class="team-talk-cell"><TalkButton name={m.name} canTalk={canTalk} /></span>
                    <span class="team-stats-line" aria-hidden="true">Last used {lastUsedLabel(st.lastUsed)} · {st.ideas === 1 ? '1 idea' : st.ideas + ' ideas'} · kept {keptLabel(st)} · {m.lessons.length === 1 ? '1 lesson' : m.lessons.length + ' lessons'}</span>
                  </div>
                </Fragment>
              );
            })}
          </div>
          <p class="hint">Teams: {TEAMS.filter(([t]) => team.members.some((m) => m.team === t)).map(([t]) => t).join(', ')}. Talk starts a new conversation addressed to that agent.</p>
        </>
      )}
    </section>
  );
}

function HistoryList({ entries, showWho, limit }: { entries: HistoryEntry[]; showWho: boolean; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = limit && !all ? entries.slice(0, limit) : entries;
  if (!entries.length) return <p class="empty">Nothing recorded yet.</p>;
  let lastDay = '';
  return (
    <>
      <ol class="history">
        {shown.map((e, i) => {
          const day = e.date.slice(0, 10);
          const head = day !== lastDay;
          lastDay = day;
          return (
            <li key={i + e.date + e.title} class={'history-item history-' + e.kind}>
              {head && <p class="history-day">{when(day)}</p>}
              <div class="history-row">
                {showWho && <a href={href.history(e.who)} title={'Only ' + e.who}><Avatar name={e.who} size={32} /></a>}
                <div class="history-text">
                  <p class="history-title">
                    {showWho && <strong>{e.who} </strong>}
                    <span class="pill pill-plain">{e.kind === 'journal' ? 'Journal' : e.kind === 'job' ? 'Job' : 'Saved'}</span>{' '}
                    {e.path ? <a href={href.note(e.path)}>{e.title}</a> : e.title}
                    {e.date.length > 10 && <span class="meta"> · {when(e.date.slice(0, 16))}</span>}
                  </p>
                  {e.text && (
                    <details class="history-more">
                      <summary>More</summary>
                      <div class="prose" dangerouslySetInnerHTML={{ __html: render(e.text) }} />
                    </details>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {limit && entries.length > limit && !all && <button type="button" onClick={() => setAll(true)}>Show all {entries.length}</button>}
    </>
  );
}

/** The vault's recent saves, fetched once per visit to a history screen while online. */
function useSaves(source: VaultSource): { saves: SaveEntry[]; note: string } {
  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!source.recent) return;
    let live = true;
    source.recent().then((s) => { if (live) setSaves(s); }).catch(() => { if (live) setNote('The vault\'s recent saves could not be loaded, so only journals and jobs show. Press Sync when online and open this page again.'); });
    return () => { live = false; };
  }, [source]);
  return { saves, note };
}

/** One agent: what it does, its skills, its lessons and what it has done. */
export function MemberPage({ source, index, schema, slug, canTalk }: { source: VaultSource; index: VaultIndex; schema: Schema | null; slug: string; canTalk: boolean }) {
  const team = useTeam(index);
  const { saves, note } = useSaves(source);
  const m = team.members.find((x) => x.slug === slug);
  if (!m) return <p class="empty">That agent is not in the vault. <a href={href.team()}>See the whole team</a>.</p>;
  const st = memberStats(m, index, schema);
  const done = history(team, index, saves).filter((e) => e.who.toLowerCase() === m.name.toLowerCase());
  const usedBy = team.skills.filter((s) => m.skills.indexOf(s.name) >= 0);
  const calledIn = team.skills.filter((s) => m.skills.indexOf(s.name) < 0 && s.bringsIn.toLowerCase().indexOf(m.name.toLowerCase()) >= 0);
  return (
    <section class="member-page">
      <p class="crumb"><a href={href.team()}>The team</a></p>
      <div class="member-head" style={{ borderLeftColor: teamColour(m.team) }}>
        <Avatar name={m.name} size={64} />
        <div>
          <h1>{m.name}</h1>
          <p class="meta">{m.team}{m.model && m.model !== 'inherit' ? ' · model: ' + m.model : ''} · last used {lastUsedLabel(st.lastUsed)}</p>
        </div>
        <TalkButton name={m.name} canTalk={canTalk} />
      </div>
      <p>{m.description}</p>
      <dl class="member-stats">
        <div><dt>Ideas</dt><dd>{st.ideas}</dd></div>
        <div><dt>Kept</dt><dd>{keptLabel(st)}</dd></div>
        <div><dt>Lessons</dt><dd>{m.lessons.length}</dd></div>
        <div><dt>Journal entries</dt><dd>{m.journal.length}</dd></div>
      </dl>
      <h2>Skills</h2>
      {usedBy.length ? (
        <ul class="chips">{usedBy.map((s) => <li key={s.name}><a class="chip" href={href.skills(s.name)}>{s.label}</a></li>)}</ul>
      ) : <p class="meta">No skills load with this agent; it works from its own file.</p>}
      {calledIn.length > 0 && <>
        <p class="meta">Skills that call on {m.name}:</p>
        <ul class="chips">{calledIn.map((s) => <li key={s.name}><a class="chip chip-soft" href={href.skills(s.name)}>{s.label}</a></li>)}</ul>
      </>}
      <h2>Lessons <span class="meta">{m.lessons.length}</span></h2>
      {m.lessons.length ? (
        <ul class="lessons">{m.lessons.map((l, i) => <li key={i} dangerouslySetInnerHTML={{ __html: render(l).replace(/^<p>|<\/p>\s*$/g, '') }} />)}</ul>
      ) : <p class="meta">No lessons yet. They come from Kyle's corrections, through the weekly reflect.</p>}
      <h2>What {m.name} has done</h2>
      {note && <p class="hint">{note}</p>}
      <HistoryList entries={done} showWho={false} limit={20} />
    </section>
  );
}

/** Every skill, with what it is for and which agents can use it. */
export function SkillsScreen({ index, skill }: { index: VaultIndex; skill: string }) {
  const team = useTeam(index);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!skill) return;
    const el = document.getElementById('skill-' + skill);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [skill, team.skills.length]);
  const slugOf = (name: string) => (team.members.find((m) => m.name === name) || { slug: '' }).slug;
  const words = q.trim().toLowerCase();
  const shown = team.skills.filter((s) => !words || (s.label + ' ' + s.description + ' ' + s.agents.join(' ') + ' ' + s.bringsIn).toLowerCase().indexOf(words) >= 0);
  return (
    <section class="skills-screen">
      <h1>Skills</h1>
      <p class="meta">
        {team.skills.length} skills saved in the vault. "Loaded by" are the agents that start with the skill every time; "Brings in"
        is the skill's own list of who it calls on. The main conversation (the coordinator) can run any skill.
      </p>
      {team.skills.length > 0 && (
        <label class="filter-box"><Icon name="search" size={18} />
          <input type="search" placeholder="Find a skill or an agent" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
        </label>
      )}
      {!team.skills.length ? <NoTeam /> : (
        <ul class="skills">
          {shown.map((s) => (
            <li key={s.name} id={'skill-' + s.name} class={'skill' + (s.name === skill ? ' skill-here' : '')}>
              <h2 class="skill-name">{s.label} <span class="meta">{s.name}</span></h2>
              <p>{s.description}</p>
              <div class="skill-who">
                {s.agents.length ? <>
                  <span class="meta">Loaded by</span>
                  <ul class="chips">{s.agents.map((a) => <li key={a}><a class="chip" href={href.team(slugOf(a))}><Avatar name={a} size={22} /> {a}</a></li>)}</ul>
                </> : <span class="meta">Run by the coordinator, the main conversation</span>}
              </div>
              {s.bringsIn && <p class="skill-brings"><span class="meta">Brings in </span>{s.bringsIn.replace(/\*\*/g, '')}</p>}
            </li>
          ))}
          {!shown.length && <p class="empty">No skill matches.</p>}
        </ul>
      )}
      <p class="hint">Skills saved in your Claude account (such as the steps for a new browser key) live in Claude, not the vault, so they do not show here.</p>
    </section>
  );
}

/** What the team has done: journal entries, jobs and saves to the vault, newest first, for everyone or one agent. */
export function HistoryScreen({ source, index, who }: { source: VaultSource; index: VaultIndex; who: string }) {
  const team = useTeam(index);
  const { saves, note } = useSaves(source);
  const all = history(team, index, saves);
  const names = [...new Set(all.map((e) => e.who))].sort((a, b) => a.localeCompare(b));
  const shown = who ? all.filter((e) => e.who.toLowerCase() === who.toLowerCase()) : all;
  return (
    <section class="history-screen">
      <h1>Session history</h1>
      <p class="meta">What each team member has done: their journal entries after each piece of work, the jobs they ran for you, and their saves to the vault.</p>
      {note && <p class="hint">{note}</p>}
      {names.length > 1 && (
        <div class="tabs" role="tablist" aria-label="Who">
          <a role="tab" class="button" aria-selected={!who} href={href.history()}>Everyone</a>
          {names.map((n) => <a key={n} role="tab" class="button" aria-selected={who.toLowerCase() === n.toLowerCase()} href={href.history(n)}>{n}</a>)}
        </div>
      )}
      <HistoryList entries={shown} showWho={!who} limit={60} />
    </section>
  );
}

