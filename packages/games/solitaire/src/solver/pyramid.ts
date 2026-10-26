import { cardRank, type CardId } from '@brett-und-blatt/engine';
import { cardAt, isFree, PYRAMID_RECYCLES, rowOf, rowStart } from '../pyramid';
import type { PyramidLoc, PyramidState, SolitaireMove } from '../types';
import { Heap } from './heap';

/**
 * Löser für Pyramide mit voller Information: Er kennt alle 28 Pyramidenkarten
 * und die verbleibenden Karten im Talon.
 *
 * Sucht per Bestensuche nach einer Folge von Zügen, die die gesamte Pyramide
 * abräumt. Freie Könige werden als dominante Züge sofort entfernt.
 */

interface PyramidNode {
  /** 28 Bits: 1 = Karte liegt noch in der Pyramide, 0 = abgeräumt. */
  pyramidMask: number;
  stock: CardId[];
  waste: CardId[];
  recycles: number;
  parent: PyramidNode | null;
  move: SolitaireMove | null;
  /** Heuristik: Anzahl der noch in der Pyramide liegenden Karten. */
  h: number;
}

function countBits(n: number): number {
  let count = 0;
  let v = n;
  while (v > 0) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}

/** Prüft anhand der Bitmaske, ob eine Karte in der Pyramide frei ist. */
function isMaskFree(mask: number, index: number): boolean {
  if ((mask & (1 << index)) === 0) return false;
  const row = rowOf(index);
  if (row === 6) return true;
  const below = rowStart(row + 1) + (index - rowStart(row));
  const leftBelow = (mask & (1 << below)) !== 0;
  const rightBelow = (mask & (1 << (below + 1))) !== 0;
  return !leftBelow && !rightBelow;
}

function stateKey(node: PyramidNode): string {
  return `${node.pyramidMask}#${node.stock.length}#${node.waste.slice(-4).join(',')}#${node.recycles}`;
}

export interface SolveResult {
  moves: SolitaireMove[] | null;
  nodesSearched: number;
}

