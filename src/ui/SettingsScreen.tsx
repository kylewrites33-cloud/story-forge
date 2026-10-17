import { useState } from 'preact/hooks';
import { GitHubSource } from '../lib/github.ts';
import { normalise, type Settings } from '../lib/settings.ts';

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
      <h2>Forget</h2>
      <p>Removes the token and the saved copy of the vault from this browser.</p>
      <p class="buttons">
        <button type="button" onClick={() => { setForm({ ...form, token: '' }); props.onForget(); setResult({ ok: true, text: 'Forgotten.' }); }}>Forget token</button>
      </p>
    </section>
  );
}
