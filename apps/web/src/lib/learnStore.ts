import { applyGameResults, compactLearnBook, emptyLearnBook, learnBookToStored, sanitizeLearnBook, type AnkiCollection, type GameResult, type LearnBook } from '@brett-und-blatt/engine';
import { loadCollection } from './library';
import { passSyncSoon } from './playerPass';

/*
 * Lernstand der eigenen Sammlung (#101, L5): ein Lernbuch im Speicher des Geräts und im Pass-Block `lernen`. Importierte Anki-Pakete
 * führen ihren Lernstand selbst (IndexedDB, siehe `ankiStore.ts`).
 */

import { LEARN_KEY } from '@brett-und-blatt/ui';

export { LEARN_KEY };

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

/** Trägt das Ergebnis einer Partie als Wiederholungen ein (Lernen beim Spielen, #223). Liefert, wie viele Karten gezählt wurden. */
export function recordGameLearning(results: readonly GameResult[], now = Date.now()): number {
  if (results.length === 0) return 0;
  const col = loadCollection();
  const { book, applied } = applyGameResults(col, loadLearnBook(), results, now);
  if (applied > 0) saveLearnBook(book, col);
  return applied;
}
