import { KEY_PATTERN, openBytes, sealBytes, shareId } from './passShareCore';
import { GAME_SERVER } from './server';

/*
 * Anki-Pakete mit Medien teilen (#101, L7): das fertige `.apkg` wird im Browser mit einem Zufallsschlüssel verschlüsselt und als eine Datei
 * unter `/pakete/<Kennung>` abgelegt (R2, EU); der Schlüssel steht nur im Link hinter dem `#`, das Schreibgeheimnis bleibt auf dem Gerät.
 * Keine öffentliche Liste. Nach einem Jahr ohne Abruf löscht der Server das Paket. Der Link trägt `t=apkg`, damit der Empfänger weiß, wo er sucht.
 */

const STORE = 'brett-und-blatt:paketarchive';
type Shares = Record<string, { key: string; secret: string }>;

const randomText = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
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

export const archiveLink = (key: string): string => `${window.location.origin}${window.location.pathname}#/paket?t=apkg&k=${key}`;
/** Der Link, wenn dieses Paket gerade geteilt wird. */
export const currentArchiveLink = (packId: string): string | null => {
  const entry = load()[packId];
  return entry && KEY_PATTERN.test(entry.key) ? archiveLink(entry.key) : null;
};

/** Legt das Paket ab (oder ersetzt den Stand) und gibt den Link zurück; er bleibt bei erneutem Teilen gleich. */
export async function publishArchive(packId: string, apkg: Uint8Array): Promise<string> {
  if (!GAME_SERVER) throw new Error('server');
  const shares = load();
  const entry = shares[packId] ?? { key: randomText(), secret: randomText() };
  const response = await fetch(`${GAME_SERVER}/pakete/${await shareId(entry.key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Geheimnis': entry.secret },
    body: (await sealBytes(entry.key, apkg)) as BodyInit,
  });
  if (!response.ok) throw new Error(`server ${response.status}`);
  save({ ...shares, [packId]: entry });
  return archiveLink(entry.key);
}

export async function stopArchiveShare(packId: string): Promise<void> {
  const shares = load();
  const entry = shares[packId];
  if (!entry || !GAME_SERVER) return;
  const response = await fetch(`${GAME_SERVER}/pakete/${await shareId(entry.key)}/loeschen`, { method: 'POST', headers: { 'X-Geheimnis': entry.secret } });
  if (!response.ok && response.status !== 404) throw new Error(`server ${response.status}`);
  const { [packId]: _gone, ...rest } = shares;
  save(rest);
}

/** Ruft ein geteiltes Paket ab und entschlüsselt es (das `.apkg`). */
export async function fetchArchive(key: string): Promise<Uint8Array | 'missing' | 'error'> {
  if (!KEY_PATTERN.test(key) || !GAME_SERVER) return 'missing';
  try {
    const response = await fetch(`${GAME_SERVER}/pakete/${await shareId(key)}`);
    if (response.status === 404) return 'missing';
    if (!response.ok) return 'error';
    const plain = await openBytes(key, new Uint8Array(await response.arrayBuffer()));
    return plain ?? 'error';
  } catch {
    return 'error';
  }
}
