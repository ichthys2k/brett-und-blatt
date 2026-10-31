import type { BotDefinition, BotLevel, Rng, SeatId } from '@brett-und-blatt/engine';
import { legalMoves, livingSeats, type WolvesSheepMove, type WolvesSheepState } from './rules';

/** Punktet Mitspieler nach öffentlichem Wissen: Wer für aufgedeckte Schafe stimmte, wirkt verdächtig. */
function suspicion(view: WolvesSheepState, level: BotLevel): number[] {
  const score = Array<number>(view.seats).fill(0);
  if (level === 'easy') return score;
  const weight = level === 'hard' ? 2 : 1;
  for (const record of view.history) {
    if (record.out === null) continue;
    const outRole = view.departures.find((departure) => departure.seat === record.out)?.role;
    record.votes.forEach((vote, seat) => {
      if (vote === record.out) score[seat]! += outRole === 'wolf' ? -weight : weight;
    });
  }
  return score;
}

/** Wählt unter den Zielen die mit der höchsten Wertung; Gleichstand entscheidet der Zufall. */
function pickBest(targets: SeatId[], score: (seat: SeatId) => number, rng: Rng): SeatId {
  const best = Math.max(...targets.map(score));
  return rng.pick(targets.filter((seat) => score(seat) === best));
}

function nightPick(view: WolvesSheepState, seat: SeatId, targets: SeatId[], level: BotLevel, rng: Rng): SeatId {
  if (level === 'easy') return rng.pick(targets);
  if (view.roles[seat] === 'wolf') {
    // Dem Rudel folgen, damit das Los nicht entscheiden muss.
    const packPick = view.picks.find((pick, other) => other !== seat && view.roles[other] === 'wolf' && pick !== null && targets.includes(pick));
    if (packPick !== undefined && packPick !== null) return packPick;
    return rng.pick(targets);
  }
  if (view.roles[seat] === 'examiner') {
    const known = new Set(view.examinations.map((entry) => entry.target));
    const unknown = targets.filter((target) => !known.has(target));
    if (unknown.length > 0) return rng.pick(unknown);
  }
  return rng.pick(targets);
}

function councilVote(view: WolvesSheepState, seat: SeatId, targets: SeatId[], level: BotLevel, rng: Rng): SeatId {
  if (level === 'easy') return rng.pick(targets);
  const score = suspicion(view, level);
  if (view.roles[seat] === 'wolf') {
    // Wölfe stimmen nie für das eigene Rudel.
    const prey = targets.filter((target) => view.roles[target] !== 'wolf');
    return prey.length > 0 ? pickBest(prey, (target) => score[target]!, rng) : rng.pick(targets);
  }
  const exposed = view.examinations.find((entry) => entry.role === 'wolf' && view.alive[entry.target] && targets.includes(entry.target));
  if (exposed) return exposed.target;
  const cleared = new Set(view.examinations.filter((entry) => entry.role !== 'wolf').map((entry) => entry.target));
  const open = targets.filter((target) => !cleared.has(target));
  return pickBest(open.length > 0 ? open : targets, (target) => score[target]!, rng);
}

/**
 * „Hütehelfer“ füllt Plätze und vertritt Abwesende, diskutiert aber nicht. Leicht wählt zufällig,
 * mittel nutzt sein Wissen, schwer gewichtet das Abstimmungsverhalten stärker.
 */
export const wolvesSheepBot: BotDefinition<WolvesSheepState, WolvesSheepMove> = {
  id: 'wolves-sheep',
  name: 'Hütehelfer',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    const moves = legalMoves(view, seat);
    const first = moves[0];
    if (first === undefined) throw new Error('Der Bot ist am Zug, hat aber keine erlaubten Züge.');
    if (first.type === 'tap') {
      const targets = moves.flatMap((move) => (move.type === 'tap' ? [move.target] : []));
      return { type: 'tap', target: nightPick(view, seat, targets, level, rng) };
    }
    if (first.type === 'vote') {
      const targets = moves.flatMap((move) => (move.type === 'vote' && move.target !== null ? [move.target] : []));
      return { type: 'vote', target: councilVote(view, seat, targets, level, rng) };
    }
    return first;
  },
  delayMs({ view, move, rng }) {
    // Ein Bot darf die Beratung der Menschen nicht abschneiden.
    if (move.type === 'endDebate') return view.debateSeconds > 0 ? (view.debateSeconds + 5) * 1000 : 60_000 + livingSeats(view).length * 5_000;
    return 800 + rng.int(1_500);
  },
};