export function solvePyramid(state: PyramidState, options: { maxNodes?: number } = {}): SolveResult {
  const maxNodes = options.maxNodes ?? 30_000;

  // Initiale 28-Bit-Maske: alle Karten vorhanden
  let initialMask = 0;
  for (let i = 0; i < 28; i++) {
    if (state.pyramid[i] !== null && state.pyramid[i] !== undefined) {
      initialMask |= 1 << i;
    }
  }

  const initialNode: PyramidNode = {
    pyramidMask: initialMask,
    stock: state.stock.filter((c): c is CardId => c !== null),
    waste: [...state.waste],
    recycles: state.recycles,
    parent: null,
    move: null,
    h: countBits(initialMask),
  };

  /** Dominante Züge: Freie Könige sofort abräumen. */
  function reduceKings(node: PyramidNode): { node: PyramidNode; moves: SolitaireMove[] } {
    let current = node;
    const addedMoves: SolitaireMove[] = [];
    let progress = true;

    while (progress) {
      progress = false;
      // Freie Könige in der Pyramide
      for (let i = 0; i < 28; i++) {
        if (isMaskFree(current.pyramidMask, i)) {
          const card = state.pyramid[i];
          if (card && cardRank(card) === 13) {
            const nextMask = current.pyramidMask & ~(1 << i);
            const move: SolitaireMove = { type: 'pair', cards: [{ kind: 'pyramid', index: i }] };
            addedMoves.push(move);
            current = {
              ...current,
              pyramidMask: nextMask,
              h: countBits(nextMask),
            };
            progress = true;
            break;
          }
        }
      }

      // König oben auf dem Waste
      if (!progress && current.waste.length > 0) {
        const topWaste = current.waste[current.waste.length - 1]!;
        if (cardRank(topWaste) === 13) {
          const nextWaste = current.waste.slice(0, -1);
          const move: SolitaireMove = { type: 'pair', cards: [{ kind: 'waste' }] };
          addedMoves.push(move);
          current = {
            ...current,
            waste: nextWaste,
          };
          progress = true;
        }
      }
    }

    return { node: current, moves: addedMoves };
  }

  const reducedStart = reduceKings(initialNode);
  let startNode = reducedStart.node;
  for (const m of reducedStart.moves) {
    startNode = { ...startNode, parent: startNode.parent ?? initialNode, move: m };
  }

  if (startNode.pyramidMask === 0) {
    return { moves: reducedStart.moves, nodesSearched: 1 };
  }

  const heap = new Heap<PyramidNode>();
  heap.push(startNode);

  const seen = new Set<string>();
  seen.add(stateKey(startNode));

  let nodesSearched = 0;

  while (heap.size > 0 && nodesSearched < maxNodes) {
    const current = heap.pop()!;
    nodesSearched++;

    if (current.pyramidMask === 0) {
      const moves: SolitaireMove[] = [];
      let step: PyramidNode | null = current;
      while (step && step.move) {
        moves.unshift(step.move);
        step = step.parent;
      }
      return { moves, nodesSearched };
    }

    const freeIndices: number[] = [];
    for (let i = 0; i < 28; i++) {
      if (isMaskFree(current.pyramidMask, i)) {
        freeIndices.push(i);
      }
    }

    const branches: { node: PyramidNode; move: SolitaireMove }[] = [];

    // 1. Paare zwischen zwei freien Pyramidenkarten (Summe 13)
    for (let i = 0; i < freeIndices.length; i++) {
      const idxA = freeIndices[i]!;
      const cardA = state.pyramid[idxA]!;
      const rankA = cardRank(cardA);
      for (let j = i + 1; j < freeIndices.length; j++) {
        const idxB = freeIndices[j]!;
        const cardB = state.pyramid[idxB]!;
        if (rankA + cardRank(cardB) === 13) {
          const nextMask = current.pyramidMask & ~(1 << idxA) & ~(1 << idxB);
          branches.push({
            node: {
              pyramidMask: nextMask,
              stock: current.stock,
              waste: current.waste,
              recycles: current.recycles,
              parent: current,
              move: { type: 'pair', cards: [{ kind: 'pyramid', index: idxA }, { kind: 'pyramid', index: idxB }] },
              h: countBits(nextMask),
            },
            move: { type: 'pair', cards: [{ kind: 'pyramid', index: idxA }, { kind: 'pyramid', index: idxB }] },
          });
        }
      }
    }

    // 2. Paar zwischen freier Pyramidenkarte und Waste-Top
    if (current.waste.length > 0) {
      const topWaste = current.waste[current.waste.length - 1]!;
      const rankW = cardRank(topWaste);
      for (const idx of freeIndices) {
        const cardP = state.pyramid[idx]!;
        if (rankW + cardRank(cardP) === 13) {
          const nextMask = current.pyramidMask & ~(1 << idx);
          const nextWaste = current.waste.slice(0, -1);
          branches.push({
            node: {
              pyramidMask: nextMask,
              stock: current.stock,
              waste: nextWaste,
              recycles: current.recycles,
              parent: current,
              move: { type: 'pair', cards: [{ kind: 'pyramid', index: idx }, { kind: 'waste' }] },
              h: countBits(nextMask),
            },
            move: { type: 'pair', cards: [{ kind: 'pyramid', index: idx }, { kind: 'waste' }] },
          });
        }
      }
    }

    // 3. Draw (vom Stock auf Waste)
    if (current.stock.length > 0) {
      const nextStock = current.stock.slice(0, -1);
      const drawnCard = current.stock[current.stock.length - 1]!;
      const nextWaste = [...current.waste, drawnCard];
      branches.push({
        node: {
          pyramidMask: current.pyramidMask,
          stock: nextStock,
          waste: nextWaste,
          recycles: current.recycles,
          parent: current,
          move: { type: 'draw' },
          h: current.h,
        },
        move: { type: 'draw' },
      });
    }

    // 4. Recycle (Waste zurück auf Stock)
    if (current.stock.length === 0 && current.waste.length > 0 && current.recycles < PYRAMID_RECYCLES) {
      branches.push({
        node: {
          pyramidMask: current.pyramidMask,
          stock: [...current.waste].reverse(),
          waste: [],
          recycles: current.recycles + 1,
          parent: current,
          move: { type: 'recycle' },
          h: current.h,
        },
        move: { type: 'recycle' },
      });
    }

    for (const b of branches) {
      const { node: reducedNode, moves: kingMoves } = reduceKings(b.node);
      let finalNode = reducedNode;
      if (kingMoves.length > 0) {
        let parentStep = b.node;
        for (const km of kingMoves) {
          finalNode = { ...finalNode, parent: parentStep, move: km };
          parentStep = finalNode;
        }
      }

      const key = stateKey(finalNode);
      if (!seen.has(key)) {
        seen.add(key);
        heap.push(finalNode);
      }
    }
  }

  return { moves: null, nodesSearched };
}
