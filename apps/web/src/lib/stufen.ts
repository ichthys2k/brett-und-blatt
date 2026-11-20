import type { Progress, StatKey } from './unlocks';
import { fillText } from './unlocks';

/*
 * Stufen des Spielerpasses (Belohnungskonzept #324, Schritt #571): Aus den Zählern (`Progress`, nur gewertete Partien, #570)
 * wird die Stufe **abgeleitet** – nie gespeichert. Die Zähler wachsen nur, also sinkt die Stufe nie. Die Schwellen stehen
 * als Daten in `LEVELS` (Tabelle in Abschnitt 2 von `docs/spiele/belohnungen.md`, entschieden am 20.11.2026).
 * Reine Funktionen ohne Speicher und Oberfläche; die Anzeige im Pass kommt später (#573).
 */

/** Eine mögliche Erfüllung einer Zeile. */
export interface LevelOption {
  stat: StatKey;
  min: number;
  /** Vorlage für das Fehlende (`{n}`, `{n?Einzahl|Mehrzahl}`), z. B. „noch {n} {n?Partie|Partien}“. */
  text: string;
}

/** Eine Zeile der Stufenleiter: erfüllt, wenn **eine** der Optionen erreicht ist (meist gibt es nur eine). */
export interface LevelRow {
  /** Kurzer Name der Zeile für Listen. */
  label: string;
  options: readonly LevelOption[];
}

export interface Level {
  /** 0 = Neuling (nicht „Gast“: das ist der Pass ohne Aufzeichnung), 1 bis 4 wie in der Tabelle. */
  rank: number;
  title: string;
  /** Alle Zeilen müssen erfüllt sein; leer: von Anfang an. */
  rows: readonly LevelRow[];
}

const games = (label: string, stat: StatKey, min: number, text: string): LevelRow => ({ label, options: [{ stat, min, text }] });

const PARTIEN = 'noch {n} {n?Partie|Partien}';
const SPIELE = 'noch {n} {n?Spiel|Spiele} zum ersten Mal spielen';
const MITTEL = 'noch {n} {n?Spiel|Spiele} mit Sieg gegen einen mittleren oder schweren Bot';
const SCHWER = 'noch {n} {n?Spiel|Spiele} mit Sieg gegen einen schweren Bot';
const RUBRIK = 'noch {n} {n?Rubrik|Rubriken} komplett spielen';
const MENSCHEN = 'noch {n} {n?Partie|Partien} mit Menschen';
const LERNTAGE = 'noch {n} {n?Lerntag|Lerntage} im Karteikasten';

const together = (human: number, learn: number): LevelRow => ({
  label: 'Gemeinsam oder Lernen',
  options: [
    { stat: 'humanRated', min: human, text: MENSCHEN },
    { stat: 'learnDays', min: learn, text: LERNTAGE },
  ],
});

/** Die Stufenleiter: Neuling, Stammgast, Zunftmitglied, Meister, Hofrat. */
export const LEVELS: readonly Level[] = [
  { rank: 0, title: 'Neuling', rows: [] },
  { rank: 1, title: 'Stammgast', rows: [games('Partien', 'rated', 10, PARTIEN), games('Verschiedene Spiele', 'ratedGames', 3, SPIELE)] },
  {
    rank: 2,
    title: 'Zunftmitglied',
    rows: [
      games('Partien', 'rated', 40, PARTIEN),
      games('Verschiedene Spiele', 'ratedGames', 8, SPIELE),
      games('Sieg gegen mittel oder schwer', 'beatMediumGames', 1, MITTEL),
      together(5, 3),
    ],
  },
  {
    rank: 3,
    title: 'Meister',
    rows: [
      games('Partien', 'rated', 120, PARTIEN),
      games('Verschiedene Spiele', 'ratedGames', 20, SPIELE),
      games('Sieg gegen mittel oder schwer', 'beatMediumGames', 5, MITTEL),
      games('Sieg gegen schwer', 'beatHardGames', 1, SCHWER),
      games('Rubriken komplett', 'categoriesComplete', 1, RUBRIK),
      together(20, 10),
    ],
  },
  {
    rank: 4,
    title: 'Hofrat',
    rows: [
      games('Partien', 'rated', 500, PARTIEN),
      games('Verschiedene Spiele', 'ratedGames', 40, SPIELE),
      games('Sieg gegen mittel oder schwer', 'beatMediumGames', 15, MITTEL),
      games('Sieg gegen schwer', 'beatHardGames', 5, SCHWER),
      games('Rubriken komplett', 'categoriesComplete', 2, RUBRIK),
      together(60, 30),
    ],
  },
];

const rowDone = (row: LevelRow, progress: Progress): boolean => row.options.some((option) => progress[option.stat] >= option.min);
const levelDone = (level: Level, progress: Progress): boolean => level.rows.every((row) => rowDone(row, progress));

/**
 * Die Stufe aus den Zählern: die höchste, deren Zeilen (und die aller Stufen darunter) erfüllt sind.
 * Rein abgeleitet, nie gespeichert; da die Zähler nur wachsen, sinkt sie nie.
 */
export function levelOf(progress: Progress): Level {
  let reached = LEVELS[0]!;
  for (const level of LEVELS.slice(1)) {
    if (!levelDone(level, progress)) break;
    reached = level;
  }
  return reached;
}

/** Eine Zeile der nächsten Stufe: wo der Pass steht und was fehlt. */
export interface LevelGap {
  label: string;
  done: boolean;
  /** Stand und Ziel der Option, die am nächsten ist (bei erfüllter Zeile die erfüllte). */
  have: number;
  min: number;
  missing: number;
  /** Lesbar auch für Screenreader: „noch 3 Spiele zum ersten Mal spielen“ oder „geschafft“. Bei zwei Wegen beide: „… oder …“. */
  text: string;
}

export interface NextLevel {
  level: Level;
  gaps: readonly LevelGap[];
}

/** Was zur nächsten Stufe noch fehlt, je Zeile; `null` beim Hofrat. */
export function nextLevelGaps(progress: Progress): NextLevel | null {
  const current = levelOf(progress);
  const level = LEVELS[current.rank + 1];
  if (!level) return null;
  const gaps = level.rows.map((row): LevelGap => {
    const missingOf = (option: LevelOption) => Math.max(0, option.min - progress[option.stat]);
    const closest = [...row.options].sort((a, b) => missingOf(a) / a.min - missingOf(b) / b.min)[0]!;
    const done = rowDone(row, progress);
    const have = progress[closest.stat];
    const text = done ? 'geschafft' : row.options.map((option) => fillText(option.text, { have: progress[option.stat], min: option.min, n: missingOf(option) })).join(' oder ');
    return { label: row.label, done, have, min: closest.min, missing: missingOf(closest), text };
  });
  return { level, gaps };
}
