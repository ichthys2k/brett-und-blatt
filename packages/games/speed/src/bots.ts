import { cardRank, type BotDefinition, type BotLevel, type CardId, type Rng } from '@brett-und-blatt/engine';
import { fits, playsFor, topOf, type SpeedMove, type SpeedState, type SpeedView } from './rules';

/** Reaktionszeit in ms: Grundwert und Streuung je Stufe. */
const PLAY_DELAY: Record<BotLevel, [number, number]> = {
  easy: [2_200, 1_400],
  medium: [1_400, 900],
  hard: [800, 500],
};

/** Wie oft der Bot eine passende Karte erst spät bemerkt – und wie lange er dann braucht. */
const OVERSIGHT: Record<BotLevel, number> = { easy: 0.3, medium: 0.1, hard: 0 };
const OVERSIGHT_MS = 1_800;

function between([base, spread]: [number, number], rng: Rng): number {
  return base + rng.int(spread);
}

/** Wie viele andere Handkarten danach auf die gelegte Karte passen – je mehr, desto besser. */
function followUps(card: CardId, hand: readonly CardId[], wrap: boolean): number {
  return hand.filter((c) => c !== card && fits(c, card, wrap)).length;
}

export const speedBot: BotDefinition<SpeedState, SpeedMove, SpeedView> = {
  id: 'flinker-finger',
  name: 'Flinker Finger',
  levels: ['easy', 'medium', 'hard'],
  delayMs({ level, move, rng }) {
    if (move.type === 'play') return between(PLAY_DELAY[level], rng) + (rng.chance(OVERSIGHT[level]) ? OVERSIGHT_MS : 0);
    if (move.type === 'ready') return 2_500 + rng.int(1_000);
    return 900 + rng.int(600);
  },
  chooseMove({ view, seat, level, rng }) {
    if (view.phase === 'roundEnd') return { type: 'ready' };
    const hand = view.players[seat]!.hand;
    const plays = playsFor(view, hand) as Extract<SpeedMove, { type: 'play' }>[];
    if (plays.length === 0) return { type: 'stuck' };
    if (level !== 'hard') return rng.pick(plays);
    // Schwer: die Karte, nach der die meisten weiteren Handkarten passen; bei Gleichstand lieber
    // auf den Stapel, auf den gerade weniger passt (der andere bleibt für die nächste Karte frei).
    const score = (m: (typeof plays)[number]) => {
      const other = topOf(view.piles[1 - m.pile]!);
      const keepsOther = other ? hand.filter((c) => c !== m.card && fits(c, other, view.wrap)).length : 0;
      return followUps(m.card, hand, view.wrap) * 10 + keepsOther - cardRank(m.card) / 100;
    };
    const best = Math.max(...plays.map(score));
    return rng.pick(plays.filter((m) => score(m) === best));
  },
};
