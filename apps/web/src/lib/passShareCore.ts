import { STAMP_KINDS, type StampKind } from './stamps';

/* Reiner Kern von „Pass teilen“ (#149): Verschlüsselung, Kennung, Prüfung. Siehe passShare.ts. */

export const SHARE_SECTIONS = ['crest', 'stamps', 'trophies', 'favorites'] as const;
export type ShareSection = (typeof SHARE_SECTIONS)[number];
export const SHARE_LABEL: Readonly<Record<ShareSection, string>> = {
  crest: 'Wappen',
  stamps: 'Stempel',
  trophies: 'Pokalschrank',
  favorites: 'Lieblingsspiele',
};

export interface PassSnapshot {
  v: 1;
  name: string;
  avatar: string;
  at: number;
  crest?: string;
  stamps?: { gameId: string; kinds: StampKind[] }[];
  trophies?: { gameId: string; at: number }[];
  favorites?: string[];
}

export const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const STORE_KEY = 'brett-und-blatt:teilen';
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return new Uint8Array(Array.from(atob(padded), (c) => c.charCodeAt(0)));
}
const b64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};
const randomText = (): string => b64url(crypto.getRandomValues(new Uint8Array(32)));

/** Kennung auf dem Server, aus dem Linkschlüssel abgeleitet (32 Hex-Zeichen). */
export async function shareId(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`brett-und-blatt/teilen/id\n${key}`)));
  return [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function aesKey(key: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', fromB64url(key), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('brett-und-blatt/teilen/key') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Verschlüsselt beliebiges JSON mit dem Linkschlüssel (AES-GCM); Ergebnis ist Base64 für die Server-Ablage. */
export async function sealJson(key: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(key), enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return b64(out);
}

/** Verschlüsselt Bytes (ein Anki-Paket) mit dem Linkschlüssel; Ergebnis: 12 Byte Vektor, dann Geheimtext mit Etikett. */
export async function sealBytes(key: string, bytes: Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(key), bytes as BufferSource));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return out;
}

/** Gegenstück zu `sealBytes`; null bei falschem Schlüssel oder beschädigten Daten. */
export async function openBytes(key: string, data: Uint8Array): Promise<Uint8Array | null> {
  try {
    if (data.length < 28) return null;
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, await aesKey(key), data.slice(12)));
  } catch {
    return null;
  }
}

/** Gegenstück zu `sealJson`; null bei falschem Schlüssel oder beschädigten Daten. */
export async function openJson(key: string, data: string): Promise<unknown | null> {
  try {
    const bytes = new Uint8Array(Array.from(atob(data), (c) => c.charCodeAt(0)));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await aesKey(key), bytes.slice(12));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}

export const encryptSnapshot = (key: string, snapshot: PassSnapshot): Promise<string> => sealJson(key, snapshot);

export async function decryptSnapshot(key: string, data: string): Promise<PassSnapshot | null> {
  const value = await openJson(key, data);
  return value === null ? null : sanitizeSnapshot(value);
}

/** Prüft einen empfangenen Schnappschuss; unbekannte oder zu lange Teile fallen weg. */
export function sanitizeSnapshot(value: unknown): PassSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.v !== 1 || typeof v.name !== 'string' || typeof v.avatar !== 'string') return null;
  const text = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');
  const id = (x: unknown) => (typeof x === 'string' && /^[a-z0-9-]{1,40}$/.test(x) ? x : null);
  const snapshot: PassSnapshot = { v: 1, name: text(v.name, 30), avatar: text(v.avatar, 16), at: typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : 0 };
  if (typeof v.crest === 'string') snapshot.crest = v.crest.slice(0, 200);
  if (Array.isArray(v.stamps)) {
    snapshot.stamps = v.stamps.slice(0, 80).flatMap((item) => {
      const gameId = id((item as { gameId?: unknown })?.gameId);
      const kinds = Array.isArray((item as { kinds?: unknown })?.kinds) ? ((item as { kinds: unknown[] }).kinds.filter((k) => STAMP_KINDS.includes(k as StampKind)) as StampKind[]) : [];
      return gameId && kinds.length ? [{ gameId, kinds }] : [];
    });
  }
  if (Array.isArray(v.trophies)) {
    snapshot.trophies = v.trophies.slice(0, 60).flatMap((item) => {
      const gameId = id((item as { gameId?: unknown })?.gameId);
      const at = (item as { at?: unknown })?.at;
      return gameId && typeof at === 'number' && Number.isFinite(at) ? [{ gameId, at }] : [];
    });
  }
  if (Array.isArray(v.favorites)) snapshot.favorites = v.favorites.flatMap((x) => id(x) ?? []).slice(0, 60);
  return snapshot;
}

