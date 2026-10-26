// Crow's screens: the studies, a study's Character and Plot tabs, a character, a scene, the lenses, and Settings (the key).
// Reads Studies/ in the vault with the key saved on this device (shared with Sparrow in the same browser tab, its own
// when Crow runs from its home-screen icon); without one it shows the demo vault's sample study.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { loadSettings, saveSettings, isConnected, type Settings } from '../lib/settings.ts';
import { GitHubSource } from '../lib/github.ts';
import { DemoSource } from '../lib/demo-source.ts';
import { readPicture, writePicture } from '../lib/cache.ts';
import { coverProblem, shrinkToJpeg } from '../lib/covers.ts';
import { inline } from '../lib/markdown.ts';
import type { FileEntry, VaultSource } from '../lib/types.ts';
import {
  ROOT, buildLibrary, facePath, initials, lensesFor, scenesOf, splitMoment, studyFiles, tally,
  type Lens, type Reading, type Side, type Study, type StudyCharacter, type StudyLibrary, type StudyScene
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

// ------------------------------------------------------------------ routes: #/, #/lenses, #/s/<study>[/plot], #/s/<study>/c/<name>, #/s/<study>/scene/<id>

interface Route { page: 'home' | 'lenses' | 'settings' | 'study' | 'character' | 'scene'; study?: string; tab?: Side; name?: string; }

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  if (parts[0] === 'lenses') return { page: 'lenses' };
  if (parts[0] === 'settings') return { page: 'settings' };
  if (parts[0] !== 's' || !parts[1]) return { page: 'home' };
  const study = parts[1];
  if (parts[2] === 'c' && parts[3]) return { page: 'character', study, name: parts[3] };
  if (parts[2] === 'scene' && parts[3]) return { page: 'scene', study, name: parts[3] };
  return { page: 'study', study, tab: parts[2] === 'plot' ? 'plot' : 'character' };
}
const enc = encodeURIComponent;
const studyHref = (s: Study, tab: Side = 'character') => '#/s/' + enc(s.folder.slice(ROOT.length)) + (tab === 'plot' ? '/plot' : '');
const charHref = (s: Study, name: string) => '#/s/' + enc(s.folder.slice(ROOT.length)) + '/c/' + enc(name);
const sceneHref = (s: Study, id: string) => '#/s/' + enc(s.folder.slice(ROOT.length)) + '/scene/' + enc(id);

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
  else if (route.page === 'scene') body = <ScenePage lib={lib} study={study} id={route.name || ''} lens={lens} setLens={setLens} />;
  else body = <StudyPage lib={lib} study={study} tab={route.tab || 'character'} lens={lens} setLens={setLens} source={source} />;

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

function Face({ source, c, big }: { source: VaultSource; c: StudyCharacter; big?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (c.face) faceUrl(source, c.face).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [c.face && c.face.sha]);
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

function Tabs({ study, tab }: { study: Study; tab: Side }) {
  return (
    <div class="cs-tabs">
      <a href={studyHref(study, 'character')} class={tab === 'character' ? 'on' : ''}>Character</a>
      <a href={studyHref(study, 'plot')} class={tab === 'plot' ? 'on' : ''}>Plot</a>
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

function HomePage({ lib, missing }: { lib: StudyLibrary; missing: string }) {
  return (
    <section>
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

function StudyHead({ study, tab }: { study: Study; tab: Side }) {
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

function StudyPage({ lib, study, tab, lens, setLens, source }: { lib: StudyLibrary; study: Study; tab: Side; lens: Record<Side, string>; setLens: (s: Side, n: string) => void; source: VaultSource }) {
  const lenses = lensesFor(lib, tab);
  const learning = study.sections['What we are learning'];
  return (
    <section>
      <StudyHead study={study} tab={tab} />
      <Chips lenses={lenses} value={lens[tab]} onPick={(n) => setLens(tab, n)} plain={tab === 'character' ? 'Card' : 'Overview'} />
      {tab === 'character' ? (
        <>
          {!study.characters.length && <p class="cs-note">No characters yet.</p>}
          <div class="cs-cards">{study.characters.map((c) => <Card key={c.name} lib={lib} study={study} c={c} lens={lens.character} source={source} />)}</div>
          <h2 class="cs-h2">Scene by scene</h2>
          <SceneRows study={study} />
        </>
      ) : <PlotView lib={lib} study={study} lens={lens.plot} />}
      {learning && <><h2 class="cs-h2">What we are learning</h2><Prose text={learning} /></>}
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

function PlotView({ lib, study, lens }: { lib: StudyLibrary; study: Study; lens: string }) {
  const l = lib.lenses.find((x) => x.name === lens);
  return (
    <>
      {study.sections['Plot structure'] && <><h2 class="cs-h2">How the plot is built</h2><Prose text={study.sections['Plot structure']} /></>}
      <h2 class="cs-h2">Which plot lens explains the scenes</h2>
      <Tallies study={study} name="" />
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

function ScenePage({ lib, study, id, lens, setLens }: { lib: StudyLibrary; study: Study; id: string; lens: Record<Side, string>; setLens: (s: Side, n: string) => void }) {
  const at = study.scenes.findIndex((s) => s.id === id);
  const s: StudyScene | undefined = study.scenes[at];
  if (!s) return <section><a class="cs-back" href={studyHref(study)}>{study.title}</a><p class="cs-note">There is no scene {id}.</p></section>;
  const prev = study.scenes[at - 1], next = study.scenes[at + 1];
  const plotLens = lens.plot ? [lib.lenses.find((x) => x.name === lens.plot)].filter(Boolean) as Lens[] : lensesFor(lib, 'plot').filter((l) => s.plot.readings[l.name]);
  return (
    <section>
      <a class="cs-back" href={studyHref(study)}>{study.title}</a>
      <h1><span class="cs-id">{s.id}</span> {s.title}</h1>
      <p class="cs-quiet">{s.where}</p>
      {s.summary && <p class="cs-summary">{s.summary}</p>}
      <div class="cs-pager">
        {prev ? <a href={sceneHref(study, prev.id)}>Back: {prev.id}</a> : <span />}
        {next ? <a href={sceneHref(study, next.id)}>Next: {next.id}</a> : <span />}
      </div>

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
    </section>
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
