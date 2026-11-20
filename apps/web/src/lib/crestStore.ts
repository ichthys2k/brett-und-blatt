import { DEFAULT_CREST, cleanCrest, parseCrest, serializeCrest, type CrestProgress, type CrestSpec } from '@brett-und-blatt/engine';
import { useSyncExternalStore } from 'react';
import { loadBook } from './chronikStore';
import { games } from './registry';
import { passSyncSoon, syncPassEntry } from './playerPass';
import { storage } from './storage';
import { buildProgress, crestProgressOf, type Progress } from './unlocks';

/*
 * Das Wappen dieses Passes (Vorhaben #135, Schritt #147): Speicher, Fortschritt fürs Freischalten und ein Haken für die Oberfläche.
 * Die Bedeutung der Teile und die Freischaltregeln stehen rein in der Engine (`player-crest.ts`).
 */

const listeners = new Set<() => void>();
const saveListeners = new Set<() => void>();
let version = 0;

/** Meldet einen Listener an, der nach dem Speichern eines neuen Wappens benachrichtigt wird. */
export function onCrestSaved(listener: () => void): () => void {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}

/** Das gespeicherte Wappen, sonst die Vorgabe mit dem Bild des Passes als Tier. */
export function currentCrest(): CrestSpec {
  const stored = parseCrest(storage.loadCrestText());
  if (stored) return stored;
  const avatar = storage.loadProfile()?.avatar;
  return { ...DEFAULT_CREST, ...(avatar ? { animal: parseCrest(`tier:${avatar}`)?.animal ?? DEFAULT_CREST.animal } : {}) };
}

/** Hat dieser Pass schon ein Wappen gewählt? */
export const hasCrest = (): boolean => cleanCrest(storage.loadCrestText()) !== undefined;

export function saveCrest(spec: CrestSpec): void {
  storage.saveCrestText(serializeCrest(spec));
  version++;
  for (const listener of listeners) listener();
  for (const listener of saveListeners) listener();
  syncPassEntry();
  passSyncSoon();
}

/** Das Wappen für die Anzeige; die Oberfläche zeichnet neu, sobald es sich ändert. */
export function useCrest(): CrestSpec {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => version,
  );
  return currentCrest();
}

/** Die Zähler dieses Passes aus dem Freischalt-Baustein (#569), ohne Entwürfe. */
export function currentCrestStats(): Progress {
  return buildProgress({ book: loadBook(), knownGameIds: new Set(games.map((game) => game.id)) });
}

/** Was dieser Pass erreicht hat – daraus ergibt sich, welche Teile frei sind. */
export function crestProgress(): CrestProgress {
  return crestProgressOf(currentCrestStats());
}
