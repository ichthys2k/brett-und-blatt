import { cardRank, cardSuit, type CardId } from '@brett-und-blatt/engine';
import { clonePiles, flipIfNeeded, isSuitedRun, last } from '../common';
import type { Pile, SolitaireMove, SpiderState } from '../types';
import { Heap } from './heap';

/**
 * Löser für Spider mit voller Information: Er kennt alle verdeckten Karten
 * und die genaue Reihenfolge des Talons.
 *
 * Sucht per Bestensuche nach einer Zugfolge zum vollständigen Abräumen
 * aller 8 Farbreihen (König bis Ass).
 */

interface SpiderNode {
  tableau: Pile[];
  stock: CardId[];
  completedCount: number;
  parent: SpiderNode | null;
  move: SolitaireMove | null;
  h: number;
}

function removeCompletedInNode(tableau: Pile[]): number {
  let count = 0;
  for (let i = 0; i < tableau.length; i++) {
    const pile = tableau[i]!;
    if (pile.up.length >= 13) {
      const top13 = pile.up.slice(-13);
      if (cardRank(top13[0] as CardId) === 13 && isSuitedRun(top13)) {
        pile.up = pile.up.slice(0, -13);
        const { pile: flipped } = flipIfNeeded(pile);
        tableau[i] = flipped;
        count++;
      }
    }
  }
  return count;
}

function heuristic(tableau: Pile[], completedCount: number): number {
  let score = (8 - completedCount) * 500;
  for (const pile of tableau) {
    score += pile.down.length * 20;
    // Gleichfarbige Folgen belohnen
    for (let i = 1; i < pile.up.length; i++) {
      const prev = pile.up[i - 1] as CardId;
      const curr = pile.up[i] as CardId;
      if (cardRank(prev) === cardRank(curr) + 1) {
        score -= cardSuit(prev) === cardSuit(curr) ? 12 : 3;
      }
    }
  }
  return score;
}

function stateKey(node: SpiderNode): string {
  const p = node.tableau.map((pile) => `${pile.down.length}:${pile.up.join(',')}`).join('|');
  return `${p}#${node.stock.length}#${node.completedCount}`;
}

export interface SpiderSolveResult {
  moves: SolitaireMove[] | null;
  nodesSearched: number;
}

export function solveSpider(state: SpiderState, options: { maxNodes?: number } = {}): SpiderSolveResult {
  const maxNodes = options.maxNodes ?? 25_000;

  const initialTableau = clonePiles(state.tableau);
  const extraCompleted = removeCompletedInNode(initialTableau);
  const completedCount = state.completed.length + extraCompleted;

  const startNode: SpiderNode = {
    tableau: initialTableau,
    stock: state.stock.filter((c): c is CardId => c !== null),
    completedCount,
    parent: null,
    move: null,
    h: heuristic(initialTableau, completedCount),
  };

  if (startNode.completedCount === 8) {
    return { moves: [], nodesSearched: 1 };
  }

  const heap = new Heap<SpiderNode>();
  heap.push(startNode);

  const seen = new Set<string>();
  seen.add(stateKey(startNode));

  let nodesSearched = 0;

  while (heap.size > 0 && nodesSearched < maxNodes) {
    const current = heap.pop()!;
    nodesSearched++;

    if (current.completedCount === 8) {
      const moves: SolitaireMove[] = [];
      let step: SpiderNode | null = current;
      while (step && step.move) {
        moves.unshift(step.move);
        step = step.parent;
      }
      return { moves, nodesSearched };
    }

    const branches: { tableau: Pile[]; stock: CardId[]; completedCount: number; move: SolitaireMove }[] = [];

    // 1. Züge zwischen Tableaus
    current.tableau.forEach((pile, fromIdx) => {
      for (let count = 1; count <= pile.up.length; count++) {
        const run = pile.up.slice(-count);
        if (!isSuitedRun(run)) break;
        const bottom = run[0] as CardId;
        let emptyTaken = false;

        current.tableau.forEach((target, toIdx) => {
          if (toIdx === fromIdx) return;
          const top = last(target.up);

          if (target.up.length === 0 && target.down.length === 0) {
            if (emptyTaken || (count === pile.up.length && pile.down.length === 0)) return;
            emptyTaken = true;

            const nextTableau = clonePiles(current.tableau);
            const fromPile = nextTableau[fromIdx]!;
            const cards = fromPile.up.slice(-count);
            fromPile.up = fromPile.up.slice(0, -count);
            const { pile: flipped } = flipIfNeeded(fromPile);
            nextTableau[fromIdx] = flipped;
            nextTableau[toIdx]!.up.push(...cards);

            const newlyCompleted = removeCompletedInNode(nextTableau);
            branches.push({
              tableau: nextTableau,
              stock: current.stock,
              completedCount: current.completedCount + newlyCompleted,
              move: { type: 'move', from: { kind: 'tableau', index: fromIdx }, to: { kind: 'tableau', index: toIdx }, count },
            });
          } else if (top !== undefined && cardRank(top) === cardRank(bottom) + 1) {
            const nextTableau = clonePiles(current.tableau);
            const fromPile = nextTableau[fromIdx]!;
            const cards = fromPile.up.slice(-count);
            fromPile.up = fromPile.up.slice(0, -count);
            const { pile: flipped } = flipIfNeeded(fromPile);
            nextTableau[fromIdx] = flipped;
            nextTableau[toIdx]!.up.push(...cards);

            const newlyCompleted = removeCompletedInNode(nextTableau);
            branches.push({
              tableau: nextTableau,
              stock: current.stock,
              completedCount: current.completedCount + newlyCompleted,
              move: { type: 'move', from: { kind: 'tableau', index: fromIdx }, to: { kind: 'tableau', index: toIdx }, count },
            });
          }
        });
      }
    });

    // 2. Draw (Austeilen von 10 Karten, wenn keine Spalte leer ist)
    if (current.stock.length >= 10 && current.tableau.every((p) => p.up.length + p.down.length > 0)) {
      const nextTableau = clonePiles(current.tableau);
      const deal = current.stock.slice(-10) as CardId[];
      const nextStock = current.stock.slice(0, -10);
      deal.reverse().forEach((card, i) => nextTableau[i]!.up.push(card));
      const newlyCompleted = removeCompletedInNode(nextTableau);
      branches.push({
        tableau: nextTableau,
        stock: nextStock,
        completedCount: current.completedCount + newlyCompleted,
        move: { type: 'draw' },
      });
    }

    for (const b of branches) {
      const node: SpiderNode = {
        tableau: b.tableau,
        stock: b.stock,
        completedCount: b.completedCount,
        parent: current,
        move: b.move,
        h: heuristic(b.tableau, b.completedCount),
      };
      const key = stateKey(node);
      if (!seen.has(key)) {
        seen.add(key);
        heap.push(node);
      }
    }
  }

  return { moves: null, nodesSearched };
}
