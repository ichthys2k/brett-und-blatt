import { gameModule } from '../../../../packages/games/president/src/index';
import type { CardId, PresidentMove, PresidentState } from '../../../../packages/games/president/src/rules';
import { type SpielAdapter } from './typen';

const SUITS = ['C', 'D', 'H', 'S'];

function toCardIdx(card: CardId): number {
  const suit = SUITS.indexOf(card[0]!);
  const rank = parseInt(card.slice(1, card.indexOf('.')), 10);
  return suit * 13 + (rank - 1);
}

export const president: SpielAdapter<PresidentState, PresidentMove> = {
  nr: 21,
  id: 'president',
  modul: gameModule,
  varianten: [
    {
      name: '32 Karten zu dritt, 3 Runden',
      snes: [0, 0, 0],
      optionen: { rounds: '3', deck: '32' },
      plaetze: 3,
      siege: 2,
    },
    {
      name: '32 Karten zu viert, 3 Runden',
      snes: [0, 0, 0],
      optionen: { rounds: '3', deck: '32' },
      plaetze: 4,
      siege: 2,
    },
    {
      name: '52 Karten zu dritt, 3 Runden',
      snes: [0, 1, 0],
      optionen: { rounds: '3', deck: '52', twoHigh: 'on' },
      plaetze: 3,
      siege: 2,
    },
    {
      name: '52 Karten zu viert, 3 Runden',
      snes: [0, 1, 0],
      optionen: { rounds: '3', deck: '52', twoHigh: 'on' },
      plaetze: 4,
      siege: 2,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'play') {
      return [0, m.cards.length, ...m.cards.map(toCardIdx)];
    }
    if (m.type === 'pass') {
      return [1, 0];
    }
    if (m.type === 'give') {
      return [2, m.cards.length, ...m.cards.map(toCardIdx)];
    }
    if (m.type === 'ready') {
      return [3, 0];
    }
    return [0, 0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    const phaseMap: Record<string, number> = { play: 0, exchange: 1, roundEnd: 2, gameEnd: 3 };
    bytes.push(phaseMap[s.phase] ?? 0);
    bytes.push(s.round);
    bytes.push(s.turn);
    bytes.push(s.reversed ? 1 : 0);

    for (let seat = 0; seat < s.scores.length; seat++) {
      bytes.push((s.scores[seat]! + 128) & 0xff);
    }

    bytes.push(s.finished.length);
    for (const f of s.finished) bytes.push(f);

    for (let seat = 0; seat < s.lastPlace.length; seat++) {
      bytes.push(s.lastPlace[seat] === null ? 0xff : s.lastPlace[seat]!);
    }

    bytes.push(s.trick.length);
    for (const t of s.trick) {
      bytes.push(t.seat);
      bytes.push(t.cards.length);
      for (const c of t.cards) bytes.push(toCardIdx(c));
    }

    for (let seat = 0; seat < s.passed.length; seat++) {
      bytes.push(s.passed[seat] ? 1 : 0);
    }

    for (let seat = 0; seat < s.ready.length; seat++) {
      bytes.push(s.ready[seat] ? 1 : 0);
    }

    for (let seat = 0; seat < s.hands.length; seat++) {
      const hand = s.hands[seat]!;
      bytes.push(hand.length);
      for (const c of hand) bytes.push(toCardIdx(c));
    }

    bytes.push(s.swaps.length);
    for (const sw of s.swaps) {
      bytes.push(sw.low);
      bytes.push(sw.high);
      bytes.push(sw.count);
      bytes.push(sw.done ? 1 : 0);
    }

    return bytes;
  },
  partien: 20,
  botBilder: [5, 10, 20],
  gegenZufall: [6, 2],
};
