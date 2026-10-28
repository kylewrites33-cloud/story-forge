// Crow's screens: the studies, a study's Character and Plot tabs, a character, a scene, the lenses, and Settings (the key).
// Reads Studies/ in the vault with the key saved on this device (shared with Sparrow in the same browser tab, its own
// when Crow runs from its home-screen icon); without one it shows the demo vault's sample study.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Fragment, type ComponentChildren } from 'preact';
import { loadSettings, saveSettings, isConnected, type Settings } from '../lib/settings.ts';
import { GitHubSource } from '../lib/github.ts';
import { DemoSource } from '../lib/demo-source.ts';
import { readPicture, writePicture } from '../lib/cache.ts';
import { coverProblem, shrinkToJpeg } from '../lib/covers.ts';
import { inline } from '../lib/markdown.ts';
import type { FileEntry, VaultSource } from '../lib/types.ts';
import {
  ROOT, ROLES, PARTS, PART_WORDS, beatOwner, sceneField, buildLibrary, driveGrid, faceFor, facePath, handoffs, initials, isForce, lensesFor, players, scenesOf, splitMoment, studyFiles, tally, turnAt, valueShift,
  type Beat, type Engine, type Lens, type Part, type Reading, type Role, type Verdict, type Side, type Study, type StudyCharacter, type StudyLibrary, type StudyScene
} from '../lib/study.ts';

// ------------------------------------------------------------------ loading, with a copy kept on the device

interface Cached { files: FileEntry[]; texts: Record<string, [string, string]>; }
const CACHE = 'character-study.cache.';

function loadCache(key: string): Cached | null {
  try { const v = JSON.parse(localStorage.getItem(CACHE + key) || 'null'); return v && Array.isArray(v.files) ? v : null; } catch { return null; }
}
function saveCache(key: string, c: Cached): void {
  try { localStorage.setItem(CACHE + key, JSON.stringify(c)); } catch { /* the copy is a convenience */ }
}
function libraryFrom(c: Cached): StudyLibrary {
  return buildLibrary(c.files, new Map(Object.entries(c.texts).map(([p, [, t]]) => [p, t])));
}

async function fetchAll(source: VaultSource, prior: Cached | null): Promise<Cached> {
  const { files } = await source.tree();
  const mine = files.filter((f) => f.path.startsWith(ROOT));
  const texts: Record<string, [string, string]> = {};
  const old = prior ? prior.texts : {};
  await Promise.all(studyFiles(mine).map(async (f) => {
    const had = old[f.path];
    texts[f.path] = had && had[0] === f.sha ? had : [f.sha, await source.read(f.path, f.sha)];
  }));
  return { files: mine, texts };
}

const faceUrls = new Map<string, string>();
async function faceUrl(source: VaultSource, f: FileEntry): Promise<string | null> {
  const known = faceUrls.get(f.sha);
  if (known) return known;
  let blob = await readPicture(f.sha);
  if (!blob) {
    if (!source.readBytes) return null;
    try { blob = await source.readBytes(f.path, f.sha); } catch { return null; }
    await writePicture(f.sha, blob);
  }
  const url = URL.createObjectURL(blob);
  faceUrls.set(f.sha, url);
  return url;
}

// ------------------------------------------------------------------ routes: #/, #/lenses, #/s/<study>[/plot[/drivers|/lenses]|/engine|/kishotenketsu],
// #/s/<study>/c/<name>, #/s/<study>/scene/<id>[/beats|/lenses]

/** A study's tabs: Character, Plot, and Engine (Kyle, 2026-10-27: the distilled method, what actually matters). */
type Tab = Side | 'engine';

/** The Plot tab's views (Kyle, 2026-10-26): the story board, who drives the plot, and the plot lenses. */
type PlotViewName = 'board' | 'drivers' | 'lenses';
/** A scene's tabs: our retelling with a link to the original, the beats, and every lens's reading. */
type SceneTab = 'read' | 'beats' | 'lenses';

interface Route { page: 'home' | 'lenses' | 'settings' | 'study' | 'character' | 'scene' | 'kishotenketsu'; study?: string; tab?: Tab; name?: string; view?: PlotViewName; sceneTab?: SceneTab; traits?: boolean; lens?: string; }

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  if (parts[0] === 'lenses') return { page: 'lenses' };
  if (parts[0] === 'settings') return { page: 'settings' };
  if (parts[0] !== 's' || !parts[1]) return { page: 'home' };
  const study = parts[1];
  if (parts[2] === 'c' && parts[3]) return { page: 'character', study, name: parts[3] };
  if (parts[2] === 'scene' && parts[3]) return { page: 'scene', study, name: parts[3], sceneTab: parts[4] === 'beats' ? 'beats' : parts[4] === 'lenses' ? 'lenses' : 'read' };
  if (parts[2] === 'traits') return { page: 'study', study, tab: 'character', traits: true, name: parts[3] || '', lens: parts[4] || '' };
  if (parts[2] === 'engine') return { page: 'study', study, tab: 'engine' };
  if (parts[2] === 'kishotenketsu') return { page: 'kishotenketsu', study };
  const view: PlotViewName = parts[3] === 'drivers' ? 'drivers' : parts[3] === 'lenses' ? 'lenses' : 'board';
  return { page: 'study', study, tab: parts[2] === 'plot' ? 'plot' : 'character', view };
}
const enc = encodeURIComponent;
const studyHref = (s: Study, tab: Tab = 'character') => '#/s/' + enc(s.folder.slice(ROOT.length)) + (tab === 'character' ? '' : '/' + tab);
const kishoHref = (s: Study) => '#/s/' + enc(s.folder.slice(ROOT.length)) + '/kishotenketsu';
const charHref = (s: Study, name: string) => '#/s/' + enc(s.folder.slice(ROOT.length)) + '/c/' + enc(name);
const sceneHref = (s: Study, id: string, tab: SceneTab = 'read') => '#/s/' + enc(s.folder.slice(ROOT.length)) + '/scene/' + enc(id) + (tab === 'read' ? '' : '/' + tab);
const traitsHref = (s: Study, name = '', lens = '') => '#/s/' + enc(s.folder.slice(ROOT.length)) + '/traits' + (name ? '/' + enc(name) + (lens ? '/' + enc(lens) : '') : '');
const plotHref = (s: Study, view: PlotViewName) => studyHref(s, 'plot') + (view === 'board' ? '' : '/' + view);

// The lens picked on each side, remembered on this device. '' is the plain card (character) or the overview (plot).
const LENS_KEY = 'character-study.lens';
function loadLens(): Record<Side, string> {
  try { const v = JSON.parse(localStorage.getItem(LENS_KEY) || '{}'); return { character: String(v.character || ''), plot: String(v.plot || '') }; } catch { return { character: '', plot: '' }; }
}

// ------------------------------------------------------------------ the app

