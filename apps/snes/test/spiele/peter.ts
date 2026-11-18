import { gameModule } from '../../../../packages/games/black-peter/src/index';
import type { BlackPeterMove, BlackPeterState, Card } from '../../../../packages/games/black-peter/src/rules';
import { type SpielAdapter } from './typen';

function cardIndex(card: Card | null): number {
  if (card === null) return 0xff;
  if (card.pair === -1) return 0xff;
  return card.pair * 2 + (card.side === 'b' ? 1 : 0);
}

export const peter: SpielAdapter<BlackPeterState, BlackPeterMove> = {
  nr: 19,
  id: 'black-peter',
  modul: gameModule,
  varianten: [
    {
      name: '12 Paare zu zweit',
      snes: [1],
      optionen: { pairs: '12', set: 'tiere' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: '8 Paare zu dritt',
      snes: [0],
      optionen: { pairs: '8', set: 'tiere' },
      plaetze: 3,
      siege: 4,
    },
    {
      name: '16 Paare zu viert',
      snes: [2],
      optionen: { pairs: '16', set: 'tiere' },
      plaetze: 4,
      siege: 4,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'draw') return [0, m.index];
    if (m.type === 'shuffle') return [1, 0];
    return [0, 0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    bytes.push(s.hands.length);
    bytes.push(s.turn);
    bytes.push(s.loser === null ? 0xff : s.loser);
    bytes.push(s.shuffledThisTurn ? 1 : 0);

    bytes.push(s.discarded.length);
    for (const d of s.discarded) {
      bytes.push(d.seat);
      bytes.push(d.pair);
    }

    for (let seat = 0; seat < s.hands.length; seat++) {
      const hand = s.hands[seat]!;
      bytes.push(hand.length);
      for (const c of hand) bytes.push(cardIndex(c));
    }

    for (let i = 0; i < 4; i++) {
      const v = s.rng[i] ?? 0;
      bytes.push(v & 0xff);
      bytes.push((v >> 8) & 0xff);
      bytes.push((v >> 16) & 0xff);
      bytes.push((v >> 24) & 0xff);
    }

    return bytes;
  },
  partien: 20,
  botBilder: [5, 10, 20],
  gegenZufall: [6, 4],
};
