import { useSyncExternalStore } from 'react';

/**
 * Einfache Navigation über den Teil hinter dem # in der Adresse. So funktioniert
 * die App auf jedem einfachen Webspace, ohne Einstellungen am Server.
 */
export type Route =
  | { name: 'home'; filter?: string; players?: number }
  | { name: 'setup'; gameId: string; params?: Record<string, string> }
  | { name: 'play' }
  | { name: 'online' }
  | { name: 'room'; code: string }
  | { name: 'sound' }
  | { name: 'imprint' }
  | { name: 'privacy' };

function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!query) return out;
  const search = new URLSearchParams(query);
  for (const [k, v] of search.entries()) {
    out[k] = v;
  }
  return out;
}

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const qIndex = raw.indexOf('?');
  const pathPart = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const queryPart = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
  const parts = pathPart.split('/').filter(Boolean);
  const params = parseQuery(queryPart);

  if (parts[0] === 'neu' && parts[1]) {
    return {
      name: 'setup',
      gameId: decodeURIComponent(parts[1]),
      ...(Object.keys(params).length > 0 ? { params } : {}),
    };
  }
  if (parts[0] === 'partie') return { name: 'play' };
  if (parts[0] === 'online') return { name: 'online' };
  if (parts[0] === 'raum' && parts[1]) return { name: 'room', code: decodeURIComponent(parts[1]) };
  if (parts[0] === 'ton') return { name: 'sound' };
  if (parts[0] === 'impressum') return { name: 'imprint' };
  if (parts[0] === 'datenschutz') return { name: 'privacy' };
  const players = Number(params.spieler);
  return {
    name: 'home',
    ...(params.filter ? { filter: params.filter } : {}),
    ...(Number.isInteger(players) && players > 0 ? { players } : {}),
  };
}

export const paths = {
  home: '#/',
  setup: (gameId: string, params?: Record<string, string>) => {
    const base = `#/neu/${encodeURIComponent(gameId)}`;
    if (!params || Object.keys(params).length === 0) return base;
    return `${base}?${new URLSearchParams(params).toString()}`;
  },
  play: '#/partie',
  online: '#/online',
  room: (code: string) => `#/raum/${encodeURIComponent(code)}`,
  sound: '#/ton',
  imprint: '#/impressum',
  privacy: '#/datenschutz',
};

export function navigate(path: string): void {
  if (window.location.hash !== path) window.location.hash = path;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseRoute(hash);
}
