// Names on a long press. On a touch screen a button's name (its title) never shows, because there is no pointer to
// rest on it, and the writing bar is mostly icons (Kyle, 2026-10-20: the iPad is the main device). Holding a finger on
// any button with a name shows the name in a small bubble; letting go does not press the button. A mouse is untouched.
const HOLD_MS = 450;
const SHOW_MS = 2500;

export function startHoldNames(doc: Document = document): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hide: ReturnType<typeof setTimeout> | null = null;
  let tip: HTMLElement | null = null;
  let start: { x: number; y: number } | null = null;
  let swallowUntil = 0;

  const clear = () => { if (timer) clearTimeout(timer); timer = null; start = null; };
  const remove = () => { if (hide) clearTimeout(hide); hide = null; if (tip) tip.remove(); tip = null; };

  const show = (el: Element, name: string) => {
    remove();
    tip = doc.createElement('div');
    tip.className = 'hold-tip';
    tip.setAttribute('role', 'tooltip');
    tip.textContent = name;
    doc.body.appendChild(tip);
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const vw = doc.documentElement.clientWidth;
    const left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2));
    const top = r.bottom + 8 + h < window.innerHeight ? r.bottom + 8 : Math.max(8, r.top - h - 8);
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    hide = setTimeout(remove, SHOW_MS);
  };

  doc.addEventListener('pointerdown', (e) => {
    remove();
    clear();
    if (e.pointerType === 'mouse') return;
    const el = (e.target as Element | null)?.closest?.('button[title], a[title], [role="button"][title]');
    const name = el && el.getAttribute('title');
    // A button that does its own thing on a hold (the Pomodoro timer) is left to it.
    if (!el || !name || el.closest('[data-own-hold]')) return;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => { timer = null; swallowUntil = Date.now() + 800; show(el, name); }, HOLD_MS);
  }, { passive: true });
  doc.addEventListener('pointermove', (e) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) clear();
  }, { passive: true });
  doc.addEventListener('pointerup', clear, { passive: true });
  doc.addEventListener('pointercancel', clear, { passive: true });
  // The finger lifting after a long press is not a press of the button.
  doc.addEventListener('click', (e) => {
    if (Date.now() < swallowUntil) { swallowUntil = 0; e.preventDefault(); e.stopPropagation(); }
  }, true);
  doc.addEventListener('contextmenu', (e) => { if (Date.now() < swallowUntil) e.preventDefault(); });
}
