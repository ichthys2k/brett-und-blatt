import { useSyncExternalStore } from 'react';
import { loadBook } from './chronikStore';
import { passSyncSoon, syncPassEntry } from './playerPass';
import { games } from './registry';
import { loadJesterAtelier, loadLearnDays } from './unlockSources';
import { buildProgress, type Progress } from './unlocks';

/*
 * Anzeige der Stufen (Belohnungskonzept #324, Schritt #573): Schalter „Belohnungen nicht anzeigen“ (liegt als `belohnungen`
 * im Block `einstellungen` und reist mit dem Pass). Die Stufe selbst wird nie gespeichert, sie ergibt sich aus den Zählern (`stufen.ts`).
 */

export const REWARDS_HIDDEN_KEY = 'brett-und-blatt:belohnungen';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Speicher gesperrt: der Hinweis fällt dann einfach weg
  }
}

export const rewardsHidden = (): boolean => read(REWARDS_HIDDEN_KEY) === 'aus';

const hiddenListeners = new Set<() => void>();

/** Für die Oberfläche: zeichnet neu, sobald der Schalter wechselt. */
export function useRewardsHidden(): boolean {
  return useSyncExternalStore(
    (listener) => {
      hiddenListeners.add(listener);
      return () => hiddenListeners.delete(listener);
    },
    rewardsHidden,
    () => false,
  );
}

export function setRewardsHidden(hidden: boolean): void {
  write(REWARDS_HIDDEN_KEY, hidden ? 'aus' : null);
  for (const listener of hiddenListeners) listener();
  syncPassEntry();
  passSyncSoon();
}

/** Die Zähler des aktiven Passes (ohne Entwürfe), Grundlage der Stufe. */
export function currentProgress(): Progress {
  return buildProgress({ book: loadBook(), learnDays: loadLearnDays(), jesterAtelier: loadJesterAtelier(), knownGameIds: new Set(games.map((game) => game.id)) });
}
