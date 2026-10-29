import { stateFor } from './general';
import type { BotContext, BotDefinition, SeatId } from '../types';

export interface PimcOptions<S, M, V> {
  /** Die Faustregel-Bot des Spiels: Er spielt die Partien zu Ende, die der Bot durchrechnet. */
  heuristic: BotDefinition<S, M, V>;
  /** Wird noch Karte für Karte gespielt? Dann rechnet der Bot weiter, sonst ist die Runde vorbei. */
  isPlaying: (state: S) => boolean;
  /** Wie gut steht dieser Platz im Zwischenstand? Verglichen wird die Veränderung seit dem Start. */
  score: (state: S, seat: SeatId) => number;
  /** Welche Züge kommen in Frage? Standard: alle erlaubten (Spiele schließen z. B. Aufgeben aus). */
  candidates?: (moves: M[]) => M[];
  /** Höchstzahl der Zufallsverteilungen der verdeckten Karten. */
  samples: number;
  /** Mindestens so viele Verteilungen, auch wenn die Zeit knapp ist. */
  minSamples?: number;
  /** Schutz vor Endlosschleifen in einer durchgespielten Partie. */
  maxMoves?: number;
}

/**
 * Stichproben-Suche für Spiele mit verdeckten Karten („Perfect Information Monte Carlo“, PIMC):
 * Der Bot verteilt die Karten, die er nicht sieht, mehrfach zufällig (`stateFor`), spielt für jeden
 * eigenen Zug die Runde mit den Faustregeln zu Ende und nimmt den Zug mit dem besten Durchschnitt.
 * Jede Verteilung bekommt alle Kandidaten – so vergleichen sie sich unter gleichen Bedingungen.
 * Gibt es nur einen Zug oder keine Zeit, antwortet die Faustregel.
 */
export function pimcMove<S, M, V>(ctx: BotContext<S, M, V>, options: PimcOptions<S, M, V>): M {
  const { module, seat } = ctx;
  const now = ctx.now;
  const deadline = now() + ctx.timeBudgetMs;
  const rolloutLevel = 'medium' as const;
  const maxMoves = options.maxMoves ?? 400;
  const minSamples = options.minSamples ?? 3;

  const first = stateFor(ctx);
  const candidates = (options.candidates ?? ((moves: M[]) => moves))(module.legalMoves(first, seat));
  const fallback = () => options.heuristic.chooseMove({ ...ctx, level: rolloutLevel });
  if (candidates.length <= 1) return candidates[0] ?? fallback();

  const totals = candidates.map(() => 0);
  const counts = candidates.map(() => 0);
  for (let i = 0; i < options.samples; i++) {
    if (i >= minSamples && now() > deadline) break;
    const world = i === 0 ? first : stateFor(ctx);
    const before = options.score(world, seat);
    candidates.forEach((move, c) => {
      try {
        let state = module.applyMove(world, seat, move).state;
        for (let n = 0; n < maxMoves && options.isPlaying(state); n++) {
          const actor = module.currentPlayers(state).find((a): a is SeatId => a !== 'system');
          if (actor === undefined) break;
          const next = options.heuristic.chooseMove({ ...ctx, view: state as unknown as V, seat: actor, level: rolloutLevel });
          state = module.applyMove(state, actor, next).state;
        }
        totals[c]! += options.score(state, seat) - before;
        counts[c]!++;
      } catch {
        // Eine Verteilung, in der dieser Zug nicht passt, zählt für ihn nicht.
      }
    });
  }

  let best = -1;
  let bestAverage = -Infinity;
  candidates.forEach((_, c) => {
    if (counts[c] === 0) return;
    const average = totals[c]! / counts[c]!;
    if (average > bestAverage) {
      bestAverage = average;
      best = c;
    }
  });
  return best >= 0 ? candidates[best]! : fallback();
}
