/**
 * Logik und lokale Speicherung für die Tischwerkzeuge („Spielhelfer“ #106).
 * Alles läuft rein lokal im Browser und nutzt für Zufallszahlen nach Möglichkeit crypto.getRandomValues.
 */

export type HelperTool = 'wuerfel' | 'zufall' | 'startspieler' | 'uhren' | 'punkte';

export type DieKind = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'custom';

export interface DieSpec {
  id: DieKind;
  label: string;
  sides: number;
}

export const STANDARD_DICE: readonly DieSpec[] = [
  { id: 'd4', label: 'W4', sides: 4 },
  { id: 'd6', label: 'W6', sides: 6 },
  { id: 'd8', label: 'W8', sides: 8 },
  { id: 'd10', label: 'W10', sides: 10 },
  { id: 'd12', label: 'W12', sides: 12 },
  { id: 'd20', label: 'W20', sides: 20 },
];

export interface DieResult {
  id: number;
  kind: DieKind;
  /** Angezeigter Wert (Zahl als Text oder eigenes Symbol/Farbe). */
  label: string;
  /** Numerischer Wert bei Zahlenwürfeln (sonst null). */
  numeric: number | null;
  held: boolean;
}

export interface DiceHistoryEntry {
  id: number;
  kindLabel: string;
  values: string[];
  sum: number | null;
  at: number;
}

export interface CustomDicePreset {
  id: string;
  name: string;
  faces: string;
}

export const CUSTOM_DICE_PRESETS: readonly CustomDicePreset[] = [
  { id: 'colors', name: 'Farben', faces: '🔴, 🔵, 🟢, 🟡, 🟣, 🟠' },
  { id: 'arrows', name: 'Richtungen', faces: '⬆️, ➡️, ⬇️, ⬅️' },
  { id: 'yesno', name: 'Ja / Nein', faces: 'Ja, Nein, Vielleicht' },
  { id: 'symbols', name: 'Schere/Stein/Papier', faces: '🪨, 📄, ✂️' },
];

/** Erzeugt eine gleichverteilte ganze Zufallszahl zwischen `min` und `max` (einschließlich). */
export function randomInt(min: number, max: number, rng?: () => number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  const span = hi - lo + 1;
  if (span <= 1) return lo;

  if (rng) {
    return lo + Math.floor(rng() * span);
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const limit = Math.floor(0x100000000 / span) * span;
    const buf = new Uint32Array(1);
    while (true) {
      globalThis.crypto.getRandomValues(buf);
      const val = buf[0]!;
      if (val < limit) return lo + (val % span);
    }
  }

  return lo + Math.floor(Math.random() * span);
}

/** Mischt eine Liste nach Fisher-Yates ohne das Original zu verändern. */
export function shuffleItems<T>(items: readonly T[], rng?: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i, rng);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Zerlegt eine Eingabe für eigene Würfelseiten (Komma, Semikolon oder Zeilenumbruch; sonst Leerzeichen). */
export function parseCustomFaces(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return ['1', '2', '3', '4', '5', '6'];
  const sep = /[,;\n]/.test(trimmed) ? /[,;\n]+/ : /\s+/;
  const parts = trimmed
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);
  return parts.length > 0 ? parts : ['1', '2', '3', '4', '5', '6'];
}