export function StudyApp() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const source: VaultSource = useMemo(() => (isConnected(settings) ? new GitHubSource(settings) : new DemoSource()), [settings]);
  const demo = source.key === 'demo';
  const [cached, setCached] = useState<Cached | null>(() => loadCache(source.key));
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(cached ? 'ready' : 'loading');
  const [error, setError] = useState('');
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [lens, setLensState] = useState<Record<Side, string>>(loadLens);

  const sync = async () => {
    setError('');
    try {
      const fresh = await fetchAll(source, loadCache(source.key));
      saveCache(source.key, fresh);
      setCached(fresh);
      setState('ready');
    } catch (e) {
      setError((e as Error).message || 'The studies could not be read. Try again in a minute.');
      setState((s) => (s === 'loading' ? 'error' : s));
    }
  };
  useEffect(() => { sync(); }, [source]);
  useEffect(() => {
    const on = () => { setRoute(parseRoute(location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const lib = useMemo(() => (cached ? libraryFrom(cached) : null), [cached]);
  const setLens = (side: Side, name: string) => {
    const next = { ...lens, [side]: name };
    setLensState(next);
    try { localStorage.setItem(LENS_KEY, JSON.stringify(next)); } catch { /* lasts until reload */ }
  };

  const study = lib && route.study ? lib.studies.find((s) => s.folder === ROOT + route.study) || null : null;
  let body: ComponentChildren;
  if (route.page === 'settings') body = <SettingsPage settings={settings} onSave={(s) => { setSettings(saveSettings(s)); location.hash = '#/'; }} />;
  else if (!lib) body = state === 'error' ? <p class="cs-note">{error}</p> : <p class="cs-note">Reading the studies…</p>;
  else if (route.page === 'lenses') body = <LensesPage lib={lib} />;
  else if (route.page === 'home' || !study) body = <HomePage lib={lib} missing={route.page !== 'home' ? route.study || '' : ''} />;
  else if (route.page === 'character') body = <CharacterPage lib={lib} study={study} name={route.name || ''} lens={lens.character} setLens={setLens} source={source} afterSave={sync} />;
  else if (route.page === 'kishotenketsu') body = <KishotenketsuPage lib={lib} study={study} />;
  else if (route.page === 'scene') body = <ScenePage lib={lib} study={study} id={route.name || ''} tab={route.sceneTab || 'read'} lens={lens} setLens={setLens} source={source} />;
  else body = <StudyPage lib={lib} study={study} tab={route.tab || 'character'} view={route.view || 'board'} traits={route.traits ? { name: route.name || '', lens: route.lens || '' } : null} lens={lens} setLens={setLens} source={source} />;

  return (
    <div class="cs">
      <header class="cs-top">
        <a class="cs-brand" href="#/"><img src="./icons/icon.svg" alt="" width="28" height="28" />Crow</a>
        <nav class="cs-topnav">
          <a href="#/lenses">Lenses</a>
          <button type="button" class="cs-sync" onClick={sync}>Refresh</button>
          <a href="#/settings">Settings</a>
        </nav>
      </header>
      {demo && route.page !== 'settings' && <p class="cs-banner">This is a made-up sample. To see your own studies, <a href="#/settings">paste your key in Settings</a>.</p>}
      {error && lib && <p class="cs-banner">{error}</p>}
      <main class="cs-main">{body}</main>
    </div>
  );
}

// ------------------------------------------------------------------ small parts

function useFaceUrl(source: VaultSource, f: FileEntry | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (f && faceUrls.get(f.sha)) || null);
  useEffect(() => {
    let live = true;
    setUrl((f && faceUrls.get(f.sha)) || null);
    if (f) faceUrl(source, f).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [f && f.sha]);
  return url;
}

function Face({ source, c, big }: { source: VaultSource; c: StudyCharacter; big?: boolean }) {
  const url = useFaceUrl(source, c.face);
  return (
    <div class={'cs-face' + (big ? ' big' : '')}>
      {url ? <img src={url} alt={'Picture of ' + c.name} /> : (
        <svg viewBox="0 0 100 120" role="img" aria-label={'No picture of ' + c.name + ' yet'}>
          <circle cx="50" cy="44" r="22" />
          <path d="M10 120c0-26 18-42 40-42s40 16 40 42z" />
          <text x="50" y="50" text-anchor="middle">{initials(c.name)}</text>
        </svg>
      )}
    </div>
  );
}

const ROLE_WORD: Record<string, string> = { driver: 'Drives', opposes: 'Opposes', supports: 'Supports', receives: 'Receives' };
const roleClass = (r: Role) => 'role-' + (r || 'none');

/** A cast icon: the face if the study has one, else initials; a square for a force such as The world. The ring is the role. */
function Token({ study, source, name, role, size = 'm', turning }: { study: Study; source: VaultSource; name: string; role?: Role; size?: 's' | 'm' | 'l'; turning?: boolean }) {
  const url = useFaceUrl(source, faceFor(study, name));
  const cls = ['cs-token', 'size-' + size, roleClass(role || ''), isForce(name) ? 'force' : '', turning ? 'turning' : ''].filter(Boolean).join(' ');
  return (
    <span class={cls} title={name + (role ? ': ' + ROLE_WORD[role].toLowerCase() : '')}>
      {url ? <img src={url} alt="" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}

function RoleKey() {
  return (
    <div class="cs-rolekey" aria-label="Role in the scene">
      <span class="cs-quiet">Ring colour:</span>
      {ROLES.map((r) => <span key={r} class={'cs-rolekey-item ' + roleClass(r)}><span class="cs-ring" />{ROLE_WORD[r]}</span>)}
      <span class="cs-rolekey-item"><span class="cs-ring turning" />Turning beat</span>
    </div>
  );
}

function Chips({ lenses, value, onPick, plain }: { lenses: Lens[]; value: string; onPick: (n: string) => void; plain: string }) {
  return (
    <div class="cs-chips" role="tablist">
      <button type="button" role="tab" aria-selected={!value} class={!value ? 'on' : ''} onClick={() => onPick('')}>{plain}</button>
      {lenses.map((l) => (
        <button type="button" role="tab" key={l.name} aria-selected={value === l.name} class={value === l.name ? 'on' : ''} onClick={() => onPick(l.name)}>{l.name}</button>
      ))}
    </div>
  );
}

function Tabs({ study, tab }: { study: Study; tab: Tab }) {
  return (
    <div class="cs-tabs">
      <a href={studyHref(study, 'character')} class={tab === 'character' ? 'on' : ''}>Character</a>
      <a href={studyHref(study, 'plot')} class={tab === 'plot' ? 'on' : ''}>Plot</a>
      <a href={studyHref(study, 'engine')} class={tab === 'engine' ? 'on' : ''}>Engine</a>
    </div>
  );
}

function ReadingList({ lens, reading }: { lens?: Lens; reading?: Reading }) {
  if (lens && !lens.fields.length) return <p class="cs-quiet">This lens is waiting for its source: {lens.source || 'not added yet'}.</p>;
  if (!reading || !reading.length) return <p class="cs-quiet">Not read through this lens yet.</p>;
  return (
    <dl class="cs-reading">
      {reading.map(([k, v], i) => (
        <div key={i}><dt>{k}</dt><dd dangerouslySetInnerHTML={{ __html: inline(v) }} /></div>
      ))}
    </dl>
  );
}

function Prose({ text }: { text: string }) {
  if (!text) return null;
  const paras = text.split(/\n{2,}/);
  return (
    <div class="cs-prose">
      {paras.map((p, i) => {
        const lines = p.split('\n');
        if (lines.every((l) => /^\s*[-*]\s/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j} dangerouslySetInnerHTML={{ __html: inline(l.replace(/^\s*[-*]\s+/, '')) }} />)}</ul>;
        if (lines.every((l) => /^\s*\d+\.\s/.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j} dangerouslySetInnerHTML={{ __html: inline(l.replace(/^\s*\d+\.\s+/, '')) }} />)}</ol>;
        if (lines.length > 1 && lines.every((l) => /^\s*\|.*\|\s*$/.test(l))) {
          // A pipe table: the first row is the head, a row of dashes is skipped (the engine note's scene table).
          const rows = lines.map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())).filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
          return (
            <table key={i}>
              <thead><tr>{rows[0].map((c, j) => <th key={j} dangerouslySetInnerHTML={{ __html: inline(c) }} />)}</tr></thead>
              <tbody>{rows.slice(1).map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} dangerouslySetInnerHTML={{ __html: inline(c) }} />)}</tr>)}</tbody>
            </table>
          );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: inline(p) }} />;
      })}
    </div>
  );
}

