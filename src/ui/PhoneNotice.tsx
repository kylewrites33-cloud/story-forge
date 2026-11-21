// What Sparrow did with Kyle's choices from his phone (Sparrow Pocket, 2026-11-21; src/vault/phone.ts), in the style of
// the background-save notices: one line that stays until Kyle presses OK, kept on the device so it outlasts a reload,
// with each choice and, for one skipped, why.
import { useState } from 'preact/hooks';
import { readJson, writeJson, PREF } from '../lib/prefs.ts';
import { isApplied, reportLine, type PhoneResult } from '../vault/phone.ts';

export function loadPhoneReport(sourceKey: string): PhoneResult[] | null {
  const v = readJson(PREF.phoneReport + sourceKey);
  return Array.isArray(v) && v.length ? (v as PhoneResult[]) : null;
}

export function savePhoneReport(sourceKey: string, results: PhoneResult[] | null): void {
  writeJson(PREF.phoneReport + sourceKey, results && results.length ? results : null);
}

export function PhoneNotice({ results, onOk }: { results: PhoneResult[]; onOk: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="notice phone-notice">
      <p class="phone-notice-line">
        <span>{reportLine(results)}</span>
        <span class="phone-notice-buttons">
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide the list' : 'See each one'}</button>
          <button type="button" onClick={onOk}>OK</button>
        </span>
      </p>
      {open && (
        <ol class="phone-notice-list">
          {results.map((r) => (
            <li key={r.note + '#' + r.n} class={isApplied(r) ? 'applied' : 'skipped'}>
              <b>{r.what}</b>{r.chapter ? ' (chapter ' + r.chapter + ')' : ''}: {isApplied(r) ? (r.result === 'applied' ? 'applied.' : 'applied; it was already so.') : 'skipped. ' + r.result.replace(/^skipped\.\s*/, '')}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
