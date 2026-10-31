/**
 * Hilfen für Chronik, Rückblick, Trophäenecken und Schachanzeige im Vierer-Schach.
 * Alles wird aus dem öffentlichen Spielstand berechnet – ohne Änderung der Regeln.
 */
import { applyAction, attackers, COLORS, enemiesOf, findKing, newGame, type Color, type FourChessState, type LogEntry, type PieceType } from '../legacy/engine';

export interface Trophy {
  /** Farbe und Art der geschlagenen Figur. */
  c: Color;
  t: PieceType;
  /** Tote (graue) Figur eines ausgeschiedenen Spielers – bringt keine Punkte. */
  dead?: boolean;
}

/** Wer hat welche Figuren geschlagen? (Ältere Spielstände ohne Angaben liefern leere Listen.) */
export function trophies(log: LogEntry[]): Record<Color, Trophy[]> {
  const out: Record<Color, Trophy[]> = { r: [], b: [], y: [], g: [] };
  for (const entry of log) {
    if (entry.type !== 'move' || !entry.color || !entry.captured) continue;
    out[entry.color].push(entry.captured);
  }
  return out;
}

/**
 * Stellungen nach jedem Logeintrag mit Aktion – für den Rückblick. Index = Index im Log.
 * Gibt null zurück, wenn der Spielstand aus einer Version ohne gespeicherte Aktionen stammt.
 */
export function replayStates(view: FourChessState): (FourChessState | null)[] | null {
  const log = view.log;
  if (log.some((e) => e.type === 'move' && !e.action)) return null;
  const state = newGame(view.mode);
  state.promo = view.promo;
  const states: (FourChessState | null)[] = [];
  for (const entry of log) {
    if (entry.action) {
      if (!applyAction(state, entry.action)) return null;
      states.push(structuredClone(state));
    } else {
      states.push(null);
    }
  }
  return states;
}

export interface CheckInfo {
  color: Color;
  king: number;
  attackers: { sq: number; c: Color; t: PieceType }[];
}

/** Alle aktiven Farben, deren König gerade angegriffen wird – mit den angreifenden Figuren. */
export function checks(state: FourChessState): CheckInfo[] {
  if (state.result) return [];
  const out: CheckInfo[] = [];
  for (const color of COLORS) {
    if (!state.active[color]) continue;
    const king = findKing(state.board, color);
    if (king < 0) continue;
    const found = attackers(state.board, king, enemiesOf(state, color));
    if (found.length) out.push({ color, king, attackers: found.map((a) => ({ sq: a.sq, c: a.piece.c, t: a.piece.t })) });
  }
  return out;
}
