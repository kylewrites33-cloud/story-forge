// Small line icons drawn inline, so the app needs no icon font or image files. They take the text colour.

const PATHS: Record<string, string> = {
  books: 'M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.5-1 3 15-3.5 1z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  idea: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z',
  juice: 'M7 3h10l-1 5a5 5 0 0 1-8 0zM12 13v7M8 21h8',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7.5M18 15c2.5.6 4 2.6 4 6',
  conflict: 'M4 4l16 16M20 4L4 20M4 4h4M4 4v4M20 4h-4M20 4v4',
  beats: 'M4 19h16M6 16v-5M10 16V7M14 16v-7M18 16V5',
  market: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  todo: 'M4 5h3v3H4zM4 11h3v3H4zM4 17h3v3H4zM10 6.5h10M10 12.5h10M10 18.5h10',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  check: 'M5 12.5l4.5 4.5L19 7',
  sync: 'M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  panel: 'M4 4h16v16H4zM15 4v16',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  split: 'M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4',
  join: 'M4 7h7v10H4M20 7h-7v10h7',
  move: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  pen: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  plus: 'M12 5v14M5 12h14',
  shelf: 'M3 20h18M5 20V8h3v12M10 20V5h3v15M15.5 20l-1-11 3-.4 1 11.4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  focus: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  type: 'M4 7V5h16v2M12 5v14M9 19h6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01',
  outline: 'M4 6h.01M8 6h12M7 12h.01M11 12h9M7 18h.01M11 18h9',
  cards: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  demo: 'M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5'
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const d = PATHS[name];
  if (!d) return null;
  // Dots (move, more) draw as round line ends, so they need a thicker line.
  const dots = name === 'move' || name === 'more';
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"
      stroke-width={dots ? 3.2 : 1.8} stroke-linecap="round" stroke-linejoin="round">
      <path d={d} />
    </svg>
  );
}
