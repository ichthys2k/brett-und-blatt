import { newPackId, sanitizePack, type UserPack } from '@brett-und-blatt/engine';
import { KEY_PATTERN, openJson, sealJson, shareId } from './passShareCore';
import { GAME_SERVER } from './server';

/*
 * Pakete teilen (#101): wie „Pass teilen“ (#149) – das Paket wird im Browser mit einem Zufallsschlüssel verschlüsselt und unter einer daraus
 * abgeleiteten Kennung auf dem Server abgelegt (`/teilen/<Kennung>`); der Schlüssel steht nur im Link hinter dem `#`. Das Schreibgeheimnis
 * bleibt auf dem Gerät. Es gibt keine öffentliche Liste. Nach einem Jahr ohne Abruf löscht der Server das Paket.
 */

const STORE = 'brett-und-blatt:paketteilen';
type Shares = Record<string, { key: string; secret: string }>;

function randomText(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function load(): Shares {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORE) ?? '{}');
    return value && typeof value === 'object' ? (value as Shares) : {};
  } catch {
    return {};
  }
}
function save(shares: Shares): void {
  try {
    window.localStorage.setItem(STORE, JSON.stringify(shares));
  } catch {
    // ohne Speicher gilt der Link nur bis zum Schließen
  }
}

/** Beim Umstellen der Bibliothek bekommen die Pakete neue Kennungen; geteilte Pakete behalten Schlüssel und Schreibgeheimnis (Link und „Teilen beenden“ gehen weiter). */
export function moveShare(oldId: string, newId: string): void {
  const shares = load();
  const entry = shares[oldId];
  if (!entry || shares[newId]) return;
  const { [oldId]: _moved, ...rest } = shares;
  save({ ...rest, [newId]: entry });
}

export const packLink = (key: string): string => `${window.location.origin}${window.location.pathname}#/paket?k=${key}`;
/** Der Link, wenn dieses Paket gerade geteilt wird. */
export const currentPackLink = (packId: string): string | null => {
  const entry = load()[packId];
  return entry && KEY_PATTERN.test(entry.key) ? packLink(entry.key) : null;
};

/** Legt das Paket ab (oder ersetzt den Stand) und gibt den Link zurück; der Link bleibt bei erneutem Teilen gleich. */
export async function publishPack(pack: UserPack): Promise<string> {
  if (!GAME_SERVER) throw new Error('server');
  const shares = load();
  const entry = shares[pack.id] ?? { key: randomText(), secret: randomText() };
  const response = await fetch(`${GAME_SERVER}/teilen/${await shareId(entry.key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: entry.secret, data: await sealJson(entry.key, { v: 1, pack: { name: pack.name, rows: pack.rows } }) }),
  });
  if (!response.ok) throw new Error(`server ${response.status}`);
  save({ ...shares, [pack.id]: entry });
  return packLink(entry.key);
}

export async function stopPackShare(packId: string): Promise<void> {
  const shares = load();
  const entry = shares[packId];
  if (!entry || !GAME_SERVER) return;
  const response = await fetch(`${GAME_SERVER}/teilen/${await shareId(entry.key)}/loeschen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: entry.secret }),
  });
  if (!response.ok && response.status !== 404) throw new Error(`server ${response.status}`);
  const { [packId]: _gone, ...rest } = shares;
  save(rest);
}

/** Ruft ein geteiltes Paket ab. Das Ergebnis hat eine neue eigene Kennung (so kollidiert es nicht mit dem Original). */
export async function fetchPack(key: string): Promise<UserPack | 'missing' | 'error'> {
  if (!KEY_PATTERN.test(key) || !GAME_SERVER) return 'missing';
  try {
    const response = await fetch(`${GAME_SERVER}/teilen/${await shareId(key)}`);
    if (response.status === 404) return 'missing';
    if (!response.ok) return 'error';
    const { data } = (await response.json()) as { data?: string };
    if (typeof data !== 'string') return 'error';
    const value = (await openJson(key, data)) as { pack?: { name?: unknown; rows?: unknown } } | null;
    const pack = value?.pack ? sanitizePack({ id: newPackId(), name: value.pack.name, rows: value.pack.rows, at: Date.now() }) : null;
    return pack && !pack.deleted ? pack : 'error';
  } catch {
    return 'error';
  }
}
