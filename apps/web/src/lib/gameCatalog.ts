import type { GameInfo } from '@brett-und-blatt/engine';
import { CATEGORIES, type CategoryId, type CategorySpec } from './rubriken';

/*
 * Spielkatalog ohne Oberfläche (#607, K2a): welche Spiele in welcher Rubrik stehen, was zur
 * Spielerzahl passt und was die Suche findet. Benutzt von der klassischen Spielübersicht
 * (`screens/Home.tsx`) und den Konsolen-Bildschirmen.
 */

export type FilterId = 'all' | CategoryId;

/** Reiter der Rubriken (Spielübersicht und Bibliothek der Konsole). */
export const FILTER_TABS: readonly { id: FilterId; icon: string; label: string }[] = [
  { id: 'all', icon: '🎲', label: 'Alle' },
  { id: 'board', icon: '♟️', label: 'Strategie & Brett' },
  { id: 'cards', icon: '🃏', label: 'Karten & Stich' },
  { id: 'family', icon: '🎲', label: 'Familie & Gesellschaft' },
  { id: 'math', icon: '📐', label: 'Mathe (Kl. 5/6)' },
];

/** Auswahl „Wie viele spielt ihr?“ – zeigt nur Spiele, deren Platzzahl die Anzahl zulässt. */
export const PLAYER_COUNTS: readonly number[] = [1, 2, 3, 4, 5, 6, 8, 10, 20, 30];
const PLAYER_COUNT_KEY = 'bub.home.players';

export interface GameGroup extends CategorySpec {
  games: GameInfo[];
}

/** Passt ein Spiel für so viele Spieler? (`null` = keine Auswahl, alles passt) */
export function fitsPlayers(info: GameInfo, count: number | null): boolean {
  return count === null || (info.players.min <= count && count <= info.players.max);
}

/** Liest den Anfangsfilter aus der Adresse: board, cards, family, math; `mathe` gilt als math; sonst all. */
export function parseFilter(initial: string | undefined): FilterId {
  if (initial === 'board' || initial === 'cards' || initial === 'family' || initial === 'math') return initial;
  if (initial === 'mathe') return 'math';
  return 'all';
}

/** Alle Rubriken in der Reihenfolge von CATEGORIES, je mit ihren Spielen (gefiltert nach Spielerzahl); nicht zugeordnete Spiele stehen am Ende von `family`. */
export function groupGames(all: readonly GameInfo[], players: number | null): GameGroup[] {
  const byId = new Map(all.map((g) => [g.id, g]));
  const assigned = new Set<string>();
  const groups = CATEGORIES.map((cat) => {
    const list: GameInfo[] = [];
    for (const id of cat.gameIds) {
      const g = byId.get(id);
      if (g) {
        list.push(g);
        assigned.add(id);
      }
    }
    return { ...cat, games: list.filter((g) => fitsPlayers(g, players)) };
  });
  // Falls weitere Spiele hinzukommen, die noch keiner Liste zugeordnet sind: in Familie einsortieren
  const unassigned = all.filter((g) => !assigned.has(g.id));
  if (unassigned.length > 0) {
    const fam = groups.find((g) => g.id === 'family');
    if (fam) fam.games.push(...unassigned.filter((g) => fitsPlayers(g, players)));
  }
  return groups;
}

/** Suche in Name, Beschreibung, id und Kurzanleitung; `null` bei leerer Anfrage. */
export function searchGames(all: readonly GameInfo[], query: string, players: number | null): GameInfo[] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return all.filter((game) => {
    if (!fitsPlayers(game, players)) return false;
    if (game.name.toLowerCase().includes(q)) return true;
    if (game.description.toLowerCase().includes(q)) return true;
    if (game.id.toLowerCase().includes(q)) return true;
    if (game.howToPlay.some((rule) => rule.toLowerCase().includes(q))) return true;
    return false;
  });
}

/** Die Rubriken, die bei diesem Filter zu sehen sind; mit Spielerzahl-Auswahl ohne leere Rubriken. */
export function visibleGroups(groups: readonly GameGroup[], filter: FilterId, players: number | null): GameGroup[] {
  const shown = filter === 'all' ? [...groups] : groups.filter((g) => g.id === filter);
  return players === null ? shown : shown.filter((g) => g.games.length > 0);
}

/** Gemerkte Spielerzahl dieser Sitzung (sessionStorage `bub.home.players`). */
export function loadPlayerCount(): number | null {
  try {
    const value = Number(sessionStorage.getItem(PLAYER_COUNT_KEY));
    return PLAYER_COUNTS.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function savePlayerCount(count: number | null): void {
  try {
    if (count === null) sessionStorage.removeItem(PLAYER_COUNT_KEY);
    else sessionStorage.setItem(PLAYER_COUNT_KEY, String(count));
  } catch {
    // Ohne Speicher gilt die Auswahl nur bis zum Neuladen.
  }
}

/** Die Spiele der Bibliothek in Anzeige-Reihenfolge: bei Suche die Treffer; sonst die sichtbaren Rubriken hintereinander, Lieblingsspiele zuerst (in der Reihenfolge von `favorites`), ohne Doppelte (#616). */
export function libraryGames(input: { all: readonly GameInfo[]; favorites: readonly string[]; filter: FilterId; players: number | null; query: string }): GameInfo[] {
  const { all, favorites, filter, players, query } = input;
  const found = searchGames(all, query, players);
  if (found !== null) return found;
  const list = visibleGroups(groupGames(all, players), filter, players).flatMap((group) => group.games);
  const shown = new Set(list.map((g) => g.id));
  const favs = favorites.flatMap((id) => (shown.has(id) ? list.filter((g) => g.id === id) : []));
  const favIds = new Set(favs.map((g) => g.id));
  return [...favs, ...list.filter((g) => !favIds.has(g.id))];
}
