import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'home' }
  | { name: 'books' }
  | { name: 'book'; folder: string }
  | { name: 'note'; path: string }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [head, ...rest] = h.split('/');
  const tail = decodeURIComponent(rest.join('/'));
  if (head === 'books') return { name: 'books' };
  if (head === 'book' && tail) return { name: 'book', folder: tail };
  if (head === 'note' && tail) return { name: 'note', path: tail };
  if (head === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

export const href = {
  books: () => '#/books',
  book: (folder: string) => '#/book/' + encodeURIComponent(folder),
  note: (path: string) => '#/note/' + encodeURIComponent(path),
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
