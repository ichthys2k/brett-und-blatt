import { paths } from '../lib/router';

/*
 * Reiter der Konsolen-Oberfläche (#607, K3b): Start, Bibliothek, Online, Optionen. Rein, damit
 * Zuordnung und Nachbarn ohne DOM testbar sind.
 */

export type ConsoleTab = 'start' | 'library' | 'online' | 'options';

export const CONSOLE_TABS: readonly { id: ConsoleTab; labelKey: string; icon: string; path: string }[] = [
  { id: 'start', labelKey: 'console.tab.start', icon: '🏠', path: paths.menu },
  { id: 'library', labelKey: 'console.tab.library', icon: '🎲', path: paths.home },
  { id: 'online', labelKey: 'console.tab.online', icon: '🌐', path: paths.online },
  { id: 'options', labelKey: 'console.tab.options', icon: '⚙️', path: paths.sound },
];

/** Der Reiter, der zu einer Route gehört: menu → start; home, setup → library; online, room, board → online; sound → options; sonst null. */
export function tabForRoute(routeName: string): ConsoleTab | null {
  switch (routeName) {
    case 'menu':
      return 'start';
    case 'home':
    case 'setup':
      return 'library';
    case 'online':
    case 'room':
    case 'board':
      return 'online';
    case 'sound':
      return 'options';
    default:
      return null;
  }
}

/** Der Nachbar-Reiter (delta −1 oder +1), ohne Umlauf; von `null` aus: start. */
export function neighborTab(current: ConsoleTab | null, delta: -1 | 1): ConsoleTab {
  if (current === null) return 'start';
  const index = CONSOLE_TABS.findIndex((tab) => tab.id === current);
  const next = Math.min(CONSOLE_TABS.length - 1, Math.max(0, index + delta));
  return CONSOLE_TABS[next]!.id;
}
