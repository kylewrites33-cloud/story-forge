// The way back. While features move onto the one saving system one at a time (2026-11-11), each device can be set to
// send what waits in the outbox the old way, one note at a time. It is read at every save, so it works at once.
// It goes when the old saving code goes.
export const OLD_SAVING_KEY = 'sparrow.old-saving';

export function oldSaving(s: Storage | null = globalThis.localStorage ?? null): boolean {
  try { return Boolean(s && s.getItem(OLD_SAVING_KEY) === '1'); } catch { return false; }
}

export function setOldSaving(on: boolean, s: Storage | null = globalThis.localStorage ?? null): void {
  try {
    if (!s) return;
    if (on) s.setItem(OLD_SAVING_KEY, '1');
    else s.removeItem(OLD_SAVING_KEY);
  } catch { /* lasts until reload */ }
}
