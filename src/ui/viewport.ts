// The writing screens fill the screen and scroll only inside. On the iPad, dragging a text selection to the bottom edge
// (or the keyboard opening) used to scroll the whole document instead, pushing the top bar off screen and leaving the
// bottom blank (Kyle's screenshot, 2026-10-20). While a writing screen is open the document is locked in place and the
// screen takes the height the device can show, which shrinks above an on-screen keyboard.
// With a hardware keyboard the iPad shows only its small shortcut bar, floating in the middle of the bottom edge. The
// screen then keeps its full height so the Previous and Next arrows stay at the very bottom, left and right of that bar
// (Kyle, 2026-10-21), and --kb-gap tells the page to keep the typing line above it.
import { useEffect } from 'preact/hooks';

/** Shorter than this, the space the device takes is the shortcut bar, not a whole keyboard. */
const SHORTCUT_BAR = 150;

export function useLockedPage(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    root.classList.add('page-locked');
    let full = 0;
    let width = 0;
    const fit = () => {
      const seen = vv ? vv.height : window.innerHeight;
      const w = vv ? vv.width : window.innerWidth;
      // The full height for this width: a turn or a new split size starts again.
      if (w !== width) { width = w; full = 0; }
      full = Math.max(full, seen, root.clientHeight);
      const gap = full - seen;
      const bar = gap > 0 && gap < SHORTCUT_BAR;
      const height = Math.round(bar ? full : seen) + 'px', kbGap = Math.round(bar ? gap : 0) + 'px';
      if (root.style.getPropertyValue('--app-height') !== height) root.style.setProperty('--app-height', height);
      if (root.style.getPropertyValue('--kb-gap') !== kbGap) root.style.setProperty('--kb-gap', kbGap);
      if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
    };
    // The iPad does not always say when its keyboard goes away: switching to a Bluetooth keyboard left the screen at the
    // old keyboard's height (Kyle's screenshot, 2026-10-22). So each event looks again a little later, and a quiet check
    // every second catches what no event reports.
    let later: ReturnType<typeof setTimeout>[] = [];
    const check = () => {
      fit();
      later.forEach(clearTimeout);
      later = [150, 500, 1200].map((ms) => setTimeout(fit, ms));
    };
    fit();
    const every = setInterval(fit, 1000);
    if (vv) { vv.addEventListener('resize', check); vv.addEventListener('scroll', check); }
    window.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    return () => {
      clearInterval(every);
      later.forEach(clearTimeout);
      if (vv) { vv.removeEventListener('resize', check); vv.removeEventListener('scroll', check); }
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
      root.classList.remove('page-locked');
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--kb-gap');
    };
  }, []);
}
