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
  | { name: 'todo' }
  | { name: 'jobs' }
  | { name: 'settings' };

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
  if (head === 'settings') return { name: 'settings' };
  if (head === 'todo') return { name: 'todo' };
  if (head === 'jobs') return { name: 'jobs' };
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
  todo: () => '#/todo',
  jobs: () => '#/jobs',
  settings: () => '#/settings'
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
