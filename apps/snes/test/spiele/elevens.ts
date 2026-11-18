import { gameModule, type ElevensMove, type ElevensState } from '../../../../packages/games/elevens/src/index';
import { type SpielAdapter } from './typen';

const COLORS = ['r', 'y', 'g', 'b'];

function cardIndex(c: string): number {
  const col = COLORS.indexOf(c[0]!);
  const val = Number(c.slice(1));
  return col * 20 + (val - 1);
}

export const elevens: SpielAdapter<ElevensState, ElevensMove> = {
  nr: 15,
  id: 'elevens',
  modul: gameModule,
  varianten: [
    { name: 'Standard (3 Karten, Rote Elf)', snes: [0, 0], optionen: { draw: '3', start: 'red' }, siege: 3 },
    { name: '1 Karte ziehen, Frei', snes: [1, 1], optionen: { draw: '1', start: 'free' }, siege: 3 },
    { name: 'Bis passt, Rote Elf, zu dritt', snes: [2, 0], optionen: { draw: 'match', start: 'red' }, plaetze: 3, siege: 2 },
  ],
  zug: (_s, m) => {
    if (m.type === 'play') return [0, cardIndex(m.card)];
    if (m.type === 'draw') return [1, 0];
    return [2, 0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    bytes.push(s.seats);
    bytes.push(s.turn);
    bytes.push(s.winner === null ? 0xff : s.winner);
    bytes.push(s.played);
    bytes.push(s.drawn);
    bytes.push(s.opening === null ? 0xff : cardIndex(s.opening));

    for (const c of ['r', 'y', 'g', 'b'] as const) {
      const row = s.rows[c];
      bytes.push(row ? row.low : 0);
      bytes.push(row ? row.high : 0);
    }

    for (let p = 0; p < s.seats; p++) {
      const hand = s.hands[p] ?? [];
      bytes.push(hand.length);
      for (const card of hand) bytes.push(cardIndex(card));
    }

    bytes.push(s.stock.length);
    for (const card of s.stock) bytes.push(cardIndex(card));

    return bytes;
  },
  partien: 20,
  botBilder: [10, 30, 80],
  gegenZufall: [6, 4],
};
