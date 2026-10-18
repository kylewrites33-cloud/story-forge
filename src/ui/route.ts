import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'home' }
  | { name: 'books' }
  | { name: 'series'; folder: string }
  | { name: 'book'; folder: string }
  | { name: 'ideas'; folder: string }
  | { name: 'board'; board: string; folder: string }
  | { name: 'note'; path: string }
  | { name: 'write'; path: string }
  | { name: 'chapter'; path: string }
  /** The chapter of this scene, by its beats. */
  | { name: 'beats'; path: string }
  | { name: 'todo' }
  | { name: 'jobs' }
  /** thread '' is the list of conversations, 'new' a conversation not started yet; book is the book it is for. */
  | { name: 'chat'; thread: string; book: string }
  | { name: 'settings' }
  /** The AI team (slug '' is the whole team), its skills (name '' is every skill), and what it has done (who '' is everyone). */
  | { name: 'team'; slug: string }
  | { name: 'skills'; skill: string }
  | { name: 'history'; who: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [head, ...rest] = h.split('/');
  const tail = decodeURIComponent(rest.join('/'));
  if (head === 'books') return { name: 'books' };
  if (head === 'series') return { name: 'series', folder: tail };
  if (head === 'book' && tail) return { name: 'book', folder: tail };
  if (head === 'ideas' && tail) return { name: 'ideas', folder: tail };
  if (head === 'board' && rest.length > 1) return { name: 'board', board: rest[0], folder: decodeURIComponent(rest.slice(1).join('/')) };
  if (head === 'note' && tail) return { name: 'note', path: tail };
  if (head === 'write' && tail) return { name: 'write', path: tail };
  if (head === 'chapter' && tail) return { name: 'chapter', path: tail };
  if (head === 'beats' && tail) return { name: 'beats', path: tail };
  if (head === 'settings') return { name: 'settings' };
  if (head === 'team') return { name: 'team', slug: tail };
  if (head === 'skills') return { name: 'skills', skill: tail };
  if (head === 'history') return { name: 'history', who: tail };
  if (head === 'todo') return { name: 'todo' };
  if (head === 'jobs') return { name: 'jobs' };
  if (head === 'chat') return { name: 'chat', thread: decodeURIComponent(rest[0] || ''), book: decodeURIComponent(rest.slice(1).join('/')) };
  return { name: 'home' };
}

export const href = {
  books: () => '#/books',
  home: () => '#/',
  allSeries: () => '#/series',
  series: (folder: string) => '#/series/' + encodeURIComponent(folder),
  book: (folder: string) => '#/book/' + encodeURIComponent(folder),
  ideas: (folder: string) => '#/ideas/' + encodeURIComponent(folder),
  board: (board: string, folder: string) => '#/board/' + board + '/' + encodeURIComponent(folder),
  note: (path: string) => '#/note/' + encodeURIComponent(path),
  write: (path: string) => '#/write/' + encodeURIComponent(path),
  chapter: (path: string) => '#/chapter/' + encodeURIComponent(path),
  beats: (path: string) => '#/beats/' + encodeURIComponent(path),
  todo: () => '#/todo',
  jobs: () => '#/jobs',
  chat: (thread = '', book = '') => '#/chat' + (thread ? '/' + encodeURIComponent(thread) + (book ? '/' + encodeURIComponent(book) : '') : ''),
  settings: () => '#/settings',
  team: (slug = '') => '#/team' + (slug ? '/' + encodeURIComponent(slug) : ''),
  skills: (skill = '') => '#/skills' + (skill ? '/' + encodeURIComponent(skill) : ''),
  history: (who = '') => '#/history' + (who ? '/' + encodeURIComponent(who) : '')
};

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
