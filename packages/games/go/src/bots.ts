import type { BotDefinition, BotLevel, Rng } from '@brett-und-blatt/engine';
import { areaScore, BLACK, EMPTY, FastRandom, geometry, guessDead, isEye, Playout, WHITE, type Color } from './board';
import { legalMoves, type GoMove, type GoState } from './rules';

/** Höchstzahl an Zufallspartien je Stufe; „schwer“ rechnet, solange die Zeit reicht. */
const PLAYOUTS: Record<BotLevel, number> = { easy: 150, medium: 2_000, hard: 200_000 };

interface Node {
  /** Punkt des Zugs, der zu diesem Knoten führt. */
  move: number;
  /** Farbe, die diesen Zug gemacht hat. */
  color: Color;
  children: Node[] | null;
  visits: number;
  wins: number;
  /** RAVE: Wie oft der Zug später in Zufallspartien vorkam und wie oft das gut ging. */
  amafVisits: number;
  amafWins: number;
  /** Davon virtuelle Besuche aus dem Vorwissen – zählen bei der Zugwahl nicht. */
  prior: number;
}

const node = (move: number, color: Color): Node => ({ move, color, children: null, visits: 0, wins: 0, amafVisits: 0, amafWins: 0, prior: 0 });

/** RAVE-Gewichtung: Anfangs zählen die Zufallspartien-Statistiken, später die echten Besuche. */
const RAVE_K = 600;

function value(child: Node, parentVisits: number): number {
  const q = child.visits > 0 ? child.wins / child.visits : 0.5;
  const qa = child.amafVisits > 0 ? child.amafWins / child.amafVisits : 0.5;
  const beta = Math.sqrt(RAVE_K / (3 * child.visits + RAVE_K));
  const explore = 0.25 * Math.sqrt(Math.log(parentVisits + 1) / (child.visits + 1));
  return (1 - beta) * q + beta * qa + explore;
}

/**
 * Vorwissen für neue Knoten (wie „virtuelle“ Besuche): Schlagen und Retten aus dem Atari
 * sind meist gut, Selbst-Atari und die erste Linie meist schlecht.
 */
function withPrior(game: Playout, child: Node): Node {
  const { size } = game.geo;
  const p = child.move;
  const f = game.features(p);
  const r = Math.floor(p / size);
  const c = p % size;
  let visits = 0;
  let wins = 0;
  if (f.captures > 0 || f.saves) {
    visits = 20;
    wins = 18;
  } else if (f.selfAtari) {
    visits = 20;
    wins = 2;
  } else {
    // Abstand zum Rand: erste Linie schlecht, zweite mäßig; auf großen Brettern sind dritte und vierte Linie gut.
    const line = Math.min(r, c, size - 1 - r, size - 1 - c);
    if (line === 0) {
      visits = 10;
      wins = 2;
    } else if (line === 1) {
      visits = 10;
      wins = 4;
    } else if (size >= 13 && (line === 2 || line === 3)) {
      visits = 10;
      wins = 7;
    }
  }
  child.visits += visits;
  child.prior += visits;
  child.wins += wins;
  child.amafVisits += visits;
  child.amafWins += wins;
  return child;
}

function expand(game: Playout, leaf: Node): void {
  const { board, geo } = game;
  const color = game.turn;
  const children: Node[] = [];
  for (let p = 0; p < geo.points; p++) {
    if (board[p] === EMPTY && !isEye(board, geo, p, color) && game.isLegal(p)) children.push(withPrior(game, node(p, color)));
  }
  leaf.children = children;
}

export interface SearchResult {
  move: number;
  winRate: number;
  /** Mittlerer Besitz je Punkt aus allen Zufallspartien (+1 Schwarz, −1 Weiß). */
  ownership: Float64Array;
  playouts: number;
}

/**
 * Monte-Carlo-Baumsuche mit RAVE. Die Wurzelzüge kommen aus den Regeln (inklusive Superko),
 * im Baum und in den Zufallspartien gilt der einfache Ko.
 */
