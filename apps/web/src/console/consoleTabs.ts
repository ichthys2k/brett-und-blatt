import { paths } from '../lib/router';

/*
 * Navigationsplan der Konsole (#638, U3): fünf Hauptreiter mit Unterreitern; jede Route hat genau einen Platz
 * oder steht ausdrücklich ohne Rahmen da. Rein, damit Zuordnung und Nachbarn ohne DOM testbar sind.
 */

export type ConsoleTab = 'start' | 'library' | 'online' | 'pass' | 'options';

export interface ConsoleSubTab {
  id: string;
  labelKey: string;
  path: string;
  /** Routen (`Route['name']`), die zu diesem Unterreiter gehören. */
  routes: readonly string[];
}

export interface ConsoleTabEntry {
  id: ConsoleTab;
  labelKey: string;
  icon: string;
  path: string;
  /** Unterreiter; leer, wenn der Hauptreiter keine hat. */
  sub: readonly ConsoleSubTab[];
  /** Routen ohne Unterreiter, die zu diesem Hauptreiter gehören. */
  routes: readonly string[];
}

export const CONSOLE_TABS: readonly ConsoleTabEntry[] = [
  { id: 'start', labelKey: 'console.tab.start', icon: '🏠', path: paths.menu, sub: [], routes: ['menu'] },
  {
    id: 'library',
    labelKey: 'console.tab.library',
    icon: '🎲',
    path: paths.home,
    sub: [
      { id: 'games', labelKey: 'console.sub.games', path: paths.home, routes: ['home', 'setup'] },
      { id: 'learn', labelKey: 'console.sub.learn', path: paths.learn, routes: ['learn', 'learning', 'library', 'collection', 'packView'] },
      { id: 'helpers', labelKey: 'console.sub.helpers', path: paths.helpers, routes: ['helpers'] },
    ],
    routes: [],
  },
  {
    id: 'online',
    labelKey: 'console.tab.online',
    icon: '🌐',
    path: paths.online,
    sub: [
      { id: 'play', labelKey: 'console.sub.play', path: paths.online, routes: ['online', 'room'] },
      { id: 'board', labelKey: 'console.sub.board', path: paths.board, routes: ['board'] },
      { id: 'tournaments', labelKey: 'console.sub.tournaments', path: paths.tournaments, routes: ['tournaments', 'tournament', 'series'] },
      { id: 'classes', labelKey: 'console.sub.classes', path: paths.classes, routes: ['classes', 'class'] },
      { id: 'orgs', labelKey: 'console.sub.orgs', path: paths.orgs, routes: ['orgs', 'org'] },
    ],
    routes: [],
  },
  {
    id: 'pass',
    labelKey: 'console.tab.pass',
    icon: '🪪',
    path: paths.pass,
    sub: [
      { id: 'pass', labelKey: 'console.sub.pass', path: paths.pass, routes: ['pass', 'passView'] },
      { id: 'account', labelKey: 'console.sub.account', path: paths.account, routes: ['account'] },
    ],
    routes: [],
  },
  { id: 'options', labelKey: 'console.tab.options', icon: '⚙️', path: paths.sound, sub: [], routes: ['sound', 'imprint', 'privacy', 'operator'] },
];

/** Routen, die bewusst ohne Konsolen-Rahmen erscheinen: die Partie, Bildschirme für Fernseher und Beamer, Einbettungen, die Schauseite. */
export const ROUTES_WITHOUT_PLACE: readonly string[] = ['play', 'display', 'tournamentBeamer', 'tournamentEmbed', 'seriesEmbed', 'gallery'];

/** Haupt- und Unterreiter einer Route; `null`, wenn die Route keinen Platz in der Navigation hat. */
export function placeForRoute(routeName: string): { tab: ConsoleTab; sub: string | null } | null {
  for (const tab of CONSOLE_TABS) {
    if (tab.routes.includes(routeName)) return { tab: tab.id, sub: null };
    const sub = tab.sub.find((entry) => entry.routes.includes(routeName));
    if (sub) return { tab: tab.id, sub: sub.id };
  }
  return null;
}

/** Der Hauptreiter einer Route oder `null`. */
export function tabForRoute(routeName: string): ConsoleTab | null {
  return placeForRoute(routeName)?.tab ?? null;
}

/** Der Nachbar-Reiter (delta −1 oder +1), ohne Umlauf; von `null` aus: start. */
export function neighborTab(current: ConsoleTab | null, delta: -1 | 1): ConsoleTab {
  if (current === null) return 'start';
  const index = CONSOLE_TABS.findIndex((tab) => tab.id === current);
  const next = Math.min(CONSOLE_TABS.length - 1, Math.max(0, index + delta));
  return CONSOLE_TABS[next]!.id;
}
