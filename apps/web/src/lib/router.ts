import { useSyncExternalStore } from 'react';

/**
 * Einfache Navigation über den Teil hinter dem # in der Adresse. So funktioniert
 * die App auf jedem einfachen Webspace, ohne Einstellungen am Server.
 */
export type Route = { name: 'home' } | { name: 'setup'; gameId: string } | { name: 'play' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'neu' && parts[1]) return { name: 'setup', gameId: decodeURIComponent(parts[1]) };
  if (parts[0] === 'partie') return { name: 'play' };
  return { name: 'home' };
}

export const paths = {
  home: '#/',
  setup: (gameId: string) => `#/neu/${encodeURIComponent(gameId)}`,
  play: '#/partie',
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
