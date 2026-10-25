import { cardRank, sameValue, type BotDefinition, type CardId } from '@brett-und-blatt/engine';
import { last } from './common';
import { maxMovable } from './freecell';
import { rowOf } from './pyramid';
import { legalMoves } from './rules';
import type { Loc, SolitaireMove, SolitaireState } from './types';

/** Ist `move` die Umkehrung des letzten Zuges? Hin und her schieben bringt nichts. */
function undoesLast(state: SolitaireState, move: SolitaireMove): boolean {
  const lastMove = state.lastMove;
  return lastMove?.type === 'move' && move.type === 'move' && sameValue(lastMove.from, move.to) && sameValue(lastMove.to, move.from) && lastMove.count === move.count;
}

/**
 * Bewertet einen Zug mit Faustregeln. Der Bot sieht dabei nur, was auch ein
 * Mensch sieht – verdeckte Karten bleiben unbekannt.
 */
export function scoreMove(state: SolitaireState, move: SolitaireMove): number {
  if (undoesLast(state, move)) return -200;
  if (move.type === 'draw') return state.variant === 'spider' ? 0 : 2;
  if (move.type === 'recycle') return 1;

  if (move.type === 'pair' && state.variant === 'pyramid') {
    let score = 40;
    for (const loc of move.cards) score += loc.kind === 'pyramid' ? 30 + rowOf(loc.index) * 2 : 5;
    return score;
  }
  if (move.type !== 'move') return 0;

  if (move.to.kind === 'foundation') {
    const card = topCard(state, move.from);
    return 80 + (card && cardRank(card) <= 2 ? 40 : 0);
  }
  if (move.from.kind === 'foundation') return -40;

  if (state.variant === 'klondike' || state.variant === 'spider') {
    if (move.from.kind === 'waste') return 30;
    if (move.from.kind !== 'tableau' || move.to.kind !== 'tableau') return 0;
    const pile = state.tableau[move.from.index]!;
    const target = state.tableau[move.to.index]!;
    const exposes = move.count === pile.up.length && pile.down.length > 0;
    const targetEmpty = target.up.length === 0 && target.down.length === 0;
    if (exposes) return 60 + pile.down.length * 3;
    if (targetEmpty && pile.down.length === 0 && move.count === pile.up.length) return -100;
    if (state.variant === 'spider') {
      const bottom = pile.up[pile.up.length - move.count] as CardId;
      const top = last(target.up);
      const suited = top !== undefined && top[0] === bottom[0];
      const emptiesColumn = move.count === pile.up.length && pile.down.length === 0;
      return (suited ? 40 : 5) + (emptiesColumn ? 15 : 0) - (targetEmpty ? 20 : 0);
    }
    // Teilfolgen nur verschieben, wenn die Karte darunter dann auf eine Ablage kann.
    if (move.count < pile.up.length) {
      const below = pile.up[pile.up.length - move.count - 1];
      return below && cardRank(below) <= foundationNeed(state, below) ? 50 : -5;
    }
    return targetEmpty ? 0 : 10;
  }

  if (state.variant === 'freecell') {
    if (move.from.kind === 'cell') return 35;
    if (move.to.kind === 'cell') {
      const column = move.from.kind === 'tableau' ? state.tableau[move.from.index]! : [];
      const below = column[column.length - 2];
      return below && cardRank(below) <= foundationNeed(state, below) ? 40 : -5;
    }
    if (move.from.kind === 'tableau' && move.to.kind === 'tableau') {
      const target = state.tableau[move.to.index]!;
      const column = state.tableau[move.from.index]!;
      if (target.length === 0) return move.count === column.length ? -100 : 5 + move.count;
      return 20 + move.count * 2 - (move.count > maxMovable(state, false) ? 100 : 0);
    }
  }
  return 0;
}

function topCard(state: SolitaireState, loc: Loc): CardId | null {
  switch (loc.kind) {
    case 'tableau':
      if (state.variant === 'freecell') return last(state.tableau[loc.index] ?? []) ?? null;
      if (state.variant === 'klondike' || state.variant === 'spider') return last(state.tableau[loc.index]?.up ?? []) ?? null;
      return null;
    case 'waste':
      return state.variant === 'klondike' || state.variant === 'pyramid' ? (last(state.waste) ?? null) : null;
    case 'cell':
      return state.variant === 'freecell' ? (state.cells[loc.index] ?? null) : null;
    case 'foundation':
      return state.variant === 'klondike' || state.variant === 'freecell' ? (last(state.foundations[loc.index] ?? []) ?? null) : null;
  }
}

/** Welcher Rang wird auf der Ablage dieser Farbe als Nächstes gebraucht? */
function foundationNeed(state: SolitaireState, card: CardId): number {
  if (state.variant !== 'klondike' && state.variant !== 'freecell') return 0;
  const index = ['C', 'D', 'H', 'S'].indexOf(card[0] as string);
  return (state.foundations[index]?.length ?? 0) + 1;
}

/**
 * Standard-Bot und Tipp-Geber: wählt den Zug mit der besten Bewertung.
 * - leicht: oft ein zufälliger sinnvoller Zug
 * - mittel: meist der beste Zug
 * - schwer: immer der beste Zug
 */
export const solitaireBot: BotDefinition<SolitaireState, SolitaireMove> = {
  id: 'solitaire',
  name: 'Faustregeln',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const moves = legalMoves(ctx.view, ctx.seat);
    const scored = moves.map((move) => ({ move, score: scoreMove(ctx.view, move) }));
    const sensible = scored.filter((s) => s.score > 0);
    const randomness = ctx.level === 'easy' ? 0.5 : ctx.level === 'medium' ? 0.1 : 0;
    if (sensible.length > 0 && ctx.rng.chance(randomness)) return ctx.rng.pick(sensible).move;
    const best = Math.max(...scored.map((s) => s.score));
    return ctx.rng.pick(scored.filter((s) => s.score === best)).move;
  },
};