export function search(state: GoState, rootMoves: number[], rng: Rng, maxPlayouts: number, timeBudgetMs: number, now: () => number): SearchResult {
  const { size } = state;
  const geo = geometry(size);
  const color: Color = state.turn === 0 ? BLACK : WHITE;
  const atari = state.variant === 'atari';
  const root = node(-1, color === BLACK ? WHITE : BLACK);
  const ownership = new Float64Array(geo.points);
  const random = new FastRandom(rng);
  const game = new Playout(state.board, size, color, state.ko ?? -1, atari);
  root.children = rootMoves.map((p) => withPrior(game, node(p, color)));
  const deadline = now() + timeBudgetMs;
  const maxMoves = geo.points * 3;
  // Wer hat welchen Punkt in dieser Partie zuerst besetzt (ab welcher Zugnummer)?
  const firstColor = new Int8Array(geo.points);
  const firstAt = new Int32Array(geo.points);
  let playouts = 0;

  for (; playouts < maxPlayouts; playouts++) {
    if (playouts > 0 && (playouts & 15) === 0 && now() > deadline) break;
    game.reset(state.board, color, state.ko ?? -1);
    const path: Node[] = [root];
    let current = root;
    firstColor.fill(0);
    let step = 0;
    const record = (p: number, c: Color) => {
      if (!firstColor[p]) {
        firstColor[p] = c;
        firstAt[p] = step;
      }
      step++;
    };

    // Auswahl: im Baum hinab zum vielversprechendsten Blatt.
    while (current.children && current.children.length > 0 && !(atari && game.firstCapture)) {
      let best = current.children[0]!;
      let bestValue = -Infinity;
      for (const child of current.children) {
        const v = value(child, current.visits);
        if (v > bestValue) {
          bestValue = v;
          best = child;
        }
      }
      if (!game.play(best.move)) break;
      record(best.move, best.color);
      current = best;
      path.push(current);
      // Erweitern, sobald ein Knoten ein paar Mal besucht wurde.
      if (!current.children && current.visits >= 2) {
        expand(game, current);
        break;
      }
    }

    const winner = atari && game.firstCapture ? game.firstCapture : game.run(random, state.komi, maxMoves, record);
    game.ownership(ownership);

    // Rückwärts: Besuche, Siege und RAVE-Statistiken.
    for (let depth = 0; depth < path.length; depth++) {
      const n = path[depth]!;
      n.visits++;
      if (n.color === winner) n.wins++;
      if (!n.children) continue;
      for (const child of n.children) {
        const p = child.move;
        if (firstColor[p] === child.color && firstAt[p] >= depth) {
          child.amafVisits++;
          if (child.color === winner) child.amafWins++;
        }
      }
    }
  }

  for (let p = 0; p < ownership.length; p++) ownership[p] = ownership[p]! / Math.max(1, playouts);
  let best: Node | null = null;
  const real = (n: Node) => n.visits - n.prior;
  for (const child of root.children) if (!best || real(child) > real(best)) best = child;
  return {
    move: best ? best.move : -1,
    winRate: best && real(best) > 0 ? best.wins / best.visits : 0,
    ownership,
    playouts,
  };
}

/** Steht der Punkt neben einer Gruppe mit höchstens zwei Freiheiten? Dann geht es um Leben und Tod. */
function isTactical(state: GoState, point: number): boolean {
  const geo = geometry(state.size);
  const game = new Playout(state.board, state.size, BLACK);
  for (const n of geo.neighbors[point]!) {
    if (state.board[n] !== EMPTY && game.liberties(n, 3).length <= 2) return true;
  }
  return false;
}

/** Wäre die Partie nach Passen (Auszählung mit Vorschlag) für `seat` gewonnen? */
function winsOnScore(state: GoState, seat: number, rng: Rng): boolean {
  const color: Color = state.turn === 0 ? BLACK : WHITE;
  const dead = guessDead(state.board, state.size, color, state.komi, rng, state.size <= 9 ? 150 : 80);
  const { black, white } = areaScore(state.board, geometry(state.size), dead);
  const margin = black - (white + state.komi);
  return seat === 0 ? margin > 0 : margin < 0;
}

/**
 * Der Go-Bot. Er setzt keine Steine in eigene Augen, passt, wenn kein Zug mehr etwas bringt,
 * und stimmt in der Auszählphase zu, solange seine eigenen Steine nicht zu Unrecht als tot gelten.
 *
 * - leicht: wenige Zufallspartien – für Anfänger auf 9 × 9
 * - mittel: einige Tausend Zufallspartien
 * - schwer: so viele, wie die Bedenkzeit erlaubt
 */
export const goBot: BotDefinition<GoState, GoMove> = {
  id: 'go',
  name: 'Go-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = ctx.view;
    const seat = ctx.seat;

    if (state.phase === 'scoring') {
      // Eigene Steine, die der Bot für lebendig hält, dürfen nicht als tot markiert sein.
      const color: Color = seat === 0 ? BLACK : WHITE;
      const proposal = new Set(guessDead(state.board, state.size, color, state.komi, ctx.rng));
      const wronglyDead = state.dead.some((p) => state.board[p] === color && !proposal.has(p));
      return wronglyDead ? { type: 'resume' } : { type: 'acceptScore' };
    }

    const legal = legalMoves(state, seat);
    const geo = geometry(state.size);
    const color: Color = seat === 0 ? BLACK : WHITE;
    const candidates = legal.flatMap((m) => (m.type === 'place' && !isEye(state.board, geo, m.point, color) ? [m.point] : []));
    if (candidates.length === 0) return { type: 'pass' };
    // Der Gegner hat gepasst und die Auszählung spricht für uns: Partie beenden.
    if (state.variant === 'go' && state.passes === 1 && winsOnScore(state, seat, ctx.rng)) return { type: 'pass' };

    const budget = ctx.level === 'hard' ? ctx.timeBudgetMs : Math.min(ctx.timeBudgetMs, ctx.level === 'medium' ? 1_000 : 300);
    const found = search(state, candidates, ctx.rng, PLAYOUTS[ctx.level], budget, ctx.now);
    // Ist der beste Zug auf einem längst entschiedenen Punkt, bringt Weiterspielen nichts mehr.
    if (state.variant === 'go' && state.record.length >= geo.points / 3 && Math.abs(found.ownership[found.move] ?? 0) > 0.92 && !isTactical(state, found.move)) {
      return { type: 'pass' };
    }
    return { type: 'place', point: found.move };
  },
};
