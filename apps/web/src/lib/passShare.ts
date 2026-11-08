import { sanitizeTrophies } from './pokale';
import { loadBook } from './chronikStore';
import { TROPHIES_KEY } from './passRecorder';
import { currentCrest, hasCrest } from './crestStore';
import { serializeCrest } from '@brett-und-blatt/engine';
import { parseFavorites, FAVORITES_KEY } from './favorites';
import { GAME_SERVER } from './server';
import { stampsFor } from './stamps';
import { KEY_PATTERN, STORE_KEY, SHARE_SECTIONS, SHARE_LABEL, encryptSnapshot, decryptSnapshot, sanitizeSnapshot, shareId, type PassSnapshot, type ShareSection } from './passShareCore';

export { SHARE_SECTIONS, SHARE_LABEL, encryptSnapshot, decryptSnapshot, sanitizeSnapshot, shareId };
export type { PassSnapshot, ShareSection };
import { storage } from './storage';

/*
 * Pass teilen (Vorhaben #135, Schritt #149): ein Schnappschuss, kein Live-Zugriff. Der Browser verschlüsselt ihn mit einem
 * Zufallsschlüssel, der nur im Link hinter dem # steht; der Server (`/teilen/<Kennung>`) sieht nur Datensalat. Das
 * Schreibgeheimnis bleibt auf diesem Gerät und erlaubt Ersetzen und „Teilen beenden“. Gezeigt werden nur Name, Bild und
 * die gewählten Teile, keine Kennung und kein Code.
 */

/** Baut den Schnappschuss aus den eigenen Daten, nur mit den gewählten Teilen. */
export function buildSnapshot(sections: readonly ShareSection[], now = Date.now()): PassSnapshot | null {
  const profile = storage.loadProfile();
  if (!profile) return null;
  const snapshot: PassSnapshot = { v: 1, name: profile.name, avatar: profile.avatar, at: now };
  if (sections.includes('crest')) snapshot.crest = serializeCrest(currentCrest());
  if (sections.includes('stamps')) {
    const book = loadBook();
    const gameIds = new Set(Object.values(book.counts).flatMap((games) => Object.keys(games)));
    snapshot.stamps = [...gameIds].flatMap((gameId) => {
      const kinds = stampsFor(book, gameId).filter((s) => s.earned).map((s) => s.kind);
      return kinds.length ? [{ gameId, kinds }] : [];
    });
  }
  if (sections.includes('trophies')) {
    try {
      snapshot.trophies = sanitizeTrophies(JSON.parse(window.localStorage.getItem(TROPHIES_KEY) ?? 'null')).slice(0, 60).map((t) => ({ gameId: t.gameId, at: t.at }));
    } catch {
      snapshot.trophies = [];
    }
  }
  if (sections.includes('favorites')) {
    try {
      snapshot.favorites = parseFavorites(window.localStorage.getItem(FAVORITES_KEY));
    } catch {
      snapshot.favorites = [];
    }
  }
  return snapshot;
}

const randomText = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

interface Stored {
  key: string;
  secret: string;
}
function loadStored(): Stored | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? 'null');
    return value && KEY_PATTERN.test(value.key) && KEY_PATTERN.test(value.secret) ? value : null;
  } catch {
    return null;
  }
}

export const linkFor = (key: string): string => `${window.location.origin}${window.location.pathname}#/pass/ansehen?k=${key}`;
/** Der Link, wenn dieser Pass gerade geteilt wird. */
export const currentShareLink = (): string | null => {
  const stored = loadStored();
  return stored ? linkFor(stored.key) : null;
};
export const hasCrestToShare = hasCrest;

/** Legt den Schnappschuss ab (oder ersetzt ihn) und gibt den Link zurück. Der Link bleibt bei erneutem Teilen gleich. */
export async function publishShare(sections: readonly ShareSection[]): Promise<string> {
  if (!GAME_SERVER) throw new Error('server');
  const snapshot = buildSnapshot(sections);
  if (!snapshot) throw new Error('profile');
  const stored = loadStored() ?? { key: randomText(), secret: randomText() };
  const response = await fetch(`${GAME_SERVER}/teilen/${await shareId(stored.key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: stored.secret, data: await encryptSnapshot(stored.key, snapshot) }),
  });
  if (!response.ok) throw new Error(`server ${response.status}`);
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(stored));
  } catch {
    // ohne Speicher gilt der Link nur bis zum Schließen; ersetzen geht dann nicht mehr
  }
  return linkFor(stored.key);
}

/** „Teilen beenden“: löscht den Schnappschuss auf dem Server. */
export async function stopShare(): Promise<void> {
  const stored = loadStored();
  if (!stored || !GAME_SERVER) return;
  const response = await fetch(`${GAME_SERVER}/teilen/${await shareId(stored.key)}/loeschen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: stored.secret }),
  });
  if (!response.ok && response.status !== 404) throw new Error(`server ${response.status}`);
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch {
    // nichts zu tun
  }
}

/** Ruft einen geteilten Schnappschuss ab (für die Ansicht). */
export async function fetchShare(key: string): Promise<PassSnapshot | 'missing' | 'error'> {
  if (!KEY_PATTERN.test(key) || !GAME_SERVER) return 'missing';
  try {
    const response = await fetch(`${GAME_SERVER}/teilen/${await shareId(key)}`);
    if (response.status === 404) return 'missing';
    if (!response.ok) return 'error';
    const { data } = (await response.json()) as { data?: string };
    return (typeof data === 'string' && (await decryptSnapshot(key, data))) || 'error';
  } catch {
    return 'error';
  }
}
