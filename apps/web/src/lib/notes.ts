import { useCallback, useState } from 'react';

/*
 * Notizblock je Partie (#105): freier Text je Spielplatz, nur auf diesem Gerät in `localStorage`.
 * Nichts davon geht an den Server oder an Mitspieler. Alte Notizen verschwinden von selbst:
 * nach 30 Tagen ohne Änderung, und es bleiben höchstens 20 Partien.
 */
export const NOTES_KEY = 'brett-und-blatt:notizen';
export const NOTES_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const NOTES_MAX_GAMES = 20;
export const NOTE_MAX_LENGTH = 4000;

export interface GameNotes {
  /** Letzte Änderung (ms). */
  at: number;
  /** Text je Platzschlüssel (`ich` oder die Platznummer). */
  texts: Record<string, string>;
}

export type NotesStore = Record<string, GameNotes>;

/** Macht aus beliebigen Daten einen gültigen Speicher; alles Unbrauchbare fällt weg. */
export function sanitizeNotes(value: unknown, now: number): NotesStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries: [string, GameNotes][] = [];
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const { at, texts } = entry as { at?: unknown; texts?: unknown };
    if (typeof at !== 'number' || !Number.isFinite(at) || now - at > NOTES_MAX_AGE_MS) continue;
    if (!texts || typeof texts !== 'object' || Array.isArray(texts)) continue;
    const clean: Record<string, string> = {};
    for (const [seat, text] of Object.entries(texts as Record<string, unknown>)) {
      if (typeof text === 'string' && text.trim() !== '') clean[seat] = text.slice(0, NOTE_MAX_LENGTH);
    }
    if (Object.keys(clean).length > 0) entries.push([key, { at, texts: clean }]);
  }
  entries.sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(entries.slice(0, NOTES_MAX_GAMES));
}

/** Schlüssel einer Partie: Spiel und Partie-Kennung (lokal der Seed, online Raum und Runde). */
export const notesKey = (gameId: string, partieId: string) => `${gameId}:${partieId}`;

function load(now = Date.now()): NotesStore {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY);
    return sanitizeNotes(raw ? JSON.parse(raw) : null, now);
  } catch {
    return {};
  }
}

function save(store: NotesStore): void {
  try {
    if (Object.keys(store).length === 0) window.localStorage.removeItem(NOTES_KEY);
    else window.localStorage.setItem(NOTES_KEY, JSON.stringify(store));
  } catch {
    // Speicher voll oder gesperrt – dann gelten die Notizen nur, bis die Seite neu lädt.
  }
}

/** Setzt einen Text; ein leerer Text löscht die Notiz. Gibt den neuen Speicher zurück. */
export function withNote(store: NotesStore, key: string, seat: string, text: string, now: number): NotesStore {
  const current = store[key]?.texts ?? {};
  const texts = { ...current };
  if (text.trim() === '') delete texts[seat];
  else texts[seat] = text.slice(0, NOTE_MAX_LENGTH);
  const next = { ...store };
  if (Object.keys(texts).length === 0) delete next[key];
  else next[key] = { at: now, texts };
  return sanitizeNotes(next, now);
}

/** Text einer Partie und eines Platzes mit Setzer; Änderungen werden sofort gespeichert. */
export function useNote(key: string, seat: string): [string, (text: string) => void] {
  const [text, setText] = useState(() => load()[key]?.texts[seat] ?? '');
  // Beim Wechsel des Platzes (Hot-Seat) den Text dieses Platzes laden.
  const [shown, setShown] = useState(`${key}|${seat}`);
  if (shown !== `${key}|${seat}`) {
    setShown(`${key}|${seat}`);
    setText(load()[key]?.texts[seat] ?? '');
  }
  const update = useCallback(
    (next: string) => {
      setText(next);
      save(withNote(load(), key, seat, next, Date.now()));
    },
    [key, seat],
  );
  return [text, update];
}

/** Gibt es zu dieser Partie und diesem Platz schon eine Notiz? (für den Punkt am Knopf) */
export function hasNote(key: string, seat: string): boolean {
  return Boolean(load()[key]?.texts[seat]);
}
