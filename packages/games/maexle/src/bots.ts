import type { BotDefinition, BotLevel, Rng, SeatId } from '@brett-und-blatt/engine';
import { MAEXLE, RANKING, isIn, legalMoves, rankOf, valueOf, waysOf, type Announcement, type MaexleMove, type MaexleState } from './rules';

const TOP = RANKING.length - 1;

/** Wahrscheinlichkeit jedes Werts in Rangfolge: normale Würfe 2/36, Pasche 1/36, Mäxle 2/36. */
export const PROBABILITY: readonly number[] = RANKING.map((value) => waysOf(value) / 36);

/** Wahrscheinlichkeit, dass ein frischer Wurf mindestens den Rang `rank` hat. */
export function chanceAtLeast(rank: number): number {
  let sum = 0;
  for (let r = Math.max(0, rank); r <= TOP; r++) sum += PROBABILITY[r]!;
  return sum;
}

/** Wie ein Ansager mit Wurf-Rang `rolled` nach der Vorgabe `previous` ansagt. */
interface Style {
  /** Wie oft er trotz ausreichendem Wurf etwas mehr ansagt (Tarnung). */
  inflate: number;
  /** Wie oft er beim Lügen den Wert knapp über der Vorgabe nimmt statt eines Sprungs. */
  lieNear: number;
}

/** So stellt sich der Bot die Mitspieler vor – und so spielt der mittlere Bot selbst. */
const TYPICAL: Style = { inflate: 0.2, lieNear: 0.7 };

/** Verteilung der Ansage (als Rang) bei gegebenem Wurf-Rang und Vorgabe-Rang (-1: freie Ansage). */
function announceDistribution(rolled: number, previous: number, style: Style): number[] {
  const dist = RANKING.map(() => 0);
  const add = (rank: number, p: number) => (dist[Math.min(TOP, rank)]! += p);
  if (rolled > previous) {
    add(rolled, 1 - style.inflate);
    [0.6, 0.3, 0.1].forEach((w, k) => add(rolled + k + 1, style.inflate * w));
  } else {
    add(previous + 1, style.lieNear);
    for (let k = 1; k <= 3; k++) add(previous + 1 + k, (1 - style.lieNear) / 3);
  }
  return dist;
}

/**
 * Wie wahrscheinlich liegt unter dem Becher mindestens Rang `target`? Grundlage ist die letzte
 * Ansage dessen, der gewürfelt hat (spätere blinde Ansagen haben den Wurf nicht gesehen).
 */
function chanceCupAtLeast(view: MaexleState, target: number, style: Style, lieOdds = 1): number {
  const rollerIndex = findLastIndex(view.history, (a) => !a.blind);
  const own = view.history[rollerIndex];
  if (!own) return chanceAtLeast(target);
  const previous = rollerIndex > 0 ? rankOf(view.history[rollerIndex - 1]!.value) : -1;
  const said = rankOf(own.value);
  let truth = 0;
  let total = 0;
  for (let rolled = 0; rolled <= TOP; rolled++) {
    // Lügen werden mit `lieOdds` gewichtet: das Bild, das der Bot sich vom Ansager gemacht hat.
    const weight = PROBABILITY[rolled]! * announceDistribution(rolled, previous, style)[said]! * (rolled > previous ? 1 : lieOdds);
    total += weight;
    if (rolled >= target) truth += weight;
  }
  return total > 0 ? truth / total : chanceAtLeast(target);
}

function findLastIndex<T>(items: readonly T[], test: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) if (test(items[i]!)) return i;
  return -1;
}

/**
 * Spielerbild: Lügt dieser Platz öfter als üblich, und wohin? Geglättet mit gedachten
 * Aufdeckungen im üblichen Stil, damit zwei Zufälle das Bild nicht kippen.
 */
function pictureOf(view: MaexleState, seat: SeatId): { style: Style; lieOdds: number } {
  const { shown, lies, nearLies } = view.record[seat] ?? { shown: 0, lies: 0, nearLies: 0 };
  const usual = 0.4;
  const rate = (lies + usual * 4) / (shown + 4);
  const lieOdds = Math.max(0.4, Math.min(2.5, rate / (1 - rate) / (usual / (1 - usual))));
  const lieNear = (nearLies + TYPICAL.lieNear * 3) / (lies + 3);
  return { style: { ...TYPICAL, lieNear }, lieOdds };
}

/** Wie oft eine Ansage auf diesem Rang angezweifelt wird – je höher, desto öfter. */
function doubtChance(rank: number): number {
  return Math.max(0.2, Math.min(0.9, 1 - chanceAtLeast(rank)));
}

