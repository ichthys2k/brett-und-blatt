import type { BotDefinition } from '@brett-und-blatt/engine';
import {
  HIGHEST,
  LOWEST,
  START,
  cardId,
  colorOf,
  legalMoves,
  valueOf,
  type CardId,
  type ElevensMove,
  type ElevensState,
} from './rules';

/** Wie viele eigene Karten sich nach dieser Karte in derselben Richtung lückenlos anschließen. */
export function chainAfter(hand: Set<CardId>, card: CardId, state: ElevensState): number {
  const color = colorOf(card);
  const value = valueOf(card);
  const row = state.rows[color];
  // Eine Elf öffnet beide Richtungen.
  const directions = !row ? [-1, 1] : value < row.low ? [-1] : [1];
  let chain = 0;
  for (const dir of directions) {
    for (let v = value + dir; v >= LOWEST && v <= HIGHEST && hand.has(cardId(color, v)); v += dir) chain++;
  }
  return chain;
}

/**
 * Öffnet die Karte den anderen eine Reihe? Das ist der Fall, wenn hinter der eigenen Kette noch
 * Karten folgen, die wir nicht selbst halten.
 */
export function opensForOthers(hand: Set<CardId>, card: CardId, state: ElevensState): boolean {
  const color = colorOf(card);
  const value = valueOf(card);
  const row = state.rows[color];
  const directions = !row ? [-1, 1] : value < row.low ? [-1] : [1];
  return directions.some((dir) => {
    let v = value + dir;
    while (v >= LOWEST && v <= HIGHEST && hand.has(cardId(color, v))) v += dir;
    return v >= LOWEST && v <= HIGHEST;
  });
}

/** Abstand bis zur nächsten eigenen Karte hinter der Kette (20, wenn keine mehr folgt). */
export function gapToOwn(hand: Set<CardId>, card: CardId, state: ElevensState): number {
  const color = colorOf(card);
  const value = valueOf(card);
  const row = state.rows[color];
  const directions = !row ? [-1, 1] : value < row.low ? [-1] : [1];
  let best = 20;
  for (const dir of directions) {
    let v = value + dir;
    while (v >= LOWEST && v <= HIGHEST && hand.has(cardId(color, v))) v += dir;
    for (let gap = 1; v >= LOWEST && v <= HIGHEST; v += dir, gap++) {
      if (hand.has(cardId(color, v))) {
        best = Math.min(best, gap);
        break;
      }
    }
  }
  return best;
}

/**
 * Bot „Zahlenzwerg“:
 * - leicht legt zufällig und hört manchmal früh auf,
 * - mittel legt alles, was geht, und beginnt mit Karten, auf die eigene folgen,
 * - schwer hält Karten zurück, die nur den anderen eine Reihe öffnen würden, sobald er
 *   schon gelegt hat; muss er so eine Karte legen, nimmt er die, hinter der seine nächste
 *   eigene Karte am nächsten liegt.
 */
export const elevensBot: BotDefinition<ElevensState, ElevensMove> = {
  id: 'elevens',
  name: 'Zahlenzwerg',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    const moves = legalMoves(view, seat);
    const plays = moves.filter((m): m is Extract<ElevensMove, { type: 'play' }> => m.type === 'play');
    const end = moves.find((m) => m.type === 'end');
    if (plays.length === 0) return moves.find((m) => m.type === 'draw') ?? end ?? moves[0]!;

    if (level === 'easy') {
      if (end && rng.next() < 0.35) return end;
      return rng.pick(plays);
    }

    const hand = new Set(view.hands[seat] ?? []);
    const scored = plays.map((move) => {
      const chain = chainAfter(hand, move.card, view);
      const gift = opensForOthers(hand, move.card, view);
      // Elfen früh legen, wenn eigene Karten folgen; sonst die längste eigene Kette zuerst.
      // Muss eine Karte für die anderen her, dann die, hinter der unsere nächste Karte am nächsten liegt.
      const near = gift && level === 'hard' ? -gapToOwn(hand, move.card, view) : 0;
      const score = chain * 10 + (gift ? 0 : 5) + (valueOf(move.card) === START && chain > 0 ? 3 : 0) + near;
      return { move, chain, gift, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0]!;

    if (level === 'hard' && end && best.gift && best.chain === 0 && hand.size > 1) {
      // Nur noch Karten, die anderen helfen: Zug beenden.
      return end;
    }
    return best.move;
  },
};
