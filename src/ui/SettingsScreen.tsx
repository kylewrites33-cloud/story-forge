import { useState } from 'preact/hooks';
import { GitHubSource } from '../lib/github.ts';
import { normalise, type Settings } from '../lib/settings.ts';
import { DEFAULT_RATES, loadRates, readingLine, saveRates } from '../lib/home.ts';
import { chirp } from './chirp.ts';
import { AUTO, THEMES, loadTheme, saveTheme, type Theme } from '../lib/theme.ts';
import { loadTopRoom, saveTopRoom, type TopRoom } from '../lib/topbar.ts';

const TOKEN_PAGE = 'https://github.com/settings/personal-access-tokens/new';

export function SettingsScreen(props: { settings: Settings; onSave: (s: Settings) => void; onForget: () => void }) {
  const [form, setForm] = useState<Settings>(props.settings);
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const set = (k: keyof Settings) => (e: Event) => setForm({ ...form, [k]: (e.currentTarget as HTMLInputElement).value });

  const test = async () => {
    const s = normalise(form);
    if (!s.token) { setResult({ ok: false, text: 'Paste a token first.' }); return; }
    setTesting(true);
    setResult(null);
    try {
      setResult({ ok: true, text: await new GitHubSource(s).test() });
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const save = (e: Event) => {
    e.preventDefault();
    props.onSave(form);
    setResult({ ok: true, text: form.token ? 'Saved. Syncing with GitHub.' : 'Saved. With no token the app shows the demo vault.' });
  };

  return (
    <section>
      <h1>Settings</h1>
      <Colours />
      <TopOfScreen />
      <TimerSound />
      <h2>Vault</h2>
      <form class="settings" onSubmit={save}>
        <label>
          Token
          <span class="row">
            <input type={show ? 'text' : 'password'} value={form.token} onInput={set('token')} autocomplete="off" autocapitalize="off" spellcheck={false} placeholder="github_pat_…" />
            <button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
          </span>
          <span class="hint">
            The token stays in this browser and is only ever sent to GitHub. <a href={TOKEN_PAGE} target="_blank" rel="noopener noreferrer">Make a fine-grained token</a> for author-business with Contents set to read and write.
          </span>
        </label>
        <label>
          Owner
          <input value={form.owner} onInput={set('owner')} autocapitalize="off" spellcheck={false} />
        </label>
        <label>
          Repository
          <input value={form.repo} onInput={set('repo')} autocapitalize="off" spellcheck={false} />
        </label>
        <label>
          Branch
          <input value={form.branch} onInput={set('branch')} autocapitalize="off" spellcheck={false} />
        </label>
        <label>
          Vault folder
          <input value={form.root} onInput={set('root')} autocapitalize="off" spellcheck={false} placeholder="Leave empty when the vault is the whole repository" />
        </label>
        <p class="buttons">
          <button type="submit" class="primary">Save</button>
          <button type="button" onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test connection'}</button>
        </p>
        {result && <p class={result.ok ? 'ok' : 'error'} role="status">{result.text}</p>}
      </form>
      <ReadingRates />
      <h2>Forget</h2>
      <p>Removes the token and the saved copy of the vault from this browser.</p>
      <p class="buttons">
        <button type="button" onClick={() => { setForm({ ...form, token: '' }); props.onForget(); setResult({ ok: true, text: 'Forgotten.' }); }}>Forget token</button>
      </p>
    </section>
  );
}

/** Words per page and reading speed, for the pages and reading time shown beside word counts. Kept on this device. */
function ReadingRates() {
  const [rates, setRates] = useState(loadRates);
  const [page, setPage] = useState(String(rates.wordsPerPage));
  const [speed, setSpeed] = useState(String(rates.wordsPerMinute));
  const p = parseInt(page.replace(/[^0-9]/g, ''), 10), s = parseInt(speed.replace(/[^0-9]/g, ''), 10);
  const ok = p >= 50 && p <= 1000 && s >= 50 && s <= 1000;
  return (
    <>
      <h2>Pages and reading time</h2>
      <div class="settings">
        <p class="hint">The app shows "about 12 pages · 48 minutes to read" beside word counts. A paperback page holds about 250 to 300 words; most adults read about 240 words a minute. These stay on this device.</p>
        <label>
          Words per page
          <input type="text" inputMode="numeric" value={page} onInput={(e) => setPage((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label>
          Reading speed, in words a minute
          <input type="text" inputMode="numeric" value={speed} onInput={(e) => setSpeed((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <p class="buttons">
          <button type="button" class="primary" disabled={!ok} onClick={() => { const r = { wordsPerPage: p, wordsPerMinute: s }; saveRates(r); setRates(r); }}>Save</button>
          <button type="button" onClick={() => { saveRates(DEFAULT_RATES); setRates(DEFAULT_RATES); setPage(String(DEFAULT_RATES.wordsPerPage)); setSpeed(String(DEFAULT_RATES.wordsPerMinute)); }}>Back to 250 and 250</button>
        </p>
        <p class="hint">{ok ? 'A 90,000-word book is ' + readingLine(90000, { wordsPerPage: p, wordsPerMinute: s }) + '.' : 'Use numbers between 50 and 1,000.'}{rates.wordsPerPage !== p || rates.wordsPerMinute !== s ? ' Press Save to use these.' : ''}</p>
      </div>
    </>
  );
}

/** Try the Pomodoro's two chirps, to check this device's sound. */
function TimerSound() {
  return (
    <>
      <h2>Timer sound</h2>
      <p class="hint">The Pomodoro chirps when the writing ends and again when the break ends. Press to hear them on this device. While a timer runs, the screen stays on so the chirp can play.</p>
      <p class="buttons">
        <button type="button" onClick={() => chirp('work')}>End of writing</button>
        <button type="button" onClick={() => chirp('break')}>End of break</button>
      </p>
    </>
  );
}

/** The app's colours on this device: Match this device, eight light themes, six dark ones. Each card shows its own colours. */
function Colours() {
  const [choice, setChoice] = useState(loadTheme);
  const pick = (id: string) => { saveTheme(id); setChoice(id); };
  const card = (t: Theme) => (
    <button type="button" key={t.id} class="theme-card" data-theme={t.id} aria-pressed={choice === t.id} onClick={() => pick(t.id)}>
      <span class="theme-preview" aria-hidden="true">
        <span class="tp-rail"><i /><i /><i class="on" /><i /></span>
        <span class="tp-page"><b /><i /><i /><i class="short" /><em /></span>
      </span>
      <span class="theme-name">{choice === t.id ? '✓ ' : ''}{t.name}</span>
      <span class="theme-line">{t.line}</span>
    </button>
  );
  return (
    <>
      <h2>Colours</h2>
      <p class="hint">Changes the whole app on this device: sidebar, boards, the writing page and the panels beside it. Each device keeps its own choice.</p>
      <p class="buttons">
        <button type="button" class={choice === AUTO ? 'primary' : ''} aria-pressed={choice === AUTO} onClick={() => pick(AUTO)}>{choice === AUTO ? '✓ ' : ''}Match this device</button>
      </p>
      <p class="hint">Match this device uses Violet when the device is light and Violet Night when it is dark.</p>
      <h3 class="theme-group">Light</h3>
      <div class="theme-grid">{THEMES.filter((t) => t.mode === 'light').map(card)}</div>
      <h3 class="theme-group">Dark</h3>
      <div class="theme-grid">{THEMES.filter((t) => t.mode === 'dark').map(card)}</div>
    </>
  );
}

/** Room above the top bar for the iPad's clock bar, on this device: the app's own judgement, or set by hand (Kyle, 2026-10-22). */
function TopOfScreen() {
  const [choice, setChoice] = useState<TopRoom>(loadTopRoom);
  const pick = (c: TopRoom) => { saveTopRoom(c); setChoice(c); };
  const button = (c: TopRoom, label: string) => (
    <button type="button" class={choice === c ? 'primary' : ''} aria-pressed={choice === c} onClick={() => pick(c)}>{choice === c ? '✓ ' : ''}{label}</button>
  );
  const now = document.documentElement.classList.contains('ios-app');
  return (
    <>
      <h2>Top of the screen</h2>
      <p class="hint">On the iPad the clock and battery sit over the top of the app. If the buttons at the top are cut off, pick Leave room. If there is an empty strip above them, pick No room. Each device keeps its own choice.</p>
      <p class="buttons">
        {button('auto', 'Let the app decide')}
        {button('room', 'Leave room for the clock')}
        {button('none', 'No room')}
      </p>
      <p class="hint">{now ? 'Room is kept for the clock now.' : 'No room is kept now.'} Window {window.innerWidth} × {window.innerHeight}, screen {screen.width} × {screen.height}.</p>
    </>
  );
}
