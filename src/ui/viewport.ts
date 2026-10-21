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
      root.style.setProperty('--app-height', Math.round(bar ? full : seen) + 'px');
      root.style.setProperty('--kb-gap', Math.round(bar ? gap : 0) + 'px');
      if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
    };
    fit();
    if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
    window.addEventListener('scroll', fit);
    return () => {
      if (vv) { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); }
      window.removeEventListener('scroll', fit);
      root.classList.remove('page-locked');
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--kb-gap');
    };
  }, []);
}
