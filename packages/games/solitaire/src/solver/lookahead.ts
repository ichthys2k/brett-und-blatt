import { cardRank, cardSuit, type CardId } from '@brett-und-blatt/engine';
import { applyKlondike, klondikeMoves } from '../klondike';
import { applySpider, spiderMoves } from '../spider';
import type { KlondikeState, Pile, SolitaireMove, SpiderState } from '../types';

/**
 * Vorausschau für Klondike und Spider. Dort liegen Karten verdeckt, eine ganze
 * Lösung lässt sich also nicht ausrechnen. Stattdessen probiert die Suche alle
 * Zugfolgen mit den offenen Karten durch (ohne Talon) und sucht die, die am
 * meisten Fortschritt bringt: verdeckte Karten freilegen, Karten ablegen,
 * Spalten leeren, Farbfolgen bauen. Verdeckte Karten bleiben dabei unbekannt.
 */

type Open = KlondikeState | SpiderState;

/** Liegt hier eine verdeckte Karte frei, die beim echten Zug aufgedeckt würde? */
const revealable = (pile: Pile) => pile.up.length === 0 && pile.down.length > 0;
const isEmpty = (pile: Pile) => pile.up.length === 0 && pile.down.length === 0;

/** Wie gut ist eine Stellung? Größer ist besser. */
export function progress(state: Open): number {
  let score = 0;
  for (const pile of state.tableau) {
    if (revealable(pile)) score += 60;
    score -= pile.down.length * 60;
    if (isEmpty(pile)) score += state.variant === 'spider' ? 40 : 15;
  }
  if (state.variant === 'klondike') {
    for (const f of state.foundations) score += f.length * 12;
    score -= state.waste.length * 2;
    return score;
  }
  score += state.completed.length * 600;
  for (const pile of state.tableau) {
    // Zusammenhängende Folgen in einer Farbe sind der Weg zur fertigen Reihe.
    for (let i = 1; i < pile.up.length; i++) {
      const below = pile.up[i - 1] as CardId;
      const above = pile.up[i] as CardId;
      if (cardRank(below) === cardRank(above) + 1) score += cardSuit(below) === cardSuit(above) ? 8 : 2;
    }
  }
  return score;
}

function key(state: Open): string {
  const piles = state.tableau.map((p) => `${p.down.length}:${p.up.join(',')}`).join('|');
  return state.variant === 'klondike' ? `${piles}#${state.waste.length}#${state.foundations.map((f) => f.length).join(',')}` : `${piles}#${state.completed.length}`;
}

function movesOf(state: Open): SolitaireMove[] {
  const moves = state.variant === 'klondike' ? klondikeMoves(state) : spiderMoves(state);
  return moves.filter((m) => m.type === 'move');
}

function apply(state: Open, move: SolitaireMove): Open {
  return state.variant === 'klondike' ? applyKlondike(state, move).state : applySpider(state, move).state;
}

export interface Plan {
  move: SolitaireMove;
  /** Wie viel besser die Stellung am Ende des Plans ist. */
  gain: number;
  length: number;
}

/**
 * Sucht in der Breite (erst alle kurzen Zugfolgen, dann längere) und merkt sich
 * gesehene Stellungen. Eine Folge endet, sobald eine verdeckte Karte frei liegt –
 * was danach kommt, weiß niemand.
 */
export function bestPlan(view: Open, options: { timeBudgetMs: number; now?: () => number; maxNodes?: number }): Plan | null {
  const now = options.now ?? (() => Date.now());
  const deadline = now() + options.timeBudgetMs;
  const maxNodes = options.maxNodes ?? 20_000;
  const base = progress(view);
  const seen = new Set<string>([key(view)]);
  let frontier: { state: Open; first: SolitaireMove; length: number }[] = [];
  let best: Plan | null = null;
  const consider = (state: Open, first: SolitaireMove, length: number) => {
    // Kürzere Pläne leicht bevorzugen, damit der Tipp nicht unnötig umständlich ist.
    const gain = progress(state) - base - length;
    if (gain > 0 && (!best || gain > best.gain)) best = { move: first, gain, length };
  };
  for (const move of movesOf(view)) {
    const next = apply(view, move);
    const k = key(next);
    if (seen.has(k)) continue;
    seen.add(k);
    consider(next, move, 1);
    if (!next.tableau.some(revealable)) frontier.push({ state: next, first: move, length: 1 });
  }
  let nodes = 0;
  while (frontier.length > 0) {
    const nextFrontier: typeof frontier = [];
    for (const item of frontier) {
      if (++nodes > maxNodes || ((nodes & 31) === 0 && now() > deadline)) return best;
      for (const move of movesOf(item.state)) {
        const next = apply(item.state, move);
        const k = key(next);
        if (seen.has(k)) continue;
        seen.add(k);
        consider(next, item.first, item.length + 1);
        if (!next.tableau.some(revealable)) nextFrontier.push({ state: next, first: item.first, length: item.length + 1 });
      }
    }
    frontier = nextFrontier;
  }
  return best;
}
