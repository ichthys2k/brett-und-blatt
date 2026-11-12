import { useSyncExternalStore } from 'react';

/*
 * „Spielersuche ausblenden“ (#65): Wer das Schwarze Brett nicht sehen will – etwa Eltern oder Schulen –, blendet es je
 * Gerät aus. Dann fehlt der Zettel im Hauptmenü, und die Seite selbst zeigt nur einen Hinweis zum Wiedereinblenden.
 */
export const BOARD_HIDDEN_KEY = 'brett-und-blatt:brett-ausblenden';

const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(BOARD_HIDDEN_KEY) === 'ja';
  } catch {
    return false;
  }
}

let hidden = typeof window === 'undefined' ? false : read();

export function isBoardHidden(): boolean {
  return hidden;
}

export function setBoardHidden(value: boolean): void {
  hidden = value;
  try {
    if (value) window.localStorage.setItem(BOARD_HIDDEN_KEY, 'ja');
    else window.localStorage.removeItem(BOARD_HIDDEN_KEY);
  } catch {
    // gesperrt – gilt bis zum Neuladen
  }
  for (const listener of listeners) listener();
}

export function useBoardHidden(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => hidden,
  );
}