const HOLDS: Record<string, string> = { yes: 'Holds', partly: 'Partly holds', no: 'Breaks', first: 'First scene' };
function HoldsMark({ v }: { v: string }) {
  return v ? <span class={'cs-holds ' + v}>{HOLDS[v] || v}</span> : null;
}

function Tallies({ study, name }: { study: Study; name: string }) {
  const t = tally(study, name);
  const total = name ? scenesOf(study, name).length : study.scenes.length;
  if (!t.length) return <p class="cs-quiet">No scene has a best lens yet.</p>;
  return (
    <ul class="cs-tally">
      {t.map((x) => (
        <li key={x.lens}>
          <span class="cs-tally-name">{x.lens}</span>
          <span class="cs-bar"><span style={{ width: Math.round((100 * x.best) / Math.max(1, total)) + '%' }} /></span>
          <span class="cs-tally-n">{x.best} of {total}</span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ pages

/** The testing zone (Kyle, 2026-10-28: "bring this view one button click away from the front page"): the first scene's
 *  beats, broken into every McKee beat, one tap from the front page. Konosuba when it is there, else the first study. */
function BeatLab({ lib }: { lib: StudyLibrary }) {
  const study = lib.studies.find((s) => /konosuba/i.test(s.folder)) || lib.studies.find((s) => s.scenes.length);
  const s = study && study.scenes[0];
  if (!study || !s) return null;
  return (
    <a class="cs-lab" href={sceneHref(study, s.id, 'beats')}>
      <span class="cs-quiet">Testing zone · {study.title}</span>
      <strong>{s.id} {s.title}: every beat</strong>
      <span>{s.plot.beats.length} beats, each an action and the reaction to it (McKee)</span>
    </a>
  );
}

function HomePage({ lib, missing }: { lib: StudyLibrary; missing: string }) {
  return (
    <section>
      <BeatLab lib={lib} />
      <h1>Studies</h1>
      {missing && <p class="cs-note">There is no study called {missing}. Pick one below.</p>}
      {!lib.studies.length && <p class="cs-note">No studies yet. Paste a chapter in the Crow project's chat and the first one appears here.</p>}
      <div class="cs-studies">
        {lib.studies.map((s) => (
          <a class="cs-study" href={studyHref(s)} key={s.folder}>
            <strong>{s.title}</strong>
            <span>{[s.author, s.medium].filter(Boolean).join(', ')}</span>
            <span class="cs-quiet">{s.characters.length} characters, {s.scenes.length} scenes</span>
          </a>
        ))}
      </div>
      {lib.problems.length > 0 && <ul class="cs-problems">{lib.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
    </section>
  );
}

function StudyHead({ study, tab }: { study: Study; tab: Tab }) {
  return (
    <div class="cs-head">
      <a class="cs-back" href="#/">Studies</a>
      <h1>{study.title}</h1>
      <p class="cs-quiet">{[study.author, study.medium].filter(Boolean).join(', ')}</p>
      <Tabs study={study} tab={tab} />
    </div>
  );
}

function Card({ lib, study, c, lens, source }: { lib: StudyLibrary; study: Study; c: StudyCharacter; lens: string; source: VaultSource }) {
  const l = lib.lenses.find((x) => x.name === lens);
  const t = tally(study, c.name);
  const n = scenesOf(study, c.name).length;
  return (
    <a class="cs-card" href={charHref(study, c.name)}>
      <h2>{c.name}</h2>
      <Face source={source} c={c} />
      {c.role && <p class="cs-role">{c.role}</p>}
      {!lens ? (
        <>
          {c.facts.length > 0 && <ul class="cs-facts">{c.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>}
          <p class="cs-best">Best lens so far: <strong>{c.bestLens || (t[0] && t[0].lens) || 'not yet'}</strong>{t[0] ? ' (' + t[0].best + ' of ' + n + ' scenes)' : ''}</p>
        </>
      ) : <ReadingList lens={l} reading={c.readings[lens]} />}
    </a>
  );
}

function StudyPage({ lib, study, tab, view, traits, lens, setLens, source }: { lib: StudyLibrary; study: Study; tab: Tab; view: PlotViewName; traits: { name: string; lens: string } | null; lens: Record<Side, string>; setLens: (s: Side, n: string) => void; source: VaultSource }) {
  const learning = study.sections['What we are learning'];
  const views: [PlotViewName, string][] = [['board', 'Story board'], ['drivers', 'Who drives the plot'], ['lenses', 'Plot lenses']];
  return (
    <section>
      <StudyHead study={study} tab={tab} />
      {tab === 'character' && (
        <nav class="cs-views">
          <a href={studyHref(study)} class={!traits ? 'on' : ''} aria-current={!traits ? 'page' : undefined}>Cards</a>
          <a href={traitsHref(study)} class={traits ? 'on' : ''} aria-current={traits ? 'page' : undefined}>Trait table</a>
        </nav>
      )}
      {tab === 'engine' ? <EngineView study={study} />
      : tab === 'character' && traits ? <TraitTable study={study} pick={traits} source={source} />
      : tab === 'character' ? (
        <>
          <Chips lenses={lensesFor(lib, 'character')} value={lens.character} onPick={(n) => setLens('character', n)} plain="Card" />
          {!study.characters.length && <p class="cs-note">No characters yet.</p>}
          <div class="cs-cards">{study.characters.map((c) => <Card key={c.name} lib={lib} study={study} c={c} lens={lens.character} source={source} />)}</div>
          <h2 class="cs-h2">Scene by scene</h2>
          <SceneRows study={study} />
        </>
      ) : (
        <>
          <nav class="cs-views">{views.map(([v, label]) => <a key={v} href={plotHref(study, v)} class={view === v ? 'on' : ''} aria-current={view === v ? 'page' : undefined}>{label}</a>)}</nav>
          {view === 'board' ? <StoryBoard study={study} source={source} />
            : view === 'drivers' ? <Drivers study={study} source={source} />
            : <>
              <Chips lenses={lensesFor(lib, 'plot')} value={lens.plot} onPick={(n) => setLens('plot', n)} plain="Overview" />
              <PlotView lib={lib} study={study} lens={lens.plot} />
            </>}
        </>
      )}
      {learning && tab !== 'engine' && <><h2 class="cs-h2">What we are learning</h2><Prose text={learning} /></>}
    </section>
  );
}

// ------------------------------------------------------------------ the Engine tab and the Kishōtenketsu page (Kyle, 2026-10-27)

/** The study's Engine.md: the distilled method, section by section, with the characters' parts as cards. */
function EngineView({ study }: { study: Study }) {
  const e: Engine | null = study.engine;
  if (!e) {
    return (
      <>
        <p class="cs-note">No engine note yet. The team writes Studies/{study.title}/Engine.md once five or six scenes are read: what matters about each character, what the world does, where the scenes come from, and how to build one.</p>
        <p><a class="cs-pagelink" href={kishoHref(study)}>Kishōtenketsu, scene by scene</a></p>
      </>
    );
  }
  return (
    <div class="cs-engine">
      <h2 class="cs-engine-title">{e.title}</h2>
      {e.lead && <Prose text={e.lead} />}
      <p><a class="cs-pagelink" href={kishoHref(study)}>Kishōtenketsu, scene by scene: each scene's premise and beats by part</a></p>
      {e.sections.map((sec) => (
        <section class="cs-engine-sec" key={sec.heading}>
          <h2 class="cs-h2">{sec.heading}</h2>
          {sec.text && <Prose text={sec.text} />}
          {sec.parts.length > 0 && (
            <div class="cs-engine-parts">
              {sec.parts.map((p) => {
                const carded = study.characters.some((c) => c.name === p.heading);
                return (
                  <div class="cs-block cs-engine-part" key={p.heading}>
                    <h3>{carded ? <a href={charHref(study, p.heading)}>{p.heading}</a> : p.heading}</h3>
                    <Prose text={p.text} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

const PART_LABEL: Record<Exclude<Part, ''>, string> = { ki: 'Ki', shō: 'Shō', ten: 'Ten', ketsu: 'Ketsu' };

function PartKey() {
  return (
    <p class="cs-quiet cs-part-key">
      {PARTS.map((p) => <span key={p}><span class={'cs-part-swatch ' + partClass(p)} />{PART_LABEL[p]}: {PART_WORDS[p]}</span>)}
    </p>
  );
}
const partClass = (p: Part): string => (p === 'shō' ? 'sho' : p || 'none');

/** One beat as a block coloured by its part. */
function PartBeat({ b }: { b: Beat }) {
  return (
    <li class={'cs-pbeat ' + partClass(b.part) + (b.turning ? ' turning' : '')}>
      <span class="cs-pbeat-tag">{b.part ? PART_LABEL[b.part] : 'untagged'}{b.turning ? ' · turning' : ''}</span>
      <span class="cs-pbeat-who">{b.who}{b.kind ? <span class="cs-quiet"> ({b.kind})</span> : null}</span>
      <span class="cs-pbeat-text" dangerouslySetInnerHTML={{ __html: inline(b.text) }} />
    </li>
  );
}

/** The scene's beats as a thin strip, one block per beat coloured by part, so the turn's place can be seen at a glance. */
function PartStrip({ s }: { s: StudyScene }) {
  return <span class="cs-pstrip" aria-hidden="true">{s.plot.beats.map((b, i) => <span key={i} class={'cs-pstrip-cell ' + partClass(b.part) + (b.turning ? ' turning' : '')} />)}</span>;
}

/** The dedicated Kishōtenketsu page (Kyle, 2026-10-27): each scene's premise, its beats as the four parts, and how
 *  the ketsu of one scene hands on to the ki of the next. */
function KishotenketsuPage({ lib, study }: { lib: StudyLibrary; study: Study }) {
  const lens = lib.lenses.find((l) => /^kish/i.test(l.name));
  const hands = handoffs(study);
  const turns = study.scenes.map((s) => ({ s, t: turnAt(s) }));
  const tagged = turns.filter((x) => x.t).length;
  return (
    <section class="cs-kisho">
      <a class="cs-back" href={studyHref(study, 'engine')}>{study.title}: Engine</a>
      <h1>Kishōtenketsu</h1>
      <p class="cs-quiet">{lens ? lens.framework : 'Four parts: ki sets up, shō develops, ten turns, ketsu settles.'}{lens && lens.question ? ' ' + lens.question : ''}</p>
      <PartKey />

      <h2 class="cs-h2">Where the turn falls</h2>
      {tagged === 0 ? <p class="cs-note">No scene's beats are tagged with their parts yet.</p> : (
        <ol class="cs-turns">
          {turns.map(({ s, t }) => (
            <li key={s.id}>
              <a href={sceneHref(study, s.id, 'beats')}><span class="cs-id">{s.id}</span> <strong>{s.title}</strong></a>
              <PartStrip s={s} />
              <span class="cs-quiet">{t ? 'turn at beat ' + t.at + ' of ' + t.of : 'no ten'}</span>
            </li>
          ))}
        </ol>
      )}

      <h2 class="cs-h2">Scene by scene</h2>
      {!study.scenes.length && <p class="cs-note">No scenes yet.</p>}
      <ol class="cs-kisho-scenes">
        {study.scenes.map((s, i) => {
          const reading = s.plot.readings[lens ? lens.name : 'Kishōtenketsu'] || [];
          const reread = reading.find(([k]) => /re-?reads?/i.test(k));
          const fit = reading.find(([k]) => /^fit$/i.test(k));
          const hand = i > 0 ? hands[i - 1] : null;
          return (
            <Fragment key={s.id}>
              {hand && (
                <li class="cs-handoff">
                  <div class={'cs-link ' + linkClass(s.plot.link)}>{linkWord(s.plot.link)}</div>
                  <div class="cs-handoff-cols">
                    <div><h4 class="cs-caps">{hand.from.id} ends (ketsu)</h4>{hand.ketsu.length ? <ul>{hand.ketsu.map((b, j) => <li key={j} dangerouslySetInnerHTML={{ __html: inline(b.text) }} />)}</ul> : <p class="cs-quiet">No ketsu tagged.</p>}</div>
                    <div><h4 class="cs-caps">{s.id} starts (ki)</h4>{hand.ki.length ? <ul>{hand.ki.map((b, j) => <li key={j} dangerouslySetInnerHTML={{ __html: inline(b.text) }} />)}</ul> : <p class="cs-quiet">No ki tagged.</p>}</div>
                  </div>
                  {s.plot.whyNext && <p class="cs-handoff-why"><span class="cs-quiet">Why next: </span><span dangerouslySetInnerHTML={{ __html: inline(s.plot.whyNext) }} /></p>}
                </li>
              )}
              <li class="cs-kisho-scene">
                <a class="cs-kisho-head" href={sceneHref(study, s.id, 'beats')}><span class="cs-id">{s.id}</span> <strong>{s.title}</strong> <span class="cs-quiet">{s.where}</span></a>
                {s.premise ? <p class="cs-premise">{s.premise}</p> : <p class="cs-quiet">No premise written yet.</p>}
                {fit && <p class="cs-fit"><span dangerouslySetInnerHTML={{ __html: inline(fit[1]) }} /></p>}
                {s.plot.beats.length ? <ol class="cs-pbeats">{s.plot.beats.map((b, j) => <PartBeat key={j} b={b} />)}</ol> : <p class="cs-quiet">No beats yet.</p>}
                {reread && <p class="cs-reread"><span class="cs-quiet">{reread[0]}: </span><span dangerouslySetInnerHTML={{ __html: inline(reread[1]) }} /></p>}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

function SceneRows({ study }: { study: Study }) {
  if (!study.scenes.length) return <p class="cs-note">No scenes yet.</p>;
  return (
    <ol class="cs-rows">
      {study.scenes.map((s) => (
        <li key={s.id}>
          <a href={sceneHref(study, s.id)}>
            <span class="cs-id">{s.id}</span>
            <span class="cs-row-main"><strong>{s.title}</strong><span class="cs-quiet">{s.where}</span></span>
            <span class="cs-row-cast">
              {s.cast.map((c) => <span key={c.name} class="cs-pill"><b>{c.name}</b> {c.bestLens || 'no lens yet'} <HoldsMark v={c.holds} /></span>)}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

const VERDICT_WORD: Record<Verdict, string> = { yes: 'Holds', partly: 'Partly', no: 'Breaks', unshown: 'Not shown' };

/** The trait table (Kyle, 2026-10-27: "a table where i can see each of these character traits from a particular
 *  perspective, and see if they hold up"). One character and one lens (or every lens): a row per field with the card's
 *  reading, a column per scene with the scene's own reading, coloured by the card's ## Checks verdict. */
function TraitTable({ study, pick, source }: { study: Study; pick: { name: string; lens: string }; source: VaultSource }) {
  const withChecks = study.characters.filter((c) => c.checks.length);
  if (!withChecks.length) return <p class="cs-note">No card has its checks yet. The team adds them when it audits the cards.</p>;
  const c = withChecks.find((x) => x.name === pick.name) || withChecks[0];
  const lensNames = [...new Set(c.checks.map((k) => k.lens))];
  const lens = lensNames.includes(pick.lens) ? pick.lens : '';
  const rows = c.checks.filter((k) => !lens || k.lens === lens);
  const scenes = study.scenes.filter((s) => s.cast.some((x) => x.name === c.name) || rows.some((k) => k.verdicts[s.id]));
  const cols = { gridTemplateColumns: 'minmax(190px, 1.4fr) repeat(' + scenes.length + ', minmax(150px, 1fr))', '--n': String(scenes.length) };
  const verdicts: Verdict[] = ['yes', 'partly', 'no', 'unshown'];
  return (
    <>
      <div class="cs-pickrow" role="group" aria-label="Character">
        {withChecks.map((x) => (
          <a key={x.name} href={traitsHref(study, x.name, lens)} class={'cs-pick' + (x === c ? ' on' : '')} aria-current={x === c ? 'true' : undefined}>
            <Token study={study} source={source} name={x.name} size="s" /><span>{x.name}</span>
          </a>
        ))}
      </div>
      <div class="cs-chips" role="group" aria-label="Lens">
        <a href={traitsHref(study, c.name)} class={!lens ? 'on' : ''}>Every lens</a>
        {lensNames.map((l) => <a key={l} href={traitsHref(study, c.name, l)} class={lens === l ? 'on' : ''}>{l}</a>)}
      </div>
      <div class="cs-verdictkey">{verdicts.map((v) => <span key={v} class={'cs-verdict v-' + v}>{VERDICT_WORD[v]}</span>)}</div>
      <div class="cs-grid-box">
        <div class="cs-grid cs-traits" role="table" aria-label={'Does ' + c.name + "'s card hold, scene by scene"}>
          <div class="cs-grid-row head" role="row" style={cols}>
            <span role="columnheader" class="cs-sticky">Trait, as the card reads it</span>
            {scenes.map((s) => <a role="columnheader" key={s.id} href={sceneHref(study, s.id, 'lenses')}><b>{s.id}</b><span>{s.title}</span></a>)}
          </div>
          {rows.map((k, i) => {
            const card = c.readings[k.lens] ? (c.readings[k.lens].find(([f]) => f.toLowerCase() === k.field.toLowerCase()) || ['', ''])[1] : '';
            const judged = Object.values(k.verdicts).filter((v) => v !== 'unshown');
            const yes = judged.filter((v) => v === 'yes').length;
            return (
              <Fragment key={k.lens + '·' + k.field}>
                {!lens && (i === 0 || rows[i - 1].lens !== k.lens) && <div class="cs-traits-lens" role="row"><span role="rowheader" class="cs-sticky">{k.lens}</span></div>}
                <div class="cs-grid-row" role="row" style={cols}>
                  <span role="rowheader" class="cs-trait cs-sticky"><b>{k.field}</b><span class="cs-holdcount">{judged.length ? 'Holds in ' + yes + ' of ' + judged.length : 'Not shown yet'}</span>{card ? <span dangerouslySetInnerHTML={{ __html: inline(card) }} /> : <span class="cs-quiet">not on the card</span>}</span>
                  {scenes.map((s) => {
                    const v = k.verdicts[s.id];
                    const text = sceneField(s, c.name, k.lens, k.field);
                    return (
                      <a role="cell" key={s.id} href={sceneHref(study, s.id, 'lenses')} class={'cs-tcell' + (v ? ' v-' + v : ' v-none')}>
                        {v && <span class={'cs-verdict v-' + v}>{VERDICT_WORD[v]}</span>}
                        {text ? <span class="cs-tcell-text" dangerouslySetInnerHTML={{ __html: inline(text) }} /> : !v ? <span class="cs-quiet">not in it</span> : null}
                      </a>
                    );
                  })}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
      <p class="cs-quiet cs-grid-key">"Holds in" counts the scenes where the trait fully holds, out of the scenes that show it. Tap a cell to open that scene's lenses.</p>
    </>
  );
}

/** The story board (Kyle, 2026-10-26): scenes side by side, joined by therefore or but, each with its cast ringed by
 *  role and its beats as a strip of icons of who caused them, the turning beat ringed. */
function StoryBoard({ study, source }: { study: Study; source: VaultSource }) {
  if (!study.scenes.length) return <p class="cs-note">No scenes yet.</p>;
  return (
    <>
      <RoleKey />
      <div class="cs-board" role="list">
        {study.scenes.map((s, i) => {
          const v = valueShift(s);
          return (
            <div class="cs-board-step" role="listitem" key={s.id}>
              {i > 0 && <span class={'cs-joint ' + linkClass(s.plot.link)}>{linkWord(s.plot.link)}</span>}
              <div class="cs-board-card">
                <a class="cs-board-title" href={sceneHref(study, s.id)}><span class="cs-id">{s.id} · {s.where}</span><strong>{s.title}</strong></a>
                {(v.from || v.to) && <div class="cs-board-sec"><Shift v={v} short /></div>}
                <div class="cs-board-sec">
                  <h3>Cast</h3>
                  <ul class="cs-board-cast">
                    {players(s).map((p) => (
                      <li key={p.name}><Token study={study} source={source} name={p.name} role={p.role} /><span class="cs-tok-name">{p.name}</span><span class={'cs-tok-role ' + roleClass(p.role)}>{p.role ? ROLE_WORD[p.role] : 'role not read'}</span></li>
                    ))}
                  </ul>
                </div>
                <a class="cs-board-sec cs-board-beats" href={sceneHref(study, s.id, 'beats')} aria-label={'The beats of ' + s.id + ', by who causes them'}>
                  <h3>Beats, by who causes them</h3>
                  {s.plot.beats.length ? (
                    <span class="cs-strip">
                      {s.plot.beats.map((b, j) => {
                        const who = beatOwner(s, b);
                        const p = players(s).find((x) => x.name === who);
                        return <Token key={j} study={study} source={source} name={who || '?'} role={p ? p.role : ''} size="s" turning={b.turning} />;
                      })}
                    </span>
                  ) : <span class="cs-quiet">No beats yet.</span>}
                </a>
                {s.plot.bestLens && <p class="cs-board-lens">Best plot lens: <strong>{s.plot.bestLens}</strong></p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The Value Shift reading: what is at stake, where the scene starts and where it ends. Short on the board (first clause). */
function Shift({ v, short }: { v: { value: string; from: string; to: string }; short?: boolean }) {
  // On the board, the first clause; a bare "positive" or "negative" takes the next clause with it.
  const cut = (t: string) => {
    if (!short) return t;
    const parts = t.split(/;\s|\s\(/);
    let out = parts[0];
    for (let i = 1; i < parts.length && out.length < 20; i++) out += '; ' + parts[i];
    return out;
  };
  return (
    <div class={'cs-shift' + (short ? ' short' : '')}>
      <span class="cs-caps">{v.value ? 'Value: ' + v.value : 'Value'}</span>
      <span class="cs-shift-line"><b class="cs-from-label">From</b> <span dangerouslySetInnerHTML={{ __html: inline(cut(v.from)) }} /></span>
      <span class="cs-shift-line"><b class="cs-to-label">To</b> <span dangerouslySetInnerHTML={{ __html: inline(cut(v.to)) }} /></span>
    </div>
  );
}

/** Who drives the plot: one row per character or force, one column per scene, their role there and the beats they caused. */
function Drivers({ study, source }: { study: Study; source: VaultSource }) {
  if (!study.scenes.length) return <p class="cs-note">No scenes yet.</p>;
  const rows = driveGrid(study);
  const turns = rows.filter((r) => r.turning).sort((a, b) => b.turning - a.turning).map((r) => r.name + ' ' + r.turning).join(' · ');
  const runs: { name: string; n: number }[] = [];
  for (const s of study.scenes) {
    const d = players(s).find((p) => p.role === 'driver');
    const name = d ? d.name : 'no driver read';
    const last = runs[runs.length - 1];
    if (last && last.name === name) last.n++; else runs.push({ name, n: 1 });
  }
  const driven = runs.map((r) => r.name + (r.n > 1 ? ' (' + r.n + ' scenes)' : '')).join(', then ');
  const cols = { gridTemplateColumns: 'minmax(150px, 1.3fr) repeat(' + study.scenes.length + ', minmax(110px, 1fr)) minmax(70px, auto)' };
  return (
    <>
      <div class="cs-tiles">
        <div class="cs-tile"><span class="cs-quiet">Turning beats</span><strong>{turns || 'none marked yet'}</strong></div>
        <div class="cs-tile"><span class="cs-quiet">Driver by scene</span><strong>{driven}</strong></div>
      </div>
      <div class="cs-grid-box">
        <div class="cs-grid" role="table" aria-label="Who drives the plot">
          <div class="cs-grid-row head" role="row" style={cols}>
            <span role="columnheader">Character</span>
            {study.scenes.map((s) => <a role="columnheader" key={s.id} href={sceneHref(study, s.id, 'beats')}><b>{s.id}</b><span>{s.title}</span></a>)}
            <span role="columnheader" class="cs-grid-n">Beats caused</span>
          </div>
          {rows.map((r) => (
            <div class="cs-grid-row" role="row" key={r.name} style={cols}>
              <span role="rowheader" class="cs-grid-who"><Token study={study} source={source} name={r.name} />{r.carded && study.characters.some((c) => c.name === r.name) ? <a href={charHref(study, r.name)}>{r.name}</a> : <span>{r.name}</span>}</span>
              {r.cells.map((c, i) => (
                <span role="cell" key={i} class="cs-grid-cell">
                  {c.present && (
                    <>
                      <span class={'cs-tok-role ' + roleClass(c.role)}>{c.role ? ROLE_WORD[c.role] : 'in it'}</span>
                      <span class={'cs-dots ' + roleClass(c.role)} aria-label={c.beats + (c.beats === 1 ? ' beat' : ' beats') + (c.turning ? ', with the turning beat' : '')}>
                        {Array.from({ length: c.beats }, (_, j) => <span key={j} class={'cs-dot' + (c.turning && j === 0 ? ' turning' : '')} />)}
                      </span>
                    </>
                  )}
                </span>
              ))}
              <span role="cell" class="cs-grid-n">{r.beats}</span>
            </div>
          ))}
        </div>
      </div>
      <p class="cs-quiet cs-grid-key"><span class="cs-dot" /> a beat they caused <span class="cs-dot turning" /> the scene's turning beat</p>
    </>
  );
}

function PlotView({ lib, study, lens }: { lib: StudyLibrary; study: Study; lens: string }) {
  const l = lib.lenses.find((x) => x.name === lens);
  return (
    <>
      {study.sections['Plot structure'] && <><h2 class="cs-h2">How the plot is built</h2><Prose text={study.sections['Plot structure']} /></>}
      <h2 class="cs-h2">Which plot lens explains the scenes</h2>
      <Tallies study={study} name="" />
      {l && /^kish/i.test(l.name) && <p><a class="cs-pagelink" href={kishoHref(study)}>Kishōtenketsu, scene by scene: each scene's premise and beats by part</a></p>}
      <h2 class="cs-h2">Scene by scene</h2>
      {!study.scenes.length && <p class="cs-note">No scenes yet.</p>}
      <ol class="cs-chain">
        {study.scenes.map((s, i) => (
          <li key={s.id}>
            {i > 0 && <div class={'cs-link ' + linkClass(s.plot.link)}>{linkWord(s.plot.link)}</div>}
            <a class="cs-beat" href={sceneHref(study, s.id)}>
              <div class="cs-beat-top"><span class="cs-id">{s.id}</span><strong>{s.title}</strong><span class="cs-quiet">{s.where}</span></div>
              {!lens ? (
                <dl class="cs-reading">
                  {s.plot.driver && <div><dt>Driven by</dt><dd>{s.plot.driver}</dd></div>}
                  {s.plot.whyNext && <div><dt>Why this scene comes next</dt><dd dangerouslySetInnerHTML={{ __html: inline(s.plot.whyNext) }} /></div>}
                  {s.plot.bestLens && <div><dt>Best lens</dt><dd><strong>{s.plot.bestLens}</strong>{s.plot.why ? '. ' : ''}<span dangerouslySetInnerHTML={{ __html: inline(s.plot.why) }} /></dd></div>}
                </dl>
              ) : <ReadingList lens={l} reading={s.plot.readings[lens]} />}
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}

function linkClass(link: string): string {
  const w = link.toLowerCase();
  return w.startsWith('therefore') ? 'therefore' : w.startsWith('but') ? 'but' : 'andthen';
}
function linkWord(link: string): string {
  const c = linkClass(link);
  return c === 'therefore' ? 'therefore' : c === 'but' ? 'but' : link ? 'and then' : 'link not read yet';
}

function CharacterPage({ lib, study, name, lens, setLens, source, afterSave }: { lib: StudyLibrary; study: Study; name: string; lens: string; setLens: (s: Side, n: string) => void; source: VaultSource; afterSave: () => Promise<void> }) {
  const c = study.characters.find((x) => x.name === name);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState('');
  if (!c) return <section><a class="cs-back" href={studyHref(study)}>{study.title}</a><p class="cs-note">There is no card for {name} yet.</p></section>;
  const lenses = lensesFor(lib, 'character');
  const shown = lens || c.bestLens;
  const l = lib.lenses.find((x) => x.name === shown);
  const canSave = !!source.writeBytes && source.key !== 'demo';

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const problem = coverProblem(file);
    if (problem) { setSaving(problem); return; }
    setSaving('Saving the picture…');
    try {
      const b64 = await shrinkToJpeg(file);
      const path = facePath(study.folder, c.name);
      await source.writeBytes!(path, b64, c.face && c.face.path === path ? c.face.sha : '', 'study: picture for ' + c.name);
      await afterSave();
      setSaving('');
    } catch (e) {
      setSaving((e as Error).message || 'The picture could not be saved. Try again.');
    }
  };

  return (
    <section>
      <a class="cs-back" href={studyHref(study)}>{study.title}</a>
      <div class="cs-person">
        <div class="cs-card big">
          <h1>{c.name}</h1>
          <Face source={source} c={c} big />
          {canSave && (
            <>
              <button type="button" class="soft cs-addpic" onClick={() => fileRef.current && fileRef.current.click()}>{c.face ? 'Change the picture' : 'Add a picture'}</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick((e.currentTarget.files || [])[0])} />
            </>
          )}
          {saving && <p class="cs-note">{saving}</p>}
          {c.role && <p class="cs-role">{c.role}</p>}
          {c.facts.length > 0 && <ul class="cs-facts">{c.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>}
        </div>
        <div class="cs-person-side">
          <h2 class="cs-h2">Which lens explains {c.name}</h2>
          <Tallies study={study} name={c.name} />
          <Chips lenses={lenses} value={lens} onPick={(n) => setLens('character', n)} plain="Best lens" />
          <h2 class="cs-h2">{shown || 'No lens yet'}: across the story so far</h2>
          {shown ? <ReadingList lens={l} reading={c.readings[shown]} /> : <p class="cs-quiet">Pick a lens above.</p>}
          {c.notes && <><h2 class="cs-h2">Notes</h2><Prose text={c.notes} /></>}
        </div>
      </div>
      <h2 class="cs-h2">Scene by scene</h2>
      <ol class="cs-timeline">
        {scenesOf(study, c.name).map(({ scene, me }) => {
          const here = lens || me.bestLens;
          return (
            <li key={scene.id}>
              <a class="cs-tl-head" href={sceneHref(study, scene.id)}><span class="cs-id">{scene.id}</span> <strong>{scene.title}</strong> <span class="cs-quiet">{scene.where}</span></a>
              <p><span class="cs-lensname">{me.bestLens || 'No best lens'}</span> <HoldsMark v={me.holds} /> <span dangerouslySetInnerHTML={{ __html: inline(me.why) }} /></p>
              <Moments list={me.moments} />
              {here && <><h3 class="cs-h3">{here} in this scene</h3><ReadingList lens={lib.lenses.find((x) => x.name === here)} reading={me.readings[here]} /></>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Moments({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <ul class="cs-moments">
      {list.map((m, i) => {
        const { quote, note } = splitMoment(m);
        return <li key={i}>{quote && <q>{quote}</q>} <span dangerouslySetInnerHTML={{ __html: inline(note) }} /></li>;
      })}
    </ul>
  );
}

function ScenePage({ lib, study, id, tab, lens, setLens, source }: { lib: StudyLibrary; study: Study; id: string; tab: SceneTab; lens: Record<Side, string>; setLens: (s: Side, n: string) => void; source: VaultSource }) {
  const at = study.scenes.findIndex((s) => s.id === id);
  const s: StudyScene | undefined = study.scenes[at];
  if (!s) return <section><a class="cs-back" href={plotHref(study, 'board')}>{study.title}</a><p class="cs-note">There is no scene {id}.</p></section>;
  const prev = study.scenes[at - 1], next = study.scenes[at + 1];
  const plotLens = lens.plot ? [lib.lenses.find((x) => x.name === lens.plot)].filter(Boolean) as Lens[] : lensesFor(lib, 'plot').filter((l) => s.plot.readings[l.name]);
  const tabs: [SceneTab, string][] = [['read', 'Read'], ['beats', 'Beats'], ['lenses', 'Lenses']];
  return (
    <section>
      <a class="cs-back" href={plotHref(study, 'board')}>{study.title}</a>
      <h1><span class="cs-id">{s.id}</span> {s.title}</h1>
      <p class="cs-quiet">{s.where}</p>
      <ul class="cs-scene-cast">
        {players(s).map((p) => <li key={p.name}><Token study={study} source={source} name={p.name} role={p.role} /><span><b>{p.name}</b> <span class={'cs-tok-role ' + roleClass(p.role)}>{p.role ? ROLE_WORD[p.role] : ''}</span></span></li>)}
      </ul>
      <div class="cs-pager">
        {prev ? <a href={sceneHref(study, prev.id, tab)}>Back: {prev.id}</a> : <span />}
        {next ? <a href={sceneHref(study, next.id, tab)}>Next: {next.id}</a> : <span />}
      </div>
      <nav class="cs-views">{tabs.map(([t, label]) => <a key={t} href={sceneHref(study, s.id, t)} class={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined}>{label}</a>)}</nav>

      {tab === 'read' && <SceneRead s={s} />}
      {tab === 'beats' && <SceneBeats study={study} s={s} source={source} />}
      {tab === 'lenses' && (
        <>
          <div class="cs-block">
            <h2>Plot</h2>
            <dl class="cs-reading">
              {s.plot.driver && <div><dt>Driven by</dt><dd>{s.plot.driver}</dd></div>}
              {s.plot.link && <div><dt>Link to the last scene</dt><dd>{s.plot.link}</dd></div>}
              {s.plot.whyNext && <div><dt>Why this scene comes next</dt><dd dangerouslySetInnerHTML={{ __html: inline(s.plot.whyNext) }} /></div>}
              {s.plot.bestLens && <div><dt>Best lens</dt><dd><strong>{s.plot.bestLens}</strong>{s.plot.why ? '. ' : ''}<span dangerouslySetInnerHTML={{ __html: inline(s.plot.why) }} /></dd></div>}
            </dl>
            <Chips lenses={lensesFor(lib, 'plot')} value={lens.plot} onPick={(n) => setLens('plot', n)} plain="Every lens" />
            {plotLens.map((l) => <div key={l.name}><h3 class="cs-h3">{l.name}</h3><ReadingList lens={l} reading={s.plot.readings[l.name]} /></div>)}
          </div>

          <Chips lenses={lensesFor(lib, 'character')} value={lens.character} onPick={(n) => setLens('character', n)} plain="Every lens" />
          {s.cast.map((c) => {
            const shown = lens.character ? [lib.lenses.find((x) => x.name === lens.character)].filter(Boolean) as Lens[] : lensesFor(lib, 'character').filter((l) => c.readings[l.name]);
            return (
              <div class="cs-block" key={c.name}>
                <h2><a href={charHref(study, c.name)}>{c.name}</a></h2>
                <p><span class="cs-lensname">{c.bestLens || 'No best lens'}</span> <HoldsMark v={c.holds} /> <span dangerouslySetInnerHTML={{ __html: inline(c.why) }} /></p>
                <Moments list={c.moments} />
                {shown.map((l) => <div key={l.name}><h3 class="cs-h3">{l.name}</h3><ReadingList lens={l} reading={c.readings[l.name]} /></div>)}
              </div>
            );
          })}
        </>
      )}

      <div class="cs-pager">
        {prev ? <a href={sceneHref(study, prev.id, tab)}>Back: {prev.id}</a> : <span />}
        {next ? <a href={sceneHref(study, next.id, tab)}>Next: {next.id}</a> : <span />}
      </div>
    </section>
  );
}

/** The whole scene: a link to the original on the translator's page (the story's text is never kept here), then our retelling. */
function SceneRead({ s }: { s: StudyScene }) {
  let host = '';
  try { host = s.sourceUrl ? new URL(s.sourceUrl).hostname.replace(/^www\./, '') : ''; } catch { host = ''; }
  return (
    <>
      <div class="cs-source">
        <div>
          <strong>The whole scene, in the original</strong>
          <span class="cs-quiet">{host ? 'Opens ' + host + ' in a new tab. The story\'s text stays there.' : 'No link to the original yet. The team adds it with the next scene.'}</span>
        </div>
        {host && <a class="cs-open" href={s.sourceUrl} target="_blank" rel="noopener noreferrer">Open the original</a>}
      </div>
      <h2 class="cs-h3 cs-caps">Our retelling</h2>
      {s.plot.retelling ? <div class="cs-retelling"><Prose text={s.plot.retelling} /></div>
        : s.summary ? <><p class="cs-summary">{s.summary}</p><p class="cs-quiet">This scene has a summary but no retelling yet.</p></>
        : <p class="cs-quiet">No retelling yet.</p>}
    </>
  );
}

/** Beat by beat, each with the icon of who caused it and its kind; the turning beat stands out. */
function SceneBeats({ study, s, source }: { study: Study; s: StudyScene; source: VaultSource }) {
  const v = valueShift(s);
  const at = study.scenes.indexOf(s);
  const ps = players(s);
  return (
    <>
      <div class="cs-beats-top">
        {(v.from || v.to) && <Shift v={v} />}
        {at > 0 && s.plot.link && <p>Link from {study.scenes[at - 1].id}: <span class={'cs-joint ' + linkClass(s.plot.link)}>{linkWord(s.plot.link)}</span></p>}
      </div>
      {!s.plot.beats.length && <p class="cs-note">No beats yet. The team adds them when it reads the scene.</p>}
      <ol class="cs-beatlist">
        {s.plot.beats.map((b, i) => {
          const who = beatOwner(s, b);
          const p = ps.find((x) => x.name === who);
          return (
            <li key={i} class={b.turning ? 'turning' : ''}>
              <span class="cs-beat-n">{i + 1}</span>
              <Token study={study} source={source} name={who || '?'} role={p ? p.role : ''} size="l" />
              <span class="cs-beat-body">
                <span class="cs-beat-text" dangerouslySetInnerHTML={{ __html: inline(b.text) }} />
                <span class="cs-beat-meta"><span class="cs-quiet">{[who, b.kind].filter(Boolean).join(' · ')}</span>{b.turning && <span class="cs-turn-badge">Turning beat</span>}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function LensesPage({ lib }: { lib: StudyLibrary }) {
  const side = (sd: Side, title: string) => (
    <>
      <h2 class="cs-h2">{title}</h2>
      <div class="cs-lenses">
        {lensesFor(lib, sd).map((l) => (
          <div class="cs-block" key={l.name}>
            <h3>{l.name}</h3>
            {l.question && <p><em>{l.question}</em></p>}
            {l.fields.length > 0 ? <p class="cs-quiet">Fills: {l.fields.join(', ')}</p> : <p class="cs-quiet">Waiting for its source.</p>}
            <Prose text={l.about} />
            <p class="cs-quiet">From: {l.framework}{l.source ? '. Source: ' + l.source : ''}</p>
          </div>
        ))}
      </div>
    </>
  );
  return (
    <section>
      <h1>Lenses</h1>
      <p class="cs-quiet">Ways of reading a character or a plot. A new lens is a new note in the vault's Studies/Lenses folder.</p>
      {side('character', 'Character lenses')}
      {side('plot', 'Plot lenses')}
    </section>
  );
}

function SettingsPage({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  const [token, setToken] = useState(settings.token);
  const [show, setShow] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e: Event) => {
    e.preventDefault();
    const next = { ...settings, token: token.trim() };
    if (!next.token) { setNote('Paste the key first.'); return; }
    setBusy(true);
    setNote('Checking the key with GitHub…');
    try {
      await new GitHubSource(next).test();
      onSave(next);
    } catch (err) {
      setNote((err as Error).message || 'GitHub did not accept the key. Check it and try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section class="cs-settings">
      <h1>Settings</h1>
      <h2 class="cs-h2">Your key</h2>
      <p>Crow reads your studies from the vault ({settings.owner}/{settings.repo}) with a GitHub key, the same kind Sparrow uses.
        The key is kept on this device only. From the home-screen icon, Crow keeps its own key, so paste it here once.</p>
      <p class={isConnected(settings) ? 'cs-ok' : 'cs-quiet'}>{isConnected(settings) ? 'A key is saved on this device.' : 'No key is saved on this device yet.'}</p>
      <form onSubmit={save}>
        <label class="cs-label" for="cs-key">Key</label>
        <div class="cs-keyrow">
          <input id="cs-key" type={show ? 'text' : 'password'} value={token} onInput={(e) => setToken(e.currentTarget.value)}
            autocomplete="off" autocapitalize="off" spellcheck={false} placeholder="github_pat_…" />
          <button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
        </div>
        <button type="submit" class="primary cs-save" disabled={busy}>Save the key</button>
      </form>
      {note && <p class="cs-note">{note}</p>}
      <h2 class="cs-h2">Sparrow</h2>
      <p><a href="../">Open Sparrow</a></p>
    </section>
  );
}
