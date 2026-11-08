import { useCallback, useEffect, useState } from 'react';

/*
 * Lieblingsspiele (#111): Spiel-ids, die auf der Startseite mit einem Stern
 * markiert wurden, je Gerät in `localStorage`. Die Reihenfolge ist die des
 * Markierens – das zuletzt markierte Spiel steht hinten.
 */
export const FAVORITES_KEY = 'brett-und-blatt:lieblingsspiele';
const MAX_FAVORITES = 100;

/** Macht aus beliebigen Daten eine gültige Liste; alles Unbrauchbare fällt weg, Dubletten auch. */
export function sanitizeFavorites(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id));
  return [...new Set(ids)].slice(0, MAX_FAVORITES);
}

/** Liest eine gespeicherte Liste. */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return sanitizeFavorites(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Markiert ein Spiel oder nimmt die Markierung zurück. */
export function toggleFavorite(list: readonly string[], gameId: string): string[] {
  return list.includes(gameId) ? list.filter((id) => id !== gameId) : [...list, gameId].slice(-MAX_FAVORITES);
}

/** Die markierten Spiele in Markier-Reihenfolge, unbekannte ids (entfernte Spiele) fallen weg. */
export function pickFavorites<T extends { id: string }>(list: readonly string[], all: readonly T[]): T[] {
  const byId = new Map(all.map((item) => [item.id, item]));
  return list.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

function load(): string[] {
  try {
    return parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
  } catch {
    return [];
  }
}

/** Zeitpunkt der letzten Änderung (ms); der Pass nimmt bei zwei Geräten die jüngere Liste. */
const CHANGED_KEY = 'brett-und-blatt:lieblingsspiele:geaendert';

export interface FavoritesState {
  favorites: string[];
  changed: number;
}

export function readFavoritesState(): FavoritesState {
  try {
    const changed = Number(window.localStorage.getItem(CHANGED_KEY));
    return { favorites: load(), changed: Number.isFinite(changed) && changed > 0 ? changed : 0 };
  } catch {
    return { favorites: [], changed: 0 };
  }
}

/** Übernimmt einen Stand aus dem Pass und sagt offenen Tabs Bescheid. */
export function writeFavoritesState(state: FavoritesState): void {
  save(state.favorites, state.changed);
  window.dispatchEvent(new StorageEvent('storage', { key: FAVORITES_KEY }));
}

/** Wird nach jeder eigenen Änderung gerufen (Pass: Abgleich anstoßen). */
let onChange: () => void = () => undefined;
export function onFavoritesChanged(handler: () => void): void {
  onChange = handler;
}

function save(list: readonly string[], changed = Date.now()): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
    window.localStorage.setItem(CHANGED_KEY, String(changed));
  } catch {
    // Ohne Speicher gilt die Auswahl nur bis zum Neuladen.
  }
}

/** Lieblingsspiele mit Umschalter; folgt Änderungen aus anderen Tabs. */
export function useFavorites(): { favorites: string[]; toggle: (gameId: string) => void } {
  const [favorites, setFavorites] = useState<string[]>(load);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === FAVORITES_KEY || event.key === null) setFavorites(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((gameId: string) => {
    setFavorites((current) => {
      const next = toggleFavorite(current, gameId);
      save(next);
      onChange();
      return next;
    });
  }, []);

  return { favorites, toggle };
}
