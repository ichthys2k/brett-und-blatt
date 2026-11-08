/**
 * Geteilte Pass-Schnappschüsse (Vorhaben #135, Schritt #149) – Logik ohne Anbieterbindung.
 *
 * Der Browser verschlüsselt den Schnappschuss mit einem Zufallsschlüssel, der nur im Link hinter dem `#` steht, und legt ihn
 * unter einer daraus abgeleiteten Kennung ab. Der Server sieht nur Datensalat. Wer den Link hat, kann lesen; **ändern oder löschen**
 * kann nur, wer das Schreibgeheimnis kennt (bleibt auf dem Gerät des Teilenden, der Server speichert nur seinen Hash).
 * Unbenutzt wird der Schnappschuss nach einem Jahr gelöscht.
 */

export const SHARE_ID_PATTERN = /^[0-9a-f]{32}$/;
export const SHARE_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** Höchstgröße des verschlüsselten Schnappschusses (Base64). */
export const SHARE_MAX_BYTES = 48 * 1024;
export const SHARE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface ShareRecord {
  /** SHA-256 des Schreibgeheimnisses (Base64url). */
  hash: string;
  data: string;
  /** Letzter Abruf oder Schreibzugriff (ms). */
  at: number;
}

export type ShareResult<T = object> = ({ status: 200 } & T) | { status: 400; error: string } | { status: 401 };

async function hashSecret(secret: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`brett-und-blatt/teilen\n${secret}`)));
  let binary = '';
  for (const b of digest) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const validData = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= SHARE_MAX_BYTES && /^[A-Za-z0-9+/=]+$/.test(value);

/** Anlegen oder Ersetzen: Gibt es schon einen Schnappschuss, muss das Schreibgeheimnis passen. */
export async function putShare(current: ShareRecord | null, body: unknown, now: number): Promise<ShareResult<{ record: ShareRecord }>> {
  const { secret, data } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (typeof secret !== 'string' || !SHARE_SECRET_PATTERN.test(secret) || !validData(data)) return { status: 400, error: 'body' };
  const hash = await hashSecret(secret);
  if (current && !same(hash, current.hash)) return { status: 401 };
  return { status: 200, record: { hash: current?.hash ?? hash, data, at: now } };
}

/** Darf mit diesem Geheimnis gelöscht werden? */
export async function mayRemoveShare(current: ShareRecord, body: unknown): Promise<boolean> {
  const { secret } = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return typeof secret === 'string' && SHARE_SECRET_PATTERN.test(secret) && same(await hashSecret(secret), current.hash);
}

export const isExpired = (record: ShareRecord, now: number): boolean => now >= record.at + SHARE_TTL_MS;
