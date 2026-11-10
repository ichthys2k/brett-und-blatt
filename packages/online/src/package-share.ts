import { SHARE_SECRET_PATTERN, SHARE_TTL_MS, hashSecret, same } from './share';

/**
 * Geteilte Anki-Pakete mit Medien (Vorhaben #101, L7) – Logik ohne Anbieterbindung.
 *
 * Wie bei den Pass-Schnappschüssen (`share.ts`) verschlüsselt der Browser das Paket mit einem Zufallsschlüssel, der nur im Link hinter dem `#`
 * steht; der Server sieht nur Bytes. Die Bytes liegen in einem R2-Bucket (EU), die Verwaltung (Schreibgeheimnis, Größe, letzter Abruf, Frist)
 * in einem Durable Object je Kennung. Ein Jahr ohne Abruf, dann löscht das Objekt per Alarm beides.
 */

export const PACKAGE_MAX_BYTES = 52 * 1024 * 1024;
export const PACKAGE_TTL_MS = SHARE_TTL_MS;

export interface PackageRecord {
  /** SHA-256 des Schreibgeheimnisses (Base64url), wie bei `ShareRecord`. */
  hash: string;
  size: number;
  /** Letzter Abruf oder Schreibzugriff (ms). */
  at: number;
}

export const isPackageExpired = (record: PackageRecord, now: number): boolean => now >= record.at + PACKAGE_TTL_MS;

/** Darf mit diesem Geheimnis geschrieben werden? 400: Geheimnis unbrauchbar, 401: gehört jemand anderem. */
export async function authorizePackage(current: PackageRecord | null, secret: unknown): Promise<200 | 400 | 401> {
  if (typeof secret !== 'string' || !SHARE_SECRET_PATTERN.test(secret)) return 400;
  if (current && !same(await hashSecret(secret), current.hash)) return 401;
  return 200;
}

/** Der Eintrag nach dem Schreiben. */
export async function packageRecord(current: PackageRecord | null, secret: string, size: number, now: number): Promise<PackageRecord> {
  return { hash: current?.hash ?? (await hashSecret(secret)), size, at: now };
}

/** Gültige Größe des hochgeladenen Pakets (verschlüsselt: Vektor 12 + Etikett 16 Byte mehr als der Inhalt). */
export const validPackageSize = (size: number): boolean => Number.isInteger(size) && size > 28 && size <= PACKAGE_MAX_BYTES;
