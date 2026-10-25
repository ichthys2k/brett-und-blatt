import type { Rng } from '@brett-und-blatt/engine';
import { setupFreeCell } from './freecell';
import { setupKlondike } from './klondike';
import { solveFreeCell } from './solver/freecell';
import { solveKlondike } from './solver/klondike';
import type { FreeCellState, KlondikeState } from './types';

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
const cache = new Map<string, KlondikeState | FreeCellState>();

function remember<S extends KlondikeState | FreeCellState>(key: string, state: S): S {
  cache.set(key, state);
  if (cache.size > 8) cache.delete(cache.keys().next().value as string);
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
  // Die Uhr steht still: Nur das Knotenlimit entscheidet.
  const solvable = (state: FreeCellState) => solveFreeCell(state, { timeBudgetMs: 1, now: () => 0, maxNodes: MAX_NODES }).moves !== null;
  let state = setupFreeCell(rng);
  for (let attempt = 1; attempt < MAX_ATTEMPTS && !solvable(state); attempt++) state = setupFreeCell(rng);
  return remember(key, state);
}
