import type { AnkiCollection } from '../types';

/*
 * Schnittstellen für Anki-Pakete (`.apkg`, `.colpkg`). Die Engine kennt weder ZIP noch SQLite noch zstd: Die Web-App reicht sie als
 * `ApkgDeps` herein (sql.js, fzstd), die Tests ebenso. So bleibt die Logik rein und prüfbar.
 */

export interface SqlDb {
  /** Alle Zeilen einer Abfrage (Spaltenname → Wert; Blobs als `Uint8Array`). */
  all(sql: string, params?: unknown[]): Record<string, unknown>[];
  run(sql: string, params?: unknown[]): void;
  /** Dieselbe Anweisung für viele Zeilen (eine Transaktion). */
  batch(sql: string, rows: unknown[][]): void;
  /** Die Datenbank als Datei. */
  export(): Uint8Array;
  close(): void;
}

export interface ApkgDeps {
  /** Öffnet eine Datenbank aus Bytes, ohne Bytes eine leere. */
  open(bytes?: Uint8Array): SqlDb;
  unzstd(bytes: Uint8Array): Uint8Array;
  /** Nur für das Schreiben im neuen Format. */
  zstd?(bytes: Uint8Array): Uint8Array;
}

/** Eine Karte mit ihrem Lernstand, so wie Anki sie speichert. */
export interface ApkgCard {
  id: number;
  nid: number;
  did: number;
  ord: number;
  mod: number;
  usn: number;
  type: number;
  queue: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
  odue: number;
  odid: number;
  flags: number;
  data: string;
}

export interface ApkgRevlog {
  id: number;
  cid: number;
  usn: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
}

export type ApkgVersion = 'legacy1' | 'legacy2' | 'latest';

export interface ApkgData {
  version: ApkgVersion;
  collection: AnkiCollection;
  cards: ApkgCard[];
  revlog: ApkgRevlog[];
  /** Dateiname → Inhalt. */
  media: Map<string, Uint8Array>;
  /** Einstellungen der Sammlung und Stapeloptionen (Schema-11-JSON), soweit das Paket sie mitbringt. */
  conf: Record<string, unknown> | null;
  dconf: Record<string, unknown> | null;
  /** Hinweise für die Oberfläche: was beim Lesen nicht übernommen wurde (z. B. Skripte in Vorlagen). */
  warnings: string[];
}

export const APKG_MAX_BYTES = 50 * 1024 * 1024;
