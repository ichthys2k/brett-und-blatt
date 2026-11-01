import { DRACHENSPIEL_SALT, scheduleSync, type SyncBlock } from '@brett-und-blatt/ui/sync';
import { useSyncExternalStore } from 'react';
import { DECK_CODE_MAX, decodeDeck } from '../deckcode';
import { syncServerUrl } from '../server';

/** Eigene Decks auf diesem Gerät, über die gemeinsame Sicherung auch auf anderen (W-050). */
const KEY = 'brett-und-blatt:drachenspiel:decks';
/** Hält den Block klar unter der Grenze von 64 KB, auch verschlüsselt und als Base64. */
export const MAX_DECKS = 80;
const MAX_TOMBSTONES = 200;

export interface SavedDeck {
  id: string;
  name: string;
  code: string;
  updatedAt: number;
  /** Löschvermerk: Ein anderes Gerät bringt das Deck so nicht zurück. */
  deleted?: boolean;
}

export interface DeckStore {
  decks: Record<string, SavedDeck>;
}

/** Macht aus fremden Daten einen gültigen Stand und begrenzt die Menge. */
export function sanitizeDecks(value: unknown): DeckStore {
  const raw = (value as { decks?: unknown } | null)?.decks;
  const decks: SavedDeck[] = [];
  if (raw && typeof raw === 'object') {
    for (const [id, entry] of Object.entries(raw as Record<string, Partial<SavedDeck>>)) {
      if (!/^[a-z0-9]{1,24}$/.test(id) || typeof entry?.updatedAt !== 'number') continue;
      if (entry.deleted) decks.push({ id, name: '', code: '', updatedAt: entry.updatedAt, deleted: true });
      else if (typeof entry.code === 'string' && entry.code.length <= DECK_CODE_MAX && decodeDeck(entry.code)) {
        decks.push({ id, name: typeof entry.name === 'string' ? entry.name.slice(0, 30) : 'Mein Deck', code: entry.code, updatedAt: entry.updatedAt });
      }
    }
  }
  decks.sort((a, b) => b.updatedAt - a.updatedAt);
  const kept = [...decks.filter((d) => !d.deleted).slice(0, MAX_DECKS), ...decks.filter((d) => d.deleted).slice(0, MAX_TOMBSTONES)];
  return { decks: Object.fromEntries(kept.map((d) => [d.id, d])) };
}

/** Je Kennung gewinnt die jüngste Änderung; auch ein Löschvermerk zählt als Änderung. */
export function mergeDecks(a: DeckStore, b: DeckStore): DeckStore {
  const merged: Record<string, SavedDeck> = { ...a.decks };
  for (const [id, deck] of Object.entries(b.decks)) {
    const known = merged[id];
    if (!known || deck.updatedAt > known.updatedAt) merged[id] = deck;
  }
  return sanitizeDecks({ decks: merged });
}

const stable = (store: DeckStore) => JSON.stringify(Object.keys(store.decks).sort().map((id) => store.decks[id]));

function load(): DeckStore {
  try {
    return sanitizeDecks(JSON.parse(window.localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return { decks: {} };
  }
}

let store = load();
const listeners = new Set<() => void>();

function replace(next: DeckStore): void {
  store = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Ohne Speicher gelten die Decks bis zum Neuladen.
  }
  for (const listener of listeners) listener();
}

export const decksBlock: SyncBlock<DeckStore> = {
  salt: DRACHENSPIEL_SALT,
  field: 'decks',
  serverUrl: syncServerUrl,
  read: () => store,
  sanitize: sanitizeDecks,
  merge: mergeDecks,
  write: replace,
  same: (a, b) => stable(a) === stable(b),
};

export function useDecks(): SavedDeck[] {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => store,
    () => store,
  );
  return Object.values(current.decks)
    .filter((deck) => !deck.deleted)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveDeck(deck: { id?: string; name: string; code: string }): string {
  const id = deck.id ?? `${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 4).toString(36)}`;
  replace(sanitizeDecks({ decks: { ...store.decks, [id]: { id, name: deck.name.trim().slice(0, 30) || 'Mein Deck', code: deck.code, updatedAt: Date.now() } } }));
  scheduleSync(decksBlock);
  return id;
}

export function deleteDeck(id: string): void {
  replace(sanitizeDecks({ decks: { ...store.decks, [id]: { id, name: '', code: '', updatedAt: Date.now(), deleted: true } } }));
  scheduleSync(decksBlock);
}
