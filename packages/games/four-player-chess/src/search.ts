/**
 * Vorausschau für den Vierer-Schach-Bot: Statt jeden Zug nur für sich nach Faustregeln zu
 * bewerten, spielt der Bot eine ganze Runde voraus, bis er wieder am Zug ist.
 *
 * - Eigene Kandidaten: die besten Züge nach den Faustregeln (`scoreMove`).
 * - Die nächste Farbe antwortet mit einem ihrer plausibelsten Züge; der Bot rechnet mit der
 *   Antwort, die ihm am meisten schadet („paranoid“, aber nur unter plausiblen Zügen).
 * - Die übrigen Farben ziehen ihren besten Faustregel-Zug.
 * - Danach wird die Stellung aus Sicht des Bots bewertet: Punkte, Material, hängende Figuren,
 *   Schach – im Teammodus Material beider Teams.
 *
 * Gerechnet wird mit leichten Kopien des Spielstands (ohne Protokoll und Stellungszähler).
 */
import { scoreMove } from './legacy/bot';
import {
  COLORS,
  TEAM_OF,
  applyAction,
  attackers,
  enemiesOf,
  findKing,
  isAttacked,
  legalMoves,
  type Color,
  type FourChessState,
  type InternalMove,
  type PieceType,
} from './legacy/engine';

const VALUE: Record<PieceType, number> = { P: 1, N: 3, B: 5, R: 5, Q: 9, K: 0 };
const WIN = 10_000;

export interface SearchWidth {
  /** Eigene Kandidatenzüge. */
  root: number;
  /** Geprüfte Antworten der nächsten Farbe. */
  reply: number;
}

export const SEARCH_WIDTH: Record<'medium' | 'hard', SearchWidth> = {
  medium: { root: 6, reply: 3 },
  hard: { root: 12, reply: 5 },
};

/** Leichte Kopie: alles, was ein Zug verändert, ohne das wachsende Protokoll. */
function lightCopy(s: FourChessState): FourChessState {
  return {
    ...s,
    board: s.board.slice(),
    active: { ...s.active },
    out: { ...s.out },
    scores: { ...s.scores },
    castle: { r: [...s.castle.r], b: [...s.castle.b], y: [...s.castle.y], g: [...s.castle.g] },
    ep: s.ep.slice(),
    lastMoved: { ...s.lastMoved },
    seen: {},
    log: [],
    lastMove: s.lastMove,
    result: s.result,
  };
}

function play(s: FourChessState, m: InternalMove): FourChessState {
  const next = lightCopy(s);
  applyAction(next, { t: 'm', p: s.turn, f: m.from, to: m.to, ...(m.promote ? { pr: 'Q' as const } : {}) });
  return next;
}

/** Züge der Farbe am Zug, nach Faustregeln sortiert (beste zuerst). */
function ranked(s: FourChessState, limit: number): InternalMove[] {
  const color = s.turn;
  return legalMoves(s, color)
    .map((m) => ({ m, v: scoreMove(s, color, m) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, limit)
    .map((x) => x.m);
}

/** Bewertung der Stellung aus Sicht von `me` (höher ist besser). */
export function evaluate(s: FourChessState, me: Color): number {
  const teams = s.mode === 'teams';
  const friend = (c: Color) => c === me || (teams && TEAM_OF[c] === TEAM_OF[me]);
  if (s.result) {
    if (s.result.winners.includes(me)) return WIN + (teams ? 0 : s.scores[me]);
    if (s.result.winners.length === 0) return 0;
    if (teams) return -WIN;
  }
  if (!s.active[me]) return -WIN + s.scores[me];

  const material: Record<Color, number> = { r: 0, b: 0, y: 0, g: 0 };
  for (const p of s.board) if (p && !p.d) material[p.c] += VALUE[p.t];

  let score: number;
  if (teams) {
    score = 0;
    for (const c of COLORS) if (s.active[c]) score += friend(c) ? material[c] : -material[c];
  } else {
    const others = COLORS.filter((c) => c !== me && s.active[c]);
    const otherMaterial = others.reduce((sum, c) => sum + material[c], 0);
    const bestOther = Math.max(0, ...COLORS.filter((c) => c !== me).map((c) => s.scores[c]));
    score = s.scores[me] + material[me] - 0.3 * otherMaterial - 0.3 * bestOther;
  }

  // Hängende eigene Figuren: Eine kann der Bot retten, die anderen kaum.
  const enemy = enemiesOf(s, me);
  let worst = 0;
  let total = 0;
  for (let i = 0; i < s.board.length; i++) {
    const p = s.board[i];
    if (!p || p.d || p.c !== me || p.t === 'K') continue;
    const threats = attackers(s.board, i, enemy);
    if (!threats.length) continue;
    const cheapest = Math.min(...threats.map((a) => VALUE[a.piece.t] || 50));
    const loss = isAttacked(s.board, i, friend) ? Math.max(0, VALUE[p.t] - cheapest) : VALUE[p.t];
    total += loss;
    worst = Math.max(worst, loss);
  }
  score -= 0.3 * worst + 0.8 * (total - worst);

  const king = findKing(s.board, me);
  if (king >= 0 && isAttacked(s.board, king, enemy)) score -= 0.7;
  return score;
}

/** Spielt die Gegner bis zum nächsten eigenen Zug (höchstens drei Züge) und bewertet. */
function roundValue(s: FourChessState, me: Color, width: SearchWidth): number {
  if (s.result || !s.active[me] || s.turn === me) return evaluate(s, me);
  // Die direkt folgende Farbe: schlimmste ihrer plausiblen Antworten.
  let worst = Infinity;
  for (const reply of ranked(s, width.reply)) {
    let t = play(s, reply);
    // Die übrigen Farben ziehen ihren besten Faustregel-Zug.
    for (let k = 0; k < 2 && !t.result && t.active[me] && t.turn !== me; k++) {
      const [best] = ranked(t, 1);
      if (!best) break;
      t = play(t, best);
    }
    worst = Math.min(worst, evaluate(t, me));
  }
  return worst === Infinity ? evaluate(s, me) : worst;
}

/**
 * Bester Zug mit Vorausschau über eine Runde. `noise` (0–1) streut die Bewertung leicht,
 * damit der Bot nicht jede Partie gleich spielt.
 */
export function searchMove(state: FourChessState, width: SearchWidth, random: () => number = Math.random, noise = 0): InternalMove | null {
  const me = state.turn;
  const all = legalMoves(state, me);
  if (all.length === 0) return null;
  const scored = all.map((m) => ({ m, h: scoreMove(state, me, m) })).sort((a, b) => b.h - a.h);
  let best: InternalMove | null = null;
  let bestValue = -Infinity;
  for (const { m, h } of scored.slice(0, width.root)) {
    const after = play(state, m);
    // Faustregeln als leichter Zusatz: Entwicklung und Mitte sieht die Bewertung nicht.
    const value = roundValue(after, me, width) + 0.15 * h + random() * noise;
    if (value > bestValue) {
      bestValue = value;
      best = m;
    }
  }
  return best;
}
