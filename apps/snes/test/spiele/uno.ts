import { gameModule } from '../../../../packages/games/uno/src/index';
import type { UnoMove, UnoState } from '../../../../packages/games/uno/src/types';
import { type SpielAdapter } from './typen';

const LIGHT_COLORS = ['red', 'yellow', 'green', 'blue'];

function cardIndex(cardId: string): number {
  return Number(cardId.slice(2)) - 1;
}

export const uno: SpielAdapter<UnoState, UnoMove> = {
  nr: 18,
  id: 'uno',
  modul: gameModule,
  varianten: [
    {
      name: 'Klassisch zu zweit',
      snes: [0, 0, 0],
      optionen: {
        variant: 'classic',
        stacking: 'same',
        drawRule: 'one',
        callUno: 'on',
        sevenZero: 'off',
        jumpIn: 'off',
      },
      plaetze: 2,
      siege: 3,
    },
    {
      name: 'Ohne Stapeln zu dritt',
      snes: [1, 0, 0],
      optionen: {
        variant: 'classic',
        stacking: 'off',
        drawRule: 'one',
        callUno: 'on',
        sevenZero: 'off',
        jumpIn: 'off',
      },
      plaetze: 3,
      siege: 2,
    },
    {
      name: 'Ziehen bis passend zu viert',
      snes: [0, 1, 0],
      optionen: {
        variant: 'classic',
        stacking: 'same',
        drawRule: 'untilMatch',
        callUno: 'on',
        sevenZero: 'off',
        jumpIn: 'off',
      },
      plaetze: 4,
      siege: 1,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'play') {
      const card = cardIndex(m.cardId);
      const color = m.chosenColor ? LIGHT_COLORS.indexOf(m.chosenColor) : 0xff;
      const call = m.callUno ? 1 : 0;
      return [0, card, color, call];
    }
    if (m.type === 'draw') return [1, 0, 0, 0];
    if (m.type === 'pass') return [2, 0, 0, 0];
    if (m.type === 'catchUno') return [3, m.target, 0, 0];
    return [0, 0, 0, 0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    bytes.push(s.hands.length);
    bytes.push(s.turn);
    bytes.push(s.winner === null ? 0xff : s.winner);
    bytes.push((s.direction + 256) & 0xff);
    bytes.push(LIGHT_COLORS.indexOf(s.activeColor as any));
    bytes.push(s.pendingDraw);
    bytes.push(s.hasDrawn ? 1 : 0);

    bytes.push(s.discard.length);
    for (const c of s.discard) bytes.push(cardIndex(c.id));

    bytes.push(s.stock.length);
    for (const c of s.stock) bytes.push(cardIndex(c.id));

    for (let seat = 0; seat < s.hands.length; seat++) {
      const hand = s.hands[seat]!;
      bytes.push(hand.length);
      for (const c of hand) bytes.push(cardIndex(c.id));
      bytes.push(s.unoProtection[seat] ? 1 : 0);
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
  botBilder: [10, 20, 40],
  gegenZufall: [6, 4],
};
