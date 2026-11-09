import { cleanEntry } from './words';

/*
 * Eigene Inhaltspakete (Vorhaben #135, Schritt #101): Paare aus zwei Feldern (A und B), z. B. Vokabeln oder Rechenaufgaben.
 * Jedes Paket und jede Zeile hat eine feste Kennung, die sich beim Bearbeiten nicht ändert (darauf baut später der Lernstand auf).
 * Freitext läuft durch `cleanEntry` (Länge, Filter). Reine Logik ohne Browser.
 */

export const PACK_ROWS_MAX = 200;
export const PACK_NAME_MAX = 40;
export const PACK_FIELD_MAX = 40;
/** Weniger Paare tragen kein Spiel (kleinstes Raster: 12 Karten). */
export const PACK_PAIRS_MIN = 6;
/** Mehr als 18 Paare braucht kein Paare-Spiel (größtes Raster: 36 Karten). */
export const PACK_PLAY_MAX = 18;
/** Gelöschte Pakete bleiben als Vermerk so lange, damit ein anderes Gerät sie nicht zurückbringt. */
const DELETED_KEEP_MS = 90 * 24 * 60 * 60 * 1000;

export interface PackRow {
  id: string;
  a: string;
  b: string;
}
export interface UserPack {
  id: string;
  name: string;
  rows: PackRow[];
  /** Zeit der letzten Änderung (ms). */
  at: number;
  /** Löschvermerk: Das Paket wurde zu diesem Zeitpunkt gelöscht. */
  deleted?: boolean;
}

const hex = (bytes: number): string => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
export const newPackId = (): string => `p-${hex(4)}`;
export const newRowId = (): string => `r-${hex(3)}`;

const ID = /^[a-z]-[0-9a-f]{6,16}$/;

/**
 * Liest eingefügten Text: eine Karte je Zeile, Felder mit Tab oder Semikolon getrennt (wie der Text-Import von Anki).
 * Zeilen ohne zwei brauchbare Felder zählt `skipped`.
 */
export function parsePackText(text: string): { rows: { a: string; b: string }[]; skipped: number } {
  const rows: { a: string; b: string }[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const parts = line.includes('\t') ? line.split('\t') : line.split(';');
    const a = cleanEntry(parts[0], PACK_FIELD_MAX);
    const b = cleanEntry(parts[1], PACK_FIELD_MAX);
    if (a && b && rows.length < PACK_ROWS_MAX) rows.push({ a, b });
    else skipped++;
  }
  return { rows, skipped };
}

export function sanitizeRows(value: unknown): PackRow[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rows: PackRow[] = [];
  for (const item of value.slice(0, PACK_ROWS_MAX)) {
    const v = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const a = cleanEntry(v.a, PACK_FIELD_MAX);
    const b = cleanEntry(v.b, PACK_FIELD_MAX);
    const id = typeof v.id === 'string' && ID.test(v.id) && !seen.has(v.id) ? v.id : newRowId();
    if (a && b) {
      seen.add(id);
      rows.push({ id, a, b });
    }
  }
  return rows;
}

export function sanitizePack(value: unknown): UserPack | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || !ID.test(v.id)) return null;
  const at = typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : 0;
  if (v.deleted === true) return { id: v.id, name: '', rows: [], at, deleted: true };
  const name = cleanEntry(v.name, PACK_NAME_MAX);
  if (!name) return null;
  return { id: v.id, name, rows: sanitizeRows(v.rows), at };
}

export function sanitizeLibrary(value: unknown): UserPack[] {
  if (!Array.isArray(value)) return [];
  const out: UserPack[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, 100)) {
    const pack = sanitizePack(item);
    if (pack && !seen.has(pack.id)) {
      seen.add(pack.id);
      out.push(pack);
    }
  }
  return out;
}

/** Je Paket gilt die jüngere Änderung; Löschvermerke bleiben eine Weile, damit kein Gerät ein gelöschtes Paket zurückbringt. */
export function mergeLibrary(remote: UserPack[], local: UserPack[], now = Date.now()): UserPack[] {
  const byId = new Map<string, UserPack>();
  for (const pack of [...remote, ...local]) {
    const known = byId.get(pack.id);
    if (!known || pack.at > known.at) byId.set(pack.id, pack);
  }
  return [...byId.values()].filter((pack) => !pack.deleted || now - pack.at < DELETED_KEEP_MS);
}

export const sameLibrary = (a: UserPack[], b: UserPack[]): boolean => {
  const key = (list: UserPack[]) => JSON.stringify([...list].sort((x, y) => x.id.localeCompare(y.id)));
  return key(a) === key(b);
};

/** Pakete ohne Löschvermerk, jüngste zuerst. */
export const livePacks = (library: UserPack[]): UserPack[] => library.filter((pack) => !pack.deleted).sort((x, y) => y.at - x.at);

export function packProblem(pack: Pick<UserPack, 'rows'>): string | null {
  if (pack.rows.length < PACK_PAIRS_MIN) return `Mindestens ${PACK_PAIRS_MIN} Paare nötig (jetzt ${pack.rows.length}).`;
  return null;
}

/** Wählt für eine Partie zufällig bis zu `PACK_PLAY_MAX` Paare und macht daraus den Wert der verborgenen Option `pack`. */
export function encodePairsOption(pack: Pick<UserPack, 'name' | 'rows'>, randomInt: (n: number) => number): string {
  const rows = [...pack.rows];
  for (let i = rows.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  }
  return JSON.stringify({ n: pack.name, p: rows.slice(0, PACK_PLAY_MAX).map((row) => [row.a, row.b]) });
}

export interface PairsPack {
  name: string;
  pairs: { a: string; b: string }[];
}

/** Liest den Wert der Option `pack`; null, wenn er nicht brauchbar ist (der Server vertraut keinem Browser). */
export function decodePairsOption(text: unknown): PairsPack | null {
  if (typeof text !== 'string' || text.length === 0 || text.length > 6000) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { n, p } = value as { n?: unknown; p?: unknown };
  const name = cleanEntry(n, PACK_NAME_MAX);
  if (!name || !Array.isArray(p)) return null;
  const pairs: { a: string; b: string }[] = [];
  for (const entry of p.slice(0, PACK_PLAY_MAX)) {
    if (!Array.isArray(entry)) continue;
    const a = cleanEntry(entry[0], PACK_FIELD_MAX);
    const b = cleanEntry(entry[1], PACK_FIELD_MAX);
    if (a && b) pairs.push({ a, b });
  }
  return pairs.length >= PACK_PAIRS_MIN ? { name, pairs } : null;
}
