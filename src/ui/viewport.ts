// The writing screens fill the screen and scroll only inside. On the iPad, dragging a text selection to the bottom edge
// (or the keyboard opening) used to scroll the whole document instead, pushing the top bar off screen and leaving the
// bottom blank (Kyle's screenshot, 2026-10-20). While a writing screen is open the document is locked in place and the
// screen takes the height the device can show, which shrinks above an on-screen keyboard.
import { useEffect } from 'preact/hooks';

export function useLockedPage(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    root.classList.add('page-locked');
    const fit = () => {
      root.style.setProperty('--app-height', Math.round(vv ? vv.height : window.innerHeight) + 'px');
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
    };
  }, []);
}
