import { cardRank, createDeck, Rng, sameValue, type Actor, type CardId, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';
import { applyFreeCell, freeCellMoves, freeCellTrivial, freeCellWon, setupFreeCell } from './freecell';
import { applyKlondike, klondikeMoves, klondikeTrivial, klondikeWon, setupKlondike } from './klondike';
import { applyPyramid, pyramidMoves, pyramidWon, setupPyramid } from './pyramid';
import { solvableFreeCell, solvableKlondike } from './solvable';
import { applySpider, setupSpider, spiderMoves, spiderWon } from './spider';
import type { Pile, SolitaireMove, SolitaireState } from './types';

/** Danach endet eine Partie ohne Sieg – so laufen auch endlose Talon-Runden nicht ewig. */
export const MOVE_LIMIT = 1500;

export function setup(_seats: number, options: Options, seed: string): SolitaireState {
  const rng = Rng.fromSeed(seed, 'mischen');
  const solvable = options.solvable === 'yes';
  switch (options.variant) {
    case 'freecell':
      return solvable ? solvableFreeCell(rng, seed) : setupFreeCell(rng);
    case 'spider':
      return setupSpider(rng, options.spiderSuits === '4' ? 4 : options.spiderSuits === '2' ? 2 : 1);
    case 'pyramid':
      return setupPyramid(rng);
    default: {
      const draw = options.draw === '3' ? 3 : 1;
      return solvable ? solvableKlondike(rng, draw, seed) : setupKlondike(rng, draw);
    }
  }
}

/** Alle Züge der Variante – ohne zu prüfen, ob die Partie schon vorbei ist. */
function variantMoves(state: SolitaireState): SolitaireMove[] {
  switch (state.variant) {
    case 'klondike':
      return klondikeMoves(state);
    case 'freecell':
      return freeCellMoves(state);
    case 'spider':
      return spiderMoves(state);
    case 'pyramid':
      return pyramidMoves(state);
  }
}

export function isWon(state: SolitaireState): boolean {
  switch (state.variant) {
    case 'klondike':
      return klondikeWon(state);
    case 'freecell':
      return freeCellWon(state);
    case 'spider':
      return spiderWon(state);
    case 'pyramid':
      return pyramidWon(state);
  }
}

/** Liegt alles so, dass der Rest ohne Nachdenken auf die Ablagen geht? Dann übernimmt die Spielleitung. */
function canAutoComplete(state: SolitaireState): boolean {
  if (state.variant === 'klondike') return klondikeTrivial(state) && !klondikeWon(state);
  if (state.variant === 'freecell') return freeCellTrivial(state) && !freeCellWon(state);
  return false;
}

/** Der Systemzug der Automatik: die niedrigste Karte, die auf eine Ablage passt. */
function autoMove(state: SolitaireState): SolitaireMove | null {
  const candidates = variantMoves(state).filter((m) => m.type === 'move' && m.to.kind === 'foundation');
  const rankOf = (m: SolitaireMove): number => {
    if (m.type !== 'move') return 99;
    if (state.variant === 'klondike') {
      const card = m.from.kind === 'tableau' ? state.tableau[m.from.index]?.up.at(-1) : state.waste.at(-1);
      return card ? cardRank(card) : 99;
    }
    if (state.variant === 'freecell') {
      const card = m.from.kind === 'tableau' ? state.tableau[m.from.index]?.at(-1) : m.from.kind === 'cell' ? state.cells[m.from.index] : null;
      return card ? cardRank(card) : 99;
    }
    return 99;
  };
  return [...candidates].sort((a, b) => rankOf(a) - rankOf(b))[0] ?? null;
}

export function result(state: SolitaireState): Result | null {
  if (isWon(state)) return { kind: 'win', winners: [0] };
  if (state.moveCount >= MOVE_LIMIT) return { kind: 'loss', reason: 'moveLimit' };
  if (!canAutoComplete(state) && variantMoves(state).length === 0) return { kind: 'loss', reason: 'stuck' };
  return null;
}

export function currentPlayers(state: SolitaireState): Actor[] {
  if (result(state)) return [];
  return canAutoComplete(state) ? ['system'] : [0];
}

export function legalMoves(state: SolitaireState, actor: Actor): SolitaireMove[] {
  if (result(state)) return [];
  if (canAutoComplete(state)) {
    const move = actor === 'system' ? autoMove(state) : null;
    return move ? [move] : [];
  }
  return actor === 0 ? variantMoves(state) : [];
}

export function applyMove(state: SolitaireState, actor: Actor, move: SolitaireMove): MoveResult<SolitaireState> {
  if (!legalMoves(state, actor).some((m) => sameValue(m, move))) throw new Error('Dieser Zug ist nicht erlaubt.');
  let next: { state: SolitaireState; events: GameEvent[] };
  switch (state.variant) {
    case 'klondike':
      next = applyKlondike(state, move);
      break;
    case 'freecell':
      next = applyFreeCell(state, move);
      break;
    case 'spider':
      next = applySpider(state, move);
      break;
    case 'pyramid':
      next = applyPyramid(state, move);
      break;
  }
  const done: SolitaireState = { ...next.state, moveCount: state.moveCount + 1, lastMove: move };
  const events = isWon(done) ? [...next.events, { type: 'won' }] : next.events;
  return { state: done, events };
}

const hidePile = (pile: Pile): Pile => ({ down: pile.down.map(() => null), up: pile.up });

/** Verdeckte Karten und die Reihenfolge des Talons bleiben verborgen – auch vor dem Tipp-Bot. */
export function playerView(state: SolitaireState): SolitaireState {
  switch (state.variant) {
    case 'klondike':
      return { ...state, tableau: state.tableau.map(hidePile), stock: state.stock.map(() => null) };
    case 'spider':
      return { ...state, tableau: state.tableau.map(hidePile), stock: state.stock.map(() => null) };
    case 'pyramid':
      return { ...state, stock: state.stock.map(() => null) };
    default:
      return state;
  }
}

/** Alle Karten der Partie (Spider: 104 mit doppelten Karten aus mehreren Kartenspielen). */
function fullDeck(state: SolitaireState): CardId[] {
  if (state.variant !== 'spider') return createDeck();
  const suits = state.suits === 1 ? (['S'] as const) : state.suits === 2 ? (['S', 'H'] as const) : (['C', 'D', 'H', 'S'] as const);
  return createDeck(8 / suits.length, [...suits]);
}

/** Für Bots: Unbekanntes zufällig mit den Karten füllen, die nirgends sichtbar sind. */
export function sampleHidden(view: SolitaireState, _seat: SeatId, rng: Rng): SolitaireState {
  const visible = new Set<CardId>();
  const collect = (value: unknown): void => {
    if (typeof value === 'string' && /^[CDHS]\d+\.\d+$/.test(value)) visible.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect({ ...view, lastMove: null });
  // Bei Spider fehlen abgelegte Folgen in der Sicht – sie zählen trotzdem als bekannt.
  let unknown = fullDeck(view).filter((card) => !visible.has(card));
  if (view.variant === 'spider') {
    for (const king of view.completed) {
      const suit = king[0];
      for (let rank = 1; rank <= 13; rank++) {
        const index = unknown.findIndex((card) => card.startsWith(`${suit}${rank}.`));
        if (index >= 0) unknown.splice(index, 1);
      }
    }
  }
  unknown = rng.shuffle(unknown);
  let next = 0;
  const fill = (card: CardId | null) => card ?? unknown[next++] ?? 'S1.9';
  switch (view.variant) {
    case 'klondike':
      return { ...view, tableau: view.tableau.map((p) => ({ down: p.down.map(fill), up: p.up })), stock: view.stock.map(fill) };
    case 'spider':
      return { ...view, tableau: view.tableau.map((p) => ({ down: p.down.map(fill), up: p.up })), stock: view.stock.map(fill) };
    case 'pyramid':
      return { ...view, stock: view.stock.map(fill) };
    default:
      return view;
  }
}