function chooseAnnouncement(view: MaexleState, rng: Rng, level: BotLevel): MaexleMove {
  const previous = view.history.length > 0 ? rankOf(view.history[view.history.length - 1]!.value) : -1;
  const rolled = view.dice ? rankOf(valueOf(view.dice)) : 0;
  const style: Style =
    level === 'hard'
      ? { inflate: rng.next() * 0.15, lieNear: 0.55 + rng.next() * 0.35 }
      : level === 'medium'
        ? TYPICAL
        : { inflate: 0, lieNear: 0 };
  let rank: number;
  if (level === 'easy' && rolled <= previous) {
    // Der leichte Bot lügt auffällig: gleich ein großer Sprung.
    rank = Math.min(TOP, previous + 2 + rng.int(4));
  } else {
    const dist = announceDistribution(rolled, previous, style);
    let pick = rng.next();
    rank = dist.findIndex((p) => (pick -= p) < 0);
    if (rank < 0) rank = TOP;
  }
  return { type: 'announce', value: RANKING[Math.max(rank, previous + 1)]! };
}

function chooseResponse(view: MaexleState, rng: Rng, level: BotLevel): MaexleMove {
  const last = view.history[view.history.length - 1] as Announcement;
  const said = rankOf(last.value);
  const isMaexle = last.value === MAEXLE;
  const doubtCost = isMaexle ? view.maexleCost : 1;

  if (level === 'easy') {
    if (isMaexle) return rng.chance(0.5) ? { type: 'doubt' } : { type: 'believe' };
    return chanceAtLeast(said) < 0.2 + rng.next() * 0.15 ? { type: 'doubt' } : { type: 'believe' };
  }

  // Wahrscheinlichkeit, dass die Ansage stimmt. Kennt der Bot den Wurf selbst, weiß er es genau.
  const roller = findLastIndex(view.history, (a) => !a.blind);
  const picture = level === 'hard' && roller >= 0 ? pictureOf(view, view.history[roller]!.seat) : { style: TYPICAL, lieOdds: 1 };
  const truthAt = (rank: number) => (view.dice ? (rankOf(valueOf(view.dice)) >= rank ? 1 : 0) : chanceCupAtLeast(view, rank, picture.style, picture.lieOdds));

  // Bewertet wird in Leben: eigener Verlust zählt -1, der Verlust eines Mitspielers zählt `gain`
  // (zu zweit genauso viel, in großer Runde weniger – dann trifft es ja nur einen von vielen).
  const alive = view.penalties.filter((_, s) => isIn(view, s)).length;
  const gain = 2 / Math.max(2, alive);
  const truth = truthAt(said);
  const options: { move: MaexleMove; value: number }[] = [{ move: { type: 'doubt' }, value: (1 - truth) * gain - truth * doubtCost }];
  if (isMaexle) options.push({ move: { type: 'believe' }, value: -1 });
  else {
    // Glauben: selbst würfeln und höher ansagen. Reicht der Wurf nicht, muss man lügen; der
    // Nächste zweifelt dann etwa so oft an, wie hoch die Ansage ist – auch bei der Wahrheit.
    const beat = chanceAtLeast(said + 1);
    const doubted = doubtChance(said + 1);
    options.push({ move: { type: 'believe' }, value: doubted * (beat * gain - (1 - beat)) });
    if (view.blind) {
      const value = RANKING[said + 1]!;
      const holds = truthAt(said + 1);
      options.push({ move: { type: 'passBlind', value }, value: doubted * (holds * gain - (1 - holds)) });
    }
  }
  // Etwas Rauschen, damit der Bot an der Grenze nicht berechenbar ist.
  const noise = level === 'hard' ? 0.06 : 0.1;
  const scored = options.map((o) => ({ ...o, value: o.value + (rng.next() - 0.5) * noise }));
  scored.sort((x, y) => y.value - x.value);
  return scored[0]!.move;
}

/**
 * Der Standard-Bot kennt die Wahrscheinlichkeiten der Würfe.
 * - leicht: einfache Schwellen, lügt mit großen Sprüngen
 * - mittel: rechnet nach, wie wahrscheinlich eine Ansage stimmt; feste Lügenquote
 * - schwer: dazu ein Bild vom Ansager (wie oft er gelogen hat) und eine wechselnde Lügenquote
 */
export const maexleBot: BotDefinition<MaexleState, MaexleMove> = {
  id: 'maexle',
  name: 'Würfelfuchs',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const { view, seat, rng, level } = ctx;
    const moves = legalMoves(view, seat);
    if (view.phase === 'roll') return { type: 'roll' };
    if (view.phase === 'announce') return chooseAnnouncement(view, rng, level);
    const move = chooseResponse(view, rng, level);
    return moves.some((m) => m.type === move.type) ? move : moves[0]!;
  },
};
