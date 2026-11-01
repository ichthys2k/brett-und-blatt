import type { BotDefinition, BotLevel, Rng, SeatId } from '@brett-und-blatt/engine';
import { legalMoves, livingSeats, partnerOf, type WolvesSheepMove, type WolvesSheepState } from './rules';

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

/** Was dieser Platz sicher über andere weiß: Wölfe und Unbedenkliche. */
function knowledge(view: WolvesSheepState): { wolves: Set<SeatId>; cleared: Set<SeatId> } {
  const wolves = new Set<SeatId>(view.lambSights.map((sight) => sight.target));
  const cleared = new Set<SeatId>();
  for (const entry of view.examinations) (entry.role === 'wolf' ? wolves : cleared).add(entry.target);
  return { wolves, cleared };
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

/** Wem misstraut der Platz am meisten? Für Abstimmung und Hütehund. */
function accuse(view: WolvesSheepState, seat: SeatId, targets: SeatId[], level: BotLevel, rng: Rng): SeatId {
  if (level === 'easy') return rng.pick(targets);
  const score = suspicion(view, level);
  if (view.roles[seat] === 'wolf') {
    // Wölfe treffen nie das eigene Rudel, solange es anders geht.
    const prey = targets.filter((target) => view.roles[target] !== 'wolf');
    return prey.length > 0 ? pickBest(prey, (target) => score[target]!, rng) : rng.pick(targets);
  }
  const { wolves, cleared } = knowledge(view);
  const exposed = targets.find((target) => wolves.has(target));
  if (exposed !== undefined) return exposed;
  const open = targets.filter((target) => !cleared.has(target));
  return pickBest(open.length > 0 ? open : targets, (target) => score[target]!, rng);
}

/** Wem vertraut der Platz am meisten? Für die Wahl und die Glocke. */
function trust(view: WolvesSheepState, seat: SeatId, targets: SeatId[], level: BotLevel, rng: Rng): SeatId {
  if (level === 'easy') return rng.pick(targets);
  const score = suspicion(view, level);
  const { wolves, cleared } = knowledge(view);
  const wolfFriend = view.roles[seat] === 'wolf' ? targets.filter((target) => view.roles[target] === 'wolf') : [];
  if (wolfFriend.length > 0) return rng.pick(wolfFriend);
  const safe = targets.filter((target) => cleared.has(target));
  if (safe.length > 0) return rng.pick(safe);
  const open = targets.filter((target) => !wolves.has(target));
  return pickBest(open.length > 0 ? open : targets, (target) => -score[target]!, rng);
}

function shepherdMove(view: WolvesSheepState, seat: SeatId, level: BotLevel, rng: Rng, moves: WolvesSheepMove[]): WolvesSheepMove {
  if (level === 'easy') return rng.pick(moves);
  const canSave = moves.some((move) => move.type === 'shepherd' && move.save);
  // Mittel und schwer retten beim ersten Opfer, außer es ist der eigene Verbundene – dann erst recht.
  const save = canSave;
  let expel: SeatId | null = null;
  if (level === 'hard' && !view.expelUsed) {
    const targets = livingSeats(view).filter((target) => target !== seat && target !== partnerOf(view, seat) && target !== view.nightVictim);
    const score = suspicion(view, level);
    const worst = targets.length > 0 ? pickBest(targets, (target) => score[target]!, rng) : null;
    if (worst !== null && score[worst]! >= 4) expel = worst;
  }
  return { type: 'shepherd', save, expel };
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
    const targetsOf = (type: 'tap' | 'vote' | 'elect' | 'shoot' | 'passBell') => moves.flatMap((move) => (move.type === type && move.target !== null ? [move.target] : []));
    switch (first.type) {
      case 'tap': {
        // Das Lamm linst in der ersten Nacht; später wäre das Risiko zu hoch für zu wenig Wissen.
        if (level !== 'easy' && moves.some((move) => move.type === 'peek') && view.day === 1) return { type: 'peek' };
        return { type: 'tap', target: nightPick(view, seat, targetsOf('tap'), level, rng) };
      }
      case 'vote':
        return { type: 'vote', target: accuse(view, seat, targetsOf('vote'), level, rng) };
      case 'elect':
        return { type: 'elect', target: trust(view, seat, targetsOf('elect'), level, rng) };
      case 'shoot':
        return { type: 'shoot', target: accuse(view, seat, targetsOf('shoot'), level, rng) };
      case 'passBell':
        return { type: 'passBell', target: trust(view, seat, targetsOf('passBell'), level, rng) };
      case 'shepherd':
        return shepherdMove(view, seat, level, rng, moves);
      case 'swap':
        // Mit Wissen über die übrigen Karten nimmt der Bot lieber eine Sonderrolle als gar nichts.
        return level === 'easy' ? rng.pick(moves) : (moves.find((move) => move.type === 'swap' && move.card !== null && view.middle[move.card] !== 'sheep') ?? first);
      case 'bind':
        return rng.pick(moves);
      default:
        return first;
    }
  },
  delayMs({ view, move, rng }) {
    // Ein Bot darf die Beratung der Menschen nicht abschneiden.
    if (move.type === 'endDebate') return view.debateSeconds > 0 ? (view.debateSeconds + 5) * 1000 : 60_000 + livingSeats(view).length * 5_000;
    return 800 + rng.int(1_500);
  },
};
