import { onPassSyncRequest, registerPassBlock } from '@brett-und-blatt/ui/sync';
import { onFavoritesChanged } from './favorites';
import { passSyncSoon } from './playerPass';
import { applyItems, collectItems, mergeItems, sameItems, sanitizeItems, syncedNames, type Items } from './settingsBlock';

/*
 * Blöcke des Spielerpasses, die die Web-App selbst beisteuert (Vorhaben #135). Jeder Block meldet sich bei
 * `registerPassBlock` an; der Abgleich läuft über den Passschlüssel (`passSyncSoon`).
 */

/** Stand beim letzten Abgleich (zusammen mit dem Pass, siehe `SCOPED_KEYS` in `passes.ts`). */
const KNOWN_KEY = 'brett-und-blatt:einstellungen-staende';

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null): void => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Speicher gesperrt – dann gilt es nur bis zum Neuladen.
  }
};
const allKeys = (): string[] => {
  try {
    return Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)).filter((key): key is string => key !== null);
  } catch {
    return [];
  }
};
const loadKnown = (): Items => {
  try {
    return sanitizeItems({ items: JSON.parse(read(KNOWN_KEY) ?? 'null') });
  } catch {
    return {};
  }
};

let registered = false;

/** Meldet die Blöcke der Web-App an und verbindet Änderungen mit dem Abgleich. Einmal beim Start. */
export function registerWebPassBlocks(): void {
  if (registered) return;
  registered = true;
  registerPassBlock<Items>({
    name: 'einstellungen',
    read: () => collectItems(read, syncedNames(allKeys()), loadKnown(), Date.now()),
    write: (items) => {
      applyItems(items, read, write);
      write(KNOWN_KEY, JSON.stringify(items));
    },
    // Der Block liegt als Eintragsliste vor; der frühere Stand (nur Lieblingsspiele) hatte die Form { favorites, changed }.
    sanitize: (value) => sanitizeItems(value && typeof value === 'object' && 'favorites' in value ? value : { items: value }),
    merge: mergeItems,
    same: sameItems,
  });
  onFavoritesChanged(passSyncSoon);
  // Spiele melden sich mit eigenen Blöcken (Narrenhof, Drachenspiel) und bitten um Abgleich.
  onPassSyncRequest(() => passSyncSoon());
  // Änderungen an Musik, Aussehen & Co. werden beim nächsten Abgleich bemerkt: beim Start und wenn die Seite in den Hintergrund geht.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') passSyncSoon(500);
  });
}
