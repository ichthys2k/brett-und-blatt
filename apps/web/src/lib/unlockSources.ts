import { loadLearnBook } from './learnStore';

/*
 * Die zwei Quellen für den Freischalt-Baustein (`unlocks.ts`), die nicht im Partiebuch stehen: die Lerntage im Karteikasten
 * und der Atelier-Stand des Narrenhofs. Jede Quelle ist eine Funktion, nie ein Stück Regel (#569).
 */

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    // ignorieren
  }
  return null;
}

/** Tage mit Lernsitzung im Karteikasten des aktiven Passes. */
export function loadLearnDays(): number {
  try {
    return loadLearnBook().days.length;
  } catch {
    return 0;
  }
}

/** Hat der Pass im Atelier des Narrenhofs Narren freigeschaltet oder gesammelt (Zählerbuch)? */
export function loadJesterAtelier(): boolean {
  try {
    const store = getStorage();
    const raw = store ? store.getItem('brett-und-blatt:farbensortierer') : null;
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed?.unlocked) && parsed.unlocked.length > 0) || (Array.isArray(parsed?.ledger) && parsed.ledger.length > 0);
  } catch {
    return false;
  }
}
