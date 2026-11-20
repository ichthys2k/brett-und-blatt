/*
 * Easter Egg (#596): Siebenmal schnell aufs Logo tippen öffnet „Brett & Blatt 16“, das SNES-ROM im Browser.
 * Der Auslöser ist reine Logik (testbar); Emulator und ROM laden erst, wenn der Dialog offen ist.
 */

export const SNES_TAPS = 7;
/** Höchstens so lange (ms) darf zwischen zwei Tipps vergehen, sonst beginnt das Zählen von vorn. */
export const SNES_TAP_GAP_MS = 1200;
export const SNES_OPEN_EVENT = 'bub-snes-open';
/** Name der IndexedDB, in der die Seite `public/snes/index.html` den Spielstand ablegt. */
export const SNES_DB = 'bub-snes';

/** Zählt schnelle Tipps; gibt true zurück, sobald der letzte nötige Tipp erfolgt ist, und setzt dann zurück. */
export function createTapCounter(taps = SNES_TAPS, gapMs = SNES_TAP_GAP_MS) {
  let count = 0;
  let last = -Infinity;
  return (now: number): boolean => {
    count = now - last <= gapMs ? count + 1 : 1;
    last = now;
    if (count < taps) return false;
    count = 0;
    last = -Infinity;
    return true;
  };
}

export function openSnesEgg(): void {
  window.dispatchEvent(new Event(SNES_OPEN_EVENT));
}

const counter = createTapCounter();
/** Für den `onClick` des Logos. */
export function logoTap(): void {
  if (counter(Date.now())) openSnesEgg();
}

/** Löscht den gespeicherten Spielstand (der Iframe muss vorher entfernt sein). */
export function resetSnesSave(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(SNES_DB);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}
