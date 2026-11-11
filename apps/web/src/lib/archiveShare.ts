import { KEY_PATTERN, openBytes, sealBytes, shareId } from './passShareCore';
import { passSyncSoon } from './playerPass';
import { GAME_SERVER } from './server';

/*
 * Anki-Pakete mit Medien teilen (#101, L7): das fertige `.apkg` wird im Browser mit einem Zufallsschlüssel verschlüsselt und als eine Datei
 * unter `/pakete/<Kennung>` abgelegt (R2, EU); der Schlüssel steht nur im Link hinter dem `#`, das Schreibgeheimnis bleibt auf dem Gerät.
 * Keine öffentliche Liste. Nach einem Jahr ohne Abruf löscht der Server das Paket. Der Link trägt `t=apkg`, damit der Empfänger weiß, wo er sucht.
 */

export const ARCHIVE_SHARES_KEY = 'brett-und-blatt:paketarchive';

export interface ArchiveShareMeta {
  name?: string;
  notes?: number;
  cards?: number;
  at?: number;
}

export interface ArchiveShareEntry extends ArchiveShareMeta {
  key: string;
  secret: string;
}

export type Shares = Record<string, ArchiveShareEntry>;

const randomText = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

function load(): Shares {
  try {
    const value = JSON.parse(window.localStorage.getItem(ARCHIVE_SHARES_KEY) ?? '{}');
    return value && typeof value === 'object' ? (value as Shares) : {};
  } catch {
    return {};
  }
}

function save(shares: Shares): void {
  try {
    window.localStorage.setItem(ARCHIVE_SHARES_KEY, JSON.stringify(shares));
  } catch {
    // ohne Speicher gilt der Link nur bis zum Schließen
  }
  passSyncSoon();
}

export function listArchiveShares(): Shares {
  return load();
}

export const archiveLink = (key: string): string => `${window.location.origin}${window.location.pathname}#/paket?t=apkg&k=${key}`;

/** Der Link, wenn dieses Paket gerade geteilt wird. */
export const currentArchiveLink = (packId: string): string | null => {
  const entry = load()[packId];
  return entry && KEY_PATTERN.test(entry.key) ? archiveLink(entry.key) : null;
};

/** Legt das Paket ab (oder ersetzt den Stand) und gibt den Link zurück; er bleibt bei erneutem Teilen gleich. */
export async function publishArchive(packId: string, apkg: Uint8Array, meta?: ArchiveShareMeta): Promise<string> {
  if (!GAME_SERVER) throw new Error('server');
  const shares = load();
  const current = shares[packId];
  const entry: ArchiveShareEntry = {
    key: current?.key ?? randomText(),
    secret: current?.secret ?? randomText(),
    ...(meta?.name ? { name: meta.name } : current?.name ? { name: current.name } : {}),
    ...(meta?.notes !== undefined ? { notes: meta.notes } : current?.notes !== undefined ? { notes: current.notes } : {}),
    ...(meta?.cards !== undefined ? { cards: meta.cards } : current?.cards !== undefined ? { cards: current.cards } : {}),
    at: Date.now(),
  };
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

// ---------------------------------------------------------------- Pass-Block-Hilfsfunktionen

export function sanitizeArchiveShares(value: unknown): Shares {
  if (!value || typeof value !== 'object') return {};
  const out: Shares = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof k !== 'string' || !v || typeof v !== 'object') continue;
    const entry = v as Record<string, unknown>;
    if (typeof entry.key === 'string' && KEY_PATTERN.test(entry.key) && typeof entry.secret === 'string' && entry.secret.length > 0 && entry.secret.length < 200) {
      out[k] = {
        key: entry.key,
        secret: entry.secret,
        ...(typeof entry.name === 'string' ? { name: entry.name.slice(0, 100) } : {}),
        ...(typeof entry.notes === 'number' && Number.isFinite(entry.notes) ? { notes: Math.max(0, Math.floor(entry.notes)) } : {}),
        ...(typeof entry.cards === 'number' && Number.isFinite(entry.cards) ? { cards: Math.max(0, Math.floor(entry.cards)) } : {}),
        ...(typeof entry.at === 'number' && Number.isFinite(entry.at) ? { at: Math.floor(entry.at) } : {}),
      };
    }
  }
  return out;
}

export function mergeArchiveShares(remote: Shares, local: Shares): Shares {
  const merged: Shares = { ...remote };
  for (const [id, entry] of Object.entries(local)) {
    const existing = merged[id];
    if (!existing || (entry.at ?? 0) >= (existing.at ?? 0)) {
      merged[id] = entry;
    }
  }
  return merged;
}

export function sameArchiveShares(a: Shares, b: Shares): boolean {
  return JSON.stringify(sanitizeArchiveShares(a)) === JSON.stringify(sanitizeArchiveShares(b));
}
