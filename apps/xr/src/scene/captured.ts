/**
 * Geschlagene Figuren (#390): Aus der Stellung ergibt sich, was fehlt. Reine Rechnung ohne
 * three.js, nur aus dem, was die Sicht offen nennt (Stellung, Steinzahlen).
 */

const CHESS_START: Record<string, number> = { q: 1, r: 2, b: 2, n: 2, p: 8 };
/** Reihenfolge der Anzeige: wertvollste zuerst. */
export const CHESS_ORDER = ['q', 'r', 'b', 'n', 'p'] as const;

export interface ChessLost {
  /** Fehlende weiße Figuren (vom Gegner geschlagen), z. B. ['r', 'p', 'p']. */
  white: string[];
  black: string[];
}

/** Fehlende Figuren je Farbe aus dem Stellungsteil einer FEN. Umwandlungen verdecken Bauern; es wird nie negativ gezählt. */
export function chessCaptured(fen: string): ChessLost {
  const counts: Record<'white' | 'black', Record<string, number>> = { white: {}, black: {} };
  for (const ch of (fen.split(' ')[0] ?? '').replace(/[0-9/]/g, '')) {
    const side = ch === ch.toUpperCase() ? 'white' : 'black';
    const type = ch.toLowerCase();
    counts[side][type] = (counts[side][type] ?? 0) + 1;
  }
  const lost = (side: 'white' | 'black'): string[] =>
    CHESS_ORDER.flatMap((type) => Array.from({ length: Math.max(0, (CHESS_START[type] ?? 0) - (counts[side][type] ?? 0)) }, () => type));
  return { white: lost('white'), black: lost('black') };
}

/** Zahl der Steine je Platz bei Spielbeginn (Dame: 8×8 → 12, 10×10 → 20). */
export function checkersStart(size: number): number {
  return (size / 2) * (size / 2 - 1);
}

/** Zahl der geschlagenen Steine je Platz (0 und 1). */
export function checkersCaptured(size: number, cells: ({ seat: number } | null)[]): [number, number] {
  const start = checkersStart(size);
  const left = [0, 0];
  for (const cell of cells) if (cell && (cell.seat === 0 || cell.seat === 1)) left[cell.seat]! += 1;
  return [Math.max(0, start - left[0]!), Math.max(0, start - left[1]!)];
}
