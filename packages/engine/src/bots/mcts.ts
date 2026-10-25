import { settleSystemMoves } from '../module-helpers';
import type { Rng } from '../random';
import type { Actor, GameModule, Result, SeatId } from '../types';

export interface MctsOptions {
  /** Höchstzahl der Durchläufe. */
  iterations: number;
  /** Zeitgrenze in Millisekunden (zusätzlich zu `iterations`). */
  timeBudgetMs?: number;
  now?: () => number;
  /** Erkundungsfaktor der UCT-Formel. */
  exploration?: number;
  /** Zufallspartien, die länger dauern, zählen als unentschieden. */
  maxPlayoutMoves?: number;
  /** In Zufallspartien sofort mögliche Siege nehmen (kostet Zeit, spielt deutlich besser). */
  winCheck?: boolean;
}

interface Node<S, M> {
  state: S;
  parent: Node<S, M> | null;
  move: M | null;
  /** Wer den Zug gemacht hat, der zu diesem Knoten führte. */
  movedBy: SeatId | null;
  /** Wer in diesem Knoten am Zug ist. */
  actor: SeatId | null;
  children: Node<S, M>[];
  untried: M[];
  visits: number;
  reward: number;
}

/**
 * Monte-Carlo-Baumsuche (MCTS): spielt viele zufällige Partien zu Ende und
 * baut dabei einen Suchbaum auf. Funktioniert mit jedem Spiel, weil sie nur
 * die Schnittstelle benutzt. Bei mehreren Plätzen, die gleichzeitig dran sind,
 * behandelt sie diese nacheinander.
 */
export function mctsSearch<S, M, V>(module: GameModule<S, M, V>, rootState: S, seat: SeatId, rng: Rng, options: MctsOptions): M {
  const rootMoves = module.legalMoves(rootState, seat);
  if (rootMoves.length === 0) throw new Error('Keine erlaubten Züge.');
  if (rootMoves.length === 1) return rootMoves[0] as M;

  const now = options.now ?? (() => Date.now());
  const deadline = options.timeBudgetMs === undefined ? Infinity : now() + options.timeBudgetMs;
  const exploration = options.exploration ?? Math.SQRT2;
  const maxPlayout = options.maxPlayoutMoves ?? 500;

  const makeNode = (state: S, parent: Node<S, M> | null, move: M | null, movedBy: SeatId | null, forcedActor?: SeatId): Node<S, M> => {
    const settled = settleSystemMoves(module, state);
    const actor = module.result(settled) ? null : (forcedActor ?? firstSeat(module.currentPlayers(settled)));
    return {
      state: settled,
      parent,
      move,
      movedBy,
      actor,
      children: [],
      untried: actor === null ? [] : rng.shuffle(module.legalMoves(settled, actor)),
      visits: 0,
      reward: 0,
    };
  };

  const root = makeNode(rootState, null, null, null, seat);

  for (let i = 0; i < options.iterations; i++) {
    if (i > 0 && now() > deadline) break;

    // 1. Auswahl: absteigen, solange alle Züge schon ausprobiert sind.
    let node = root;
    while (node.untried.length === 0 && node.children.length > 0) {
      node = selectChild(node, exploration);
    }

    // 2. Erweiterung: einen neuen Zug ausprobieren.
    const move = node.untried.pop();
    if (move !== undefined && node.actor !== null) {
      const next = module.applyMove(node.state, node.actor, move).state;
      const child = makeNode(next, node, move, node.actor);
      node.children.push(child);
      node = child;
    }

    // 3. Zufallspartie bis zum Ende.
    const result = playout(module, node.state, rng, maxPlayout, options.winCheck ?? false);

    // 4. Rückmeldung: Ergebnis im Pfad nach oben eintragen.
    for (let n: Node<S, M> | null = node; n; n = n.parent) {
      n.visits++;
      if (n.movedBy !== null) n.reward += rewardFor(result, n.movedBy);
    }
  }

  let best = root.children[0];
  for (const child of root.children) {
    if (!best || child.visits > best.visits) best = child;
  }
  return (best?.move ?? rng.pick(rootMoves)) as M;
}

function selectChild<S, M>(node: Node<S, M>, exploration: number): Node<S, M> {
  const logVisits = Math.log(node.visits);
  let best = node.children[0] as Node<S, M>;
  let bestScore = -Infinity;
  for (const child of node.children) {
    const score = child.reward / child.visits + exploration * Math.sqrt(logVisits / child.visits);
    if (score > bestScore) {
      bestScore = score;
      best = child;
    }
  }
  return best;
}

function playout<S, M, V>(module: GameModule<S, M, V>, start: S, rng: Rng, maxMoves: number, winCheck: boolean): Result | null {
  let state = start;
  for (let step = 0; step < maxMoves; step++) {
    state = settleSystemMoves(module, state);
    const result = module.result(state);
    if (result) return result;
    const actor = firstSeat(module.currentPlayers(state));
    if (actor === null) return null;
    const moves = module.legalMoves(state, actor);
    if (moves.length === 0) return null;
    let chosen: M | undefined;
    if (winCheck) {
      for (const move of moves) {
        const next = module.applyMove(state, actor, move).state;
        const r = module.result(next);
        if (r?.kind === 'win' && r.winners.includes(actor)) {
          chosen = move;
          break;
        }
      }
    }
    state = module.applyMove(state, actor, chosen ?? rng.pick(moves)).state;
  }
  return module.result(state);
}

function rewardFor(result: Result | null, seat: SeatId): number {
  if (!result || result.kind === 'draw') return 0.5;
  if (result.kind === 'loss') return 0;
  return result.winners.includes(seat) ? 1 / result.winners.length : 0;
}

function firstSeat(actors: Actor[]): SeatId | null {
  for (const actor of actors) if (actor !== 'system') return actor;
  return null;
}
