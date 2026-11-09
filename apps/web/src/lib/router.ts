import { useSyncExternalStore } from 'react';

/**
 * Einfache Navigation über den Teil hinter dem # in der Adresse. So funktioniert
 * die App auf jedem einfachen Webspace, ohne Einstellungen am Server.
 */
export type Route =
  | { name: 'menu' }
  | { name: 'home'; filter?: string; players?: number }
  | { name: 'setup'; gameId: string; params?: Record<string, string> }
  | { name: 'play' }
  | { name: 'online' }
  | { name: 'tournaments' }
  | { name: 'classes' }
  | { name: 'library' }
  | { name: 'packView'; key: string }
  | { name: 'class'; code: string }
  | { name: 'room'; code: string }
  | { name: 'display'; code: string }
  | { name: 'tournament'; code: string; claim?: string; helper?: string }
  /** Schlichte Ansicht zum Einbetten (iframe): nur lesen, nur Turniere vor Ort mit Zuschaulink. */
  | { name: 'tournamentEmbed'; code: string }
  | { name: 'sound' }
  | { name: 'pass' }
  | { name: 'passView'; key: string }
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
  if (parts[0] === 'online' || parts[0] === 'mehrspieler') return { name: 'online' };
  if (parts[0] === 'turniere') return { name: 'tournaments' };
  if (parts[0] === 'klassen') return { name: 'classes' };
  if (parts[0] === 'bibliothek') return { name: 'library' };
  if (parts[0] === 'paket') return { name: 'packView', key: params.k ?? '' };
  if (parts[0] === 'klasse' && parts[1]) return { name: 'class', code: decodeURIComponent(parts[1]) };
  if (parts[0] === 'raum' && parts[1]) return { name: 'room', code: decodeURIComponent(parts[1]) };
  if (parts[0] === 'tisch' && parts[1]) return { name: 'display', code: decodeURIComponent(parts[1]) };
  if (parts[0] === 'turnier' && parts[1] && parts[2] === 'ansicht') return { name: 'tournamentEmbed', code: decodeURIComponent(parts[1]) };
  if (parts[0] === 'turnier' && parts[1]) return { name: 'tournament', code: decodeURIComponent(parts[1]), ...(params.neu ? { claim: params.neu } : {}), ...(params.helfer ? { helper: params.helfer } : {}) };
  if (parts[0] === 'ton') return { name: 'sound' };
  if (parts[0] === 'pass' && parts[1] === 'ansehen') return { name: 'passView', key: params.k ?? '' };
  if (parts[0] === 'pass') return { name: 'pass' };
  if (parts[0] === 'einzelspieler') {
    const count = Number(params.spieler);
    return { name: 'home', ...(params.filter ? { filter: params.filter } : {}), ...(Number.isInteger(count) && count > 0 ? { players: count } : {}) };
  }
  if (parts[0] === 'impressum') return { name: 'imprint' };
  if (parts[0] === 'datenschutz') return { name: 'privacy' };
  const players = Number(params.spieler);
  // Alte Links wie #/?filter=mathe oder #/?spieler=8 zeigen weiter die Spielübersicht.
  if (!params.filter && !(Number.isInteger(players) && players > 0)) return { name: 'menu' };
  return {
    name: 'home',
    ...(params.filter ? { filter: params.filter } : {}),
    ...(Number.isInteger(players) && players > 0 ? { players } : {}),
  };
}

export const paths = {
  /** Hauptmenü (#184). */
  menu: '#/',
  /** Spielübersicht („Lokales Spiel“). */
  home: '#/einzelspieler',
  setup: (gameId: string, params?: Record<string, string>) => {
    const base = `#/neu/${encodeURIComponent(gameId)}`;
    if (!params || Object.keys(params).length === 0) return base;
    return `${base}?${new URLSearchParams(params).toString()}`;
  },
  play: '#/partie',
  online: '#/online',
  tournaments: '#/turniere',
  classes: '#/klassen',
  library: '#/bibliothek',
  class: (code: string) => `#/klasse/${encodeURIComponent(code)}`,
  room: (code: string) => `#/raum/${encodeURIComponent(code)}`,
  /** Tisch-Bildschirm für Fernseher, Beamer oder Tablet (#100). */
  display: (code: string) => `#/tisch/${encodeURIComponent(code)}`,
  tournament: (code: string) => `#/turnier/${encodeURIComponent(code)}`,
  tournamentEmbed: (code: string) => `#/turnier/${encodeURIComponent(code)}/ansicht`,
  sound: '#/ton',
  pass: '#/pass',
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
