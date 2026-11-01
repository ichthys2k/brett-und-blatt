import type { BotContext, BotDefinition, BotLevel, SeatId } from '@brett-und-blatt/engine';
import {
  GOAL_LENGTH,
  trackLengthOf,
  legalMoves,
  startTrackIndex,
  toAbsoluteTrackIndex,
  type LudoMove,
  type LudoState,
} from './rules';

/**
 * Berechnet den kleinsten Vorwärtsabstand auf dem Ring von 'from' nach 'to'.
 */
function trackDistance(from: number, to: number, length: number): number {
  return (to - from + length) % length;
}

/**
 * Ermittelt, ob eine Figur auf einem absoluten Feld 'pos' von mindestens einem
 * gegnerischen Stein im Abstand 1..6 bedroht wird.
 */
function isThreatened(pos: number, state: LudoState, ownSeat: SeatId): boolean {
  for (let s = 0; s < state.seats; s++) {
    if (s === ownSeat) continue;
    for (const p of state.pieces[s]) {
      if (p.area === 'track') {
        const oppPos = toAbsoluteTrackIndex(s, p.index, state.seats, state.board);
        const dist = trackDistance(oppPos, pos, trackLengthOf(state.board));
        if (dist >= 1 && dist <= 6) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Bewertet einen Zug für den schweren Bot.
 */
function evaluateMove(state: LudoState, seat: SeatId, move: LudoMove): number {
  if (move.type === 'roll') return 10;
  if (move.type === 'pass') return 0;

  const pieceIdx = move.pieceIndex;
  const piece = state.pieces[seat][pieceIdx];
  const dice = state.dice ?? 1;

  let score = 50;

  // 1. Aus dem Haus kommen
  if (piece.area === 'home') {
    score += 450;
    const startAbs = startTrackIndex(seat, state.seats, state.board);
    // Schlägt es direkt auf Start?
    for (let s = 0; s < state.seats; s++) {
      if (s === seat) continue;
      for (const opp of state.pieces[s]) {
        if (opp.area === 'track' && toAbsoluteTrackIndex(s, opp.index, state.seats, state.board) === startAbs) {
          score += 250;
        }
      }
    }
    return score;
  }

  // 2. Startfeld freimachen
  if (piece.area === 'track' && piece.index === 0) {
    const hasMoreInHome = state.pieces[seat].some((p) => p.area === 'home');
    if (hasMoreInHome) {
      score += 350;
    }
  }

  // 3. Auf der Strecke
  if (piece.area === 'track') {
    const fromAbs = toAbsoluteTrackIndex(seat, piece.index, state.seats, state.board);
    const wasThreatened = isThreatened(fromAbs, state, seat);

    const nextStep = piece.index + dice;

    if (nextStep >= trackLengthOf(state.board)) {
      // Zieht ins sichere Ziel
      const goalSlot = Math.min(GOAL_LENGTH - 1, nextStep - trackLengthOf(state.board));
      score += 300 + goalSlot * 20;

      // Letzter Stein ins Ziel = Sieg!
      const otherInGoal = state.pieces[seat].filter((p, i) => i !== pieceIdx && p.area === 'goal').length;
      if (otherInGoal === 3) {
        score += 5000;
      }
    } else {
      // Zieht auf der Strecke vor
      const toAbs = toAbsoluteTrackIndex(seat, nextStep, state.seats, state.board);

      // Gegner schlagen?
      let capturedOpponentProgress = 0;
      for (let s = 0; s < state.seats; s++) {
        if (s === seat) continue;
        for (const opp of state.pieces[s]) {
          if (opp.area === 'track') {
            const oppAbs = toAbsoluteTrackIndex(s, opp.index, state.seats, state.board);
            if (oppAbs === toAbs) {
              capturedOpponentProgress = Math.max(capturedOpponentProgress, opp.index);
            }
          }
        }
      }

      if (capturedOpponentProgress > 0) {
        score += 400 + capturedOpponentProgress * 5;
      }

      // Gefahrenbewertung am Zielfeld
      const willBeThreatened = isThreatened(toAbs, state, seat);
      if (wasThreatened && !willBeThreatened) {
        score += 150; // Flucht geglückt
      } else if (!wasThreatened && willBeThreatened) {
        score -= 100; // Gefahr gelaufen
      }

      // Streckenfortschritt belohnen
      score += nextStep * 3;
    }
  } else if (piece.area === 'goal') {
    // Im Ziel weiter nach hinten rücken
    score += 80 + (piece.index + dice) * 20;
  }

  return score;
}

export function chooseLudoMove(ctx: BotContext<LudoState, LudoMove, LudoState>): LudoMove {
  const { view: state, seat, level, rng } = ctx;
  const moves = legalMoves(state, seat);
  if (moves.length === 0) {
    throw new Error('Kein legaler Zug vorhanden');
  }
  if (moves.length === 1) {
    return moves[0];
  }

  if (level === 'easy') {
    // Zieht zufällig
    const idx = Math.floor(rng.next() * moves.length);
    return moves[idx];
  }

  if (level === 'medium') {
    // Einfache Priorität:
    // 1. Aus dem Haus
    const enterMove = moves.find((m) => m.type === 'move' && state.pieces[seat][m.pieceIndex].area === 'home');
    if (enterMove) return enterMove;

    // 2. Startfeld räumen
    const clearStart = moves.find(
      (m) =>
        m.type === 'move' &&
        state.pieces[seat][m.pieceIndex].area === 'track' &&
        state.pieces[seat][m.pieceIndex].index === 0,
    );
    if (clearStart) return clearStart;

    // 3. Am weitesten vorgerückte Figur ziehen
    let bestMove = moves[0];
    let bestProgress = -1;
    for (const m of moves) {
      if (m.type === 'move') {
        const p = state.pieces[seat][m.pieceIndex];
        if (p.index > bestProgress) {
          bestProgress = p.index;
          bestMove = m;
        }
      }
    }
    return bestMove;
  }

  // Stufe Schwer: Heuristische Bewertung mit leichtem Zufallsrauschen
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    const noise = (rng.next() - 0.5) * 10;
    const score = evaluateMove(state, seat, m) + noise;
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return bestMove;
}

export const ludoBot: BotDefinition<LudoState, LudoMove> = {
  id: 'ludo',
  name: 'Würfelmeister',
  levels: ['easy', 'medium', 'hard'],
  chooseMove: chooseLudoMove,
};
