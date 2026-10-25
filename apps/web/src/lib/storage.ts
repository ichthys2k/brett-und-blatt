import type { SessionSnapshot } from '@brett-und-blatt/engine';

/*
 * Speicher im Browser. Er ist nur eine Bequemlichkeit (Partie fortsetzen,
 * letzte Einstellungen) und darf jederzeit leer sein oder fehlen – etwa im
 * privaten Fenster. Darum ist jeder Zugriff abgesichert.
 */
const ACTIVE_KEY = 'brett-und-blatt:laufende-partie';
const setupKey = (gameId: string) => `brett-und-blatt:einstellungen:${gameId}`;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher voll oder gesperrt – dann eben ohne.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignorieren
  }
}

export const storage = {
  loadActive: () => {
    const snapshot = read<SessionSnapshot>(ACTIVE_KEY);
    return snapshot?.version === 1 ? snapshot : null;
  },
  saveActive: (snapshot: SessionSnapshot) => write(ACTIVE_KEY, snapshot),
  clearActive: () => remove(ACTIVE_KEY),
  loadSetup: <T>(gameId: string) => read<T>(setupKey(gameId)),
  saveSetup: (gameId: string, setup: unknown) => write(setupKey(gameId), setup),
};
