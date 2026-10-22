// Room at the top of the iPad home-screen app. iPadOS lays its clock and battery bar over the app and reports no safe
// area for it (Kyle's screenshot, 2026-10-20); in split view or a window it puts its window button (•••) on the app's top
// left corner, again with no safe area (2026-10-22). Neither can be measured, so the app judges from the window's size.
// The judgement uses the tallest the window has been at this width, so the keyboard or its shortcut bar can never take
// the room away while Kyle types (Kyle's screenshot, 2026-10-22: the writing bar slid under the clock bar). When unsure,
// it keeps the room: a slightly taller top bar costs nothing, a bar under the clock hides Home and Team.
// Kyle can set it by hand per device in Settings, Top of the screen.

export type TopRoom = 'auto' | 'room' | 'none';

export const TOP_ROOM_KEY = 'sparrow.top-room';
/** Sent on window when Kyle changes the choice, so the app applies it at once. */
export const TOP_ROOM_EVENT = 'sparrow-top-room';

export interface WindowShape {
  /** An iPad or iPhone opened from the home screen. */
  app: boolean;
  /** The window's size now, and the tallest it has been at this width. */
  width: number;
  tallest: number;
  /** The screen's size the way it is turned now. */
  screenW: number;
  screenH: number;
}

/** Gaps bigger than this are a split, a window or Stage Manager, not the clock bar (24) or a rounding slip. */
const WINDOWED = 48;

/** Whether to keep room for the clock bar (`ios-app`) and for the window button (`ios-window`). */
export function topRoom(w: WindowShape, choice: TopRoom): { clockBar: boolean; windowButton: boolean } {
  const fullWidth = w.width >= w.screenW - 2;
  const fullHeight = w.tallest >= w.screenH - WINDOWED;
  const windowButton = w.app && (!fullWidth || !fullHeight);
  if (choice === 'room') return { clockBar: true, windowButton };
  if (choice === 'none') return { clockBar: false, windowButton };
  return { clockBar: w.app && fullWidth && fullHeight, windowButton };
}

export function cleanTopRoom(v: string | null): TopRoom {
  return v === 'room' || v === 'none' ? v : 'auto';
}

export function loadTopRoom(): TopRoom {
  try { return cleanTopRoom(localStorage.getItem(TOP_ROOM_KEY)); } catch { return 'auto'; }
}

export function saveTopRoom(c: TopRoom): void {
  try { localStorage.setItem(TOP_ROOM_KEY, c); } catch { /* lasts until reload */ }
  window.dispatchEvent(new Event(TOP_ROOM_EVENT));
}
