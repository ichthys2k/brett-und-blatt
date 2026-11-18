/*
 * Ein Adapter verbindet ein Spiel im ROM mit seinem TypeScript-Modul: Er übersetzt Züge und
 * Spielstand der Web-App in die Bytes, die das ROM im Prüfmodus ausgibt.
 */
import type { Options } from '../../../../packages/engine/src/types';

export interface Variante {
  /** Kurzer Name im Testbericht. */
  name: string;
  /** Optionswerte für das ROM (Index je Option, wie in src/<spiel>.c). */
  snes: number[];
  /** Dieselben Optionen für die Web-App. */
  optionen: Options;
  /** Zahl der Plätze (Standard 2). */
  plaetze?: number;
}

export interface SpielAdapter<S, M> {
  /** Index in `spiele[]` (src/main.c). */
  nr: number;
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modul: any;
  varianten: Variante[];
  /** Zugbytes wie im ROM. */
  zug(stand: S, zug: M): number[];
  /** Erwartete Ausgabe von Spiel.ausgeben. */
  stand(stand: S): number[];
  /** Zufallspartien je Variante für den Regelvergleich. */
  partien: number;
  /** Höchste Rechenzeit der Bots in Bildern je Stufe (leicht, mittel, schwer). */
  botBilder: [number, number, number];
  /** Zusatzzüge wie isLegal, aber nicht in legalMoves (z. B. Würfel halten). */
  extra?: (stand: S) => M[];
  /** Partien Bot „schwer“ gegen Zufall und nötige Siege. */
  gegenZufall: [partien: number, siege: number];
}

export const KEIN = 0xff;
export const platz = (p: number | null | undefined) => (p === null || p === undefined ? KEIN : p);
