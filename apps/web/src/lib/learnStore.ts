import { compactLearnBook, emptyLearnBook, learnBookToStored, sanitizeLearnBook, type AnkiCollection, type LearnBook } from '@brett-und-blatt/engine';
import { passSyncSoon } from './playerPass';

/*
 * Lernstand der eigenen Sammlung (#101, L5): ein Lernbuch im Speicher des Geräts und im Pass-Block `lernen`. Importierte Anki-Pakete
 * führen ihren Lernstand selbst (IndexedDB, siehe `ankiStore.ts`).
 */

export const LEARN_KEY = 'brett-und-blatt:lernen';

/** Mitternacht dieses Tages nach der Uhr des Geräts (Sekunden): der Tag 0 für neue Lernbücher. */
export function localMidnight(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export function loadLearnBook(): LearnBook {
  try {
    const book = sanitizeLearnBook(JSON.parse(window.localStorage.getItem(LEARN_KEY) ?? 'null'));
    return book.crt > 0 ? book : { ...book, crt: localMidnight() };
  } catch {
    return emptyLearnBook(localMidnight());
  }
}

export function saveLearnBook(book: LearnBook, col?: AnkiCollection): void {
  try {
    window.localStorage.setItem(LEARN_KEY, JSON.stringify(learnBookToStored(compactLearnBook(book, Date.now(), col))));
  } catch {
    // ohne Speicher gilt der Lernstand nur bis zum Neuladen
  }
  passSyncSoon();
}
