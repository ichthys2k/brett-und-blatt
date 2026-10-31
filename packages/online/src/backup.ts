/**
 * Verschlüsselte Sicherungen (Narrenhof-Fortschritt, W-018) – Ablage ohne Anbieterbindung.
 *
 * Der Server sieht nur eine Kennung (aus dem Sicherungscode abgeleitet, verrät ihn nicht) und
 * einen im Browser verschlüsselten Block. Er kann nichts entschlüsseln und prüft nur Form und
 * Größe. Gegen gleichzeitiges Überschreiben von zwei Geräten trägt jeder Stand eine Nummer
 * (`rev`): Wer schreibt, nennt die Nummer, die er zuletzt gelesen hat; passt sie nicht mehr,
 * kommt der aktuelle Stand zurück (409), das Gerät führt zusammen und versucht es erneut.
 */

/** Kennung einer Sicherung: 128 Bit als Hexadezimalzahl. */
export const BACKUP_ID_PATTERN = /^[0-9a-f]{32}$/;
/** Höchstgröße des verschlüsselten Blocks (Base64). Ein Narrenhof-Stand hat wenige KB. */
export const BACKUP_MAX_BYTES = 64 * 1024;
/** Unbenutzte Sicherungen werden nach rund 13 Monaten gelöscht. */
export const BACKUP_TTL_MS = 400 * 24 * 60 * 60 * 1000;

export interface StoredBackup {
  /** Verschlüsselter Block (Base64), vom Server nie gelesen. */
  data: string;
  /** Fortlaufende Nummer des Stands, beginnt bei 1. */
  rev: number;
  /** Letzter Zugriff (ms), für das Löschen unbenutzter Sicherungen. */
  at: number;
}

export type BackupPutResult =
  | { status: 200; stored: StoredBackup }
  | { status: 409; current: StoredBackup | null }
  | { status: 400; error: string };

/** Prüft einen Schreibwunsch `{ data, rev }` gegen den gespeicherten Stand. */
export function applyBackupPut(current: StoredBackup | null, body: unknown, now: number): BackupPutResult {
  if (!body || typeof body !== 'object') return { status: 400, error: 'body' };
  const { data, rev } = body as Record<string, unknown>;
  if (typeof data !== 'string' || data.length === 0 || data.length > BACKUP_MAX_BYTES || !/^[A-Za-z0-9+/=]+$/.test(data)) return { status: 400, error: 'data' };
  if (typeof rev !== 'number' || !Number.isInteger(rev) || rev < 0) return { status: 400, error: 'rev' };
  if (rev !== (current?.rev ?? 0)) return { status: 409, current };
  return { status: 200, stored: { data, rev: rev + 1, at: now } };
}