/** Zerlegt eine Namens- oder Eintragsliste (Zeilen oder Kommas, ohne leere Einträge). */
export function parseEntryList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Würfelt einen Satz Würfel neu; gehaltene Würfel bleiben unverändert. */
export function rollDiceSet(
  current: readonly DieResult[],
  count: number,
  kind: DieKind,
  customFaces: readonly string[],
  rng?: () => number,
): DieResult[] {
  const clamped = Math.max(1, Math.min(10, Math.round(count)));
  const spec = STANDARD_DICE.find((d) => d.id === kind);
  const faces = customFaces.length > 0 ? customFaces : ['1', '2', '3', '4', '5', '6'];

  const rollOne = (id: number): DieResult => {
    if (kind === 'custom') {
      const face = faces[randomInt(0, faces.length - 1, rng)]!;
      const maybeNum = Number(face);
      return {
        id,
        kind,
        label: face,
        numeric: face !== '' && Number.isFinite(maybeNum) ? maybeNum : null,
        held: false,
      };
    }
    const sides = spec?.sides ?? 6;
    const val = randomInt(1, sides, rng);
    return {
      id,
      kind,
      label: String(val),
      numeric: val,
      held: false,
    };
  };

  const next: DieResult[] = [];
  for (let i = 0; i < clamped; i++) {
    const prev = current[i];
    if (prev && prev.held && prev.kind === kind) {
      next.push(prev);
    } else {
      next.push(rollOne(i + 1));
    }
  }
  return next;
}

/** Summiert alle numerischen Würfel eines Wurfs (null, wenn kein Würfel numerisch ist). */
export function sumNumericDice(dice: readonly DieResult[]): number | null {
  let sum = 0;
  let hasNumeric = false;
  for (const d of dice) {
    if (d.numeric !== null) {
      sum += d.numeric;
      hasNumeric = true;
    }
  }
  return hasNumeric ? sum : null;
}

/** Verteilt Namen zufällig und möglichst gleichmäßig auf `teamCount` Teams. */
export function splitIntoTeams(names: readonly string[], teamCount: number, rng?: () => number): string[][] {
  const count = Math.max(2, Math.min(6, Math.round(teamCount)));
  const teams: string[][] = Array.from({ length: count }, () => []);
  const shuffled = shuffleItems(names, rng);
  shuffled.forEach((name, idx) => {
    teams[idx % count]!.push(name);
  });
  return teams;
}

export interface ScorePlayer {
  id: string;
  name: string;
}

export interface ScoreRound {
  id: number;
  scores: Record<string, number>;
}

export interface ScoreRankingEntry {
  player: ScorePlayer;
  total: number;
  rank: number;
}

/** Berechnet Gesamtpunkte je Spieler über alle Runden. */
export function computeScoreTotals(players: readonly ScorePlayer[], rounds: readonly ScoreRound[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of players) totals[p.id] = 0;
  for (const r of rounds) {
    for (const p of players) {
      totals[p.id] = (totals[p.id] ?? 0) + (r.scores[p.id] ?? 0);
    }
  }
  return totals;
}

/** Sortiert Spieler nach Gesamtpunkten mit sauberer Gleichstands-Platzierung (1, 1, 3 ...). */
export function rankScorePlayers(
  players: readonly ScorePlayer[],
  totals: Record<string, number>,
  order: 'desc' | 'asc' = 'desc',
): ScoreRankingEntry[] {
  const sorted = [...players].sort((a, b) => {
    const diff = (totals[a.id] ?? 0) - (totals[b.id] ?? 0);
    return order === 'desc' ? -diff : diff;
  });

  const result: ScoreRankingEntry[] = [];
  let prevTotal: number | null = null;
  let prevRank = 1;
  sorted.forEach((player, idx) => {
    const total = totals[player.id] ?? 0;
    const rank = prevTotal !== null && total === prevTotal ? prevRank : idx + 1;
    prevTotal = total;
    prevRank = rank;
    result.push({ player, total, rank });
  });
  return result;
}

/** Formatiert Millisekunden als mm:ss (aufgerundet auf ganze Sekunden, mindestens 00:00). */
export function formatCountdownMs(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSec = Math.ceil(clamped / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Sicheres Laden aus localStorage mit Fallback. */
export function loadHelperState<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`brett-und-blatt:helfer:${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Sicheres Schreiben in localStorage. */
export function saveHelperState<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(`brett-und-blatt:helfer:${key}`, JSON.stringify(value));
  } catch {
    // Speicher voll oder blockiert – Werkzeug läuft trotzdem weiter.
  }
}
