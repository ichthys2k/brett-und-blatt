import type { BotDefinition, BotLevel, Rng } from '@brett-und-blatt/engine';
import { targetsFor, type CardSource, type LigrettoMove, type LigrettoState, type LigrettoView, type PlayerView } from './rules';

/** Reaktionszeit in ms: Grundwert und Streuung je Stufe. */
const PLAY_DELAY: Record<BotLevel, [number, number]> = {
  easy: [2_300, 1_600],
  medium: [1_500, 1_000],
  hard: [850, 600],
};

const FLIP_DELAY: Record<BotLevel, [number, number]> = {
  easy: [1_300, 700],
  medium: [850, 450],
  hard: [550, 300],
};

/** Wie oft ein Bot eine passende Karte übersieht. */
const OVERSIGHT: Record<BotLevel, number> = { easy: 0.35, medium: 0.12, hard: 0 };

/** Lieber zuerst aus dem Ligretto-Stapel, dann aus der Reihe (füllt sich daraus nach), zuletzt vom Talon. */
const SOURCE_RANK: Record<CardSource['from'], number> = { ligretto: 3, row: 2, talon: 1 };

function between([base, spread]: [number, number], rng: Rng): number {
  return base + rng.int(spread);
}

function cardOf(player: PlayerView, source: CardSource) {
  if (source.from === 'ligretto') return player.ligrettoTop;
  if (source.from === 'talon') return player.talonTop;
  return player.row[source.slot] ?? null;
}

export function playMoves(view: LigrettoView, seat: number): LigrettoMove[] {
  const player = view.players[seat]!;
  const list: CardSource[] = [{ from: 'ligretto' }, ...player.row.map((_, slot) => ({ from: 'row' as const, slot })), { from: 'talon' }];
  const moves: LigrettoMove[] = [];
  for (const source of list) {
    const card = cardOf(player, source);
    if (!card) continue;
    for (const pile of targetsFor(view.center, card)) moves.push({ type: 'play', source, pile });
  }
  return moves;
}

export const ligrettoBot: BotDefinition<LigrettoState, LigrettoMove, LigrettoView> = {
  id: 'flinke-hand',
  name: 'Flinke Hand',
  levels: ['easy', 'medium', 'hard'],
  delayMs({ level, move, rng }) {
    if (move.type === 'play') return between(PLAY_DELAY[level], rng);
    if (move.type === 'flip') return between(FLIP_DELAY[level], rng);
    if (move.type === 'ready') return 2_500 + rng.int(1_000);
    return 1_200 + rng.int(600);
  },
  chooseMove({ view, seat, level, rng }) {
    if (view.phase === 'roundEnd') return { type: 'ready' };
    const player = view.players[seat]!;

    const plays = playMoves(view, seat).filter(() => !rng.chance(OVERSIGHT[level]));
    if (plays.length > 0) {
      const rank = (m: LigrettoMove) => (m.type === 'play' ? SOURCE_RANK[m.source.from] : 0);
      const best = Math.max(...plays.map(rank));
      return rng.pick(plays.filter((m) => rank(m) === best));
    }

    const cards = player.handCount + player.talonCount;
    const canFlip = player.handCount > 0 || player.talonCount > 1;
    const flipCount = view.flipCount;
    // Einmal ganz durchgeblättert, ohne dass sich etwas getan hat: „Ich komme nicht weiter“.
    const cycle = Math.ceil(cards / flipCount) + 1;
    if (canFlip && player.idleFlips < cycle) return { type: 'flip' };
    return { type: 'stuck' };
  },
};
