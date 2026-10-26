import type { Rng } from '@brett-und-blatt/engine';
import { setupFreeCell } from './freecell';
import { setupKlondike } from './klondike';
import { setupPyramid } from './pyramid';
import { solveFreeCell } from './solver/freecell';
import { solveKlondike } from './solver/klondike';
import { solvePyramid } from './solver/pyramid';
import { solveSpider } from './solver/spider';
import { setupSpider } from './spider';
import type { FreeCellState, KlondikeState, PyramidState, SolitaireState, SpiderState } from './types';

/**
 * „Nur lösbare Spiele“: Es wird so lange neu gemischt, bis der Löser eine Lösung
 * findet. Damit das Austeilen aus dem Seed immer gleich ausfällt, zählt nur ein
 * Knotenlimit, keine Uhr. Findet der Löser in diesem Rahmen nichts, gilt die
 * Partie als unlösbar, auch wenn sie es vielleicht nicht ist – ausgeteilt wird
 * also nur, was sicher lösbar ist.
 */
const MAX_NODES = 30_000;
/** Nach so vielen Versuchen wird das letzte Spiel genommen (praktisch nie nötig). */
const MAX_ATTEMPTS = 40;

/**
 * Die Spielleitung rechnet bei „Zug zurück“ und beim Fortsetzen den Spielstand aus
 * dem Seed neu aus. Die letzten Ergebnisse bleiben deshalb gespeichert.
 */
const cache = new Map<string, SolitaireState>();

function remember<S extends SolitaireState>(key: string, state: S): S {
  cache.set(key, state);
  if (cache.size > 16) cache.delete(cache.keys().next().value as string);
  return state;
}

export function solvableKlondike(rng: Rng, draw: 1 | 3, seed: string): KlondikeState {
  const key = `klondike/${draw}/${seed}`;
  const known = cache.get(key);
  if (known) return known as KlondikeState;
  let state = setupKlondike(rng, draw);
  for (let attempt = 1; attempt < MAX_ATTEMPTS && !solveKlondike(state, { maxNodes: MAX_NODES }).moves; attempt++) state = setupKlondike(rng, draw);
  return remember(key, state);
}

export function solvableFreeCell(rng: Rng, seed: string): FreeCellState {
  const key = `freecell/${seed}`;
  const known = cache.get(key);
  if (known) return known as FreeCellState;
  const solvable = (state: FreeCellState) => solveFreeCell(state, { timeBudgetMs: 1, now: () => 0, maxNodes: MAX_NODES }).moves !== null;
  let state = setupFreeCell(rng);
  for (let attempt = 1; attempt < MAX_ATTEMPTS && !solvable(state); attempt++) state = setupFreeCell(rng);
  return remember(key, state);
}

export function solvablePyramid(rng: Rng, seed: string): PyramidState {
  const key = `pyramid/${seed}`;
  const known = cache.get(key);
  if (known) return known as PyramidState;
  let state = setupPyramid(rng);
  for (let attempt = 1; attempt < MAX_ATTEMPTS && !solvePyramid(state, { maxNodes: MAX_NODES }).moves; attempt++) state = setupPyramid(rng);
  return remember(key, state);
}

export function solvableSpider(rng: Rng, suits: 1 | 2 | 4, seed: string): SpiderState {
  const key = `spider/${suits}/${seed}`;
  const known = cache.get(key);
  if (known) return known as SpiderState;
  let state = setupSpider(rng, suits);
  for (let attempt = 1; attempt < MAX_ATTEMPTS && !solveSpider(state, { maxNodes: MAX_NODES }).moves; attempt++) state = setupSpider(rng, suits);
  return remember(key, state);
}
