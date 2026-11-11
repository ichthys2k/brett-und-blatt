import { cardRank, type BotDefinition, type BotLevel, type CardId, type Rng } from '@brett-und-blatt/engine';
import { fits, legalMoves, playsFor, topOf, type SpeedMove, type SpeedState, type SpeedView } from './rules';

/** Reaktionszeit in ms: Grundwert und Streuung je Stufe. */
const PLAY_DELAY: Record<BotLevel, [number, number]> = {
  easy: [2_200, 1_400],
  medium: [1_400, 900],
  hard: [800, 500],
};

/** Reaktionszeit beim manuellen Nachziehen einer Handkarte. */
const DRAW_DELAY: Record<BotLevel, [number, number]> = {
  easy: [950, 550],
  medium: [600, 350],
  hard: [320, 220],
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
    if (move.type === 'draw') return between(DRAW_DELAY[level], rng);
    if (move.type === 'ready') return 2_500 + rng.int(1_000);
    return 900 + rng.int(600);
  },
  chooseMove({ view, seat, level, rng }) {
    if (view.phase === 'roundEnd') return { type: 'ready' };
    const player = view.players[seat]!;
    const hand = player.hand;
    const moves = legalMoves(view, seat);
    const canDraw = moves.some((m) => m.type === 'draw');
    const plays = playsFor(view, hand) as Extract<SpeedMove, { type: 'play' }>[];

    if (plays.length === 0) {
      return canDraw ? { type: 'draw' } : { type: 'stuck' };
    }
    // Beim manuellen Nachziehen füllt der Bot bei sehr leerer Hand gelegentlich sofort auf, auf schweren Stufen legt er erst seine Kette ab.
    if (canDraw && hand.length <= 1 && level !== 'hard' && rng.chance(0.5)) {
      return { type: 'draw' };
    }
    if (level !== 'hard') return rng.pick(plays);

    // Schwer: die Karte, nach der die meisten weiteren Handkarten passen; bei Spit außerdem bevorzugt
    // Auslagestapel mit verdeckten Karten darunter abbauen; bei Gleichstand lieber auf den Stapel,
    // auf den gerade weniger passt (die anderen bleiben für die nächste Karte frei).
    const score = (m: (typeof plays)[number]) => {
      let keepsOther = 0;
      for (let i = 0; i < view.piles.length; i++) {
        if (i === m.pile) continue;
        const other = topOf(view.piles[i]!);
        if (other) keepsOther += hand.filter((c) => c !== m.card && fits(c, other, view.wrap)).length;
      }
      const slotIdx = hand.indexOf(m.card);
      const spitBonus = view.variant === 'spit' ? (player.spitDownCounts[slotIdx] ?? 0) * 3 : 0;
      return followUps(m.card, hand, view.wrap) * 10 + keepsOther + spitBonus - cardRank(m.card) / 100;
    };
    const best = Math.max(...plays.map(score));
    return rng.pick(plays.filter((m) => score(m) === best));
  },
};
