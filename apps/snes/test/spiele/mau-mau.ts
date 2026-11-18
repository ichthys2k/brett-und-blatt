import type { CardId } from '../../../../packages/engine/src/types';
import { gameModule } from '../../../../packages/games/mau-mau/src/index';
import type { MauMauMove, MauMauState } from '../../../../packages/games/mau-mau/src/types';
import { type SpielAdapter } from './typen';

const SUITS = ['C', 'D', 'H', 'S'];

function cardIndex(card: CardId): number {
  const suit = SUITS.indexOf(card[0] as any);
  const dot = card.indexOf('.');
  const rank = Number(dot === -1 ? card.slice(1) : card.slice(1, dot));
  return suit * 13 + (rank - 1);
}

export const mauMau: SpielAdapter<MauMauState, MauMauMove> = {
  nr: 17,
  id: 'mau-mau',
  modul: gameModule,
  varianten: [
    {
      name: 'Standard zu zweit',
      snes: [0, 0, 0, 0, 0, 0, 0],
      optionen: {
        sevenStack: 'on',
        nineReverse: 'on',
        aceExtraTurn: 'off',
        jackOnEverything: 'on',
        jackOnJack: 'forbidden',
        mauCall: 'on',
        drawRule: 'one',
      },
      plaetze: 2,
      siege: 3,
    },
    {
      name: 'Ohne Stapeln, Ass extra, zu dritt',
      snes: [1, 0, 1, 0, 0, 0, 0],
      optionen: {
        sevenStack: 'off',
        nineReverse: 'on',
        aceExtraTurn: 'on',
        jackOnEverything: 'on',
        jackOnJack: 'forbidden',
        mauCall: 'on',
        drawRule: 'one',
      },
      plaetze: 3,
      siege: 2,
    },
    {
      name: 'Ziehen bis passend, zu viert',
      snes: [0, 0, 0, 0, 0, 0, 1],
      optionen: {
        sevenStack: 'on',
        nineReverse: 'on',
        aceExtraTurn: 'off',
        jackOnEverything: 'on',
        jackOnJack: 'forbidden',
        mauCall: 'on',
        drawRule: 'untilMatch',
      },
      plaetze: 4,
      siege: 1,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'play') {
      const card = cardIndex(m.cardId);
      const suit = m.chosenSuit ? SUITS.indexOf(m.chosenSuit) : 0xff;
      const call = m.callMau ? 1 : 0;
      return [0, card, suit, call];
    }
    if (m.type === 'draw') return [1, 0, 0, 0];
    if (m.type === 'pass') return [2, 0, 0, 0];
    if (m.type === 'catchMau') return [3, m.target, 0, 0];
    return [0, 0, 0, 0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    bytes.push(s.hands.length);
    bytes.push(s.turn);
    bytes.push(s.winner === null ? 0xff : s.winner);
    bytes.push((s.direction + 256) & 0xff);
    bytes.push(SUITS.indexOf(s.activeSuit));
    bytes.push(s.pendingDraw);
    bytes.push(s.hasDrawn ? 1 : 0);

    bytes.push(s.discard.length);
    for (const c of s.discard) bytes.push(cardIndex(c));

    bytes.push(s.stock.length);
    for (const c of s.stock) bytes.push(cardIndex(c));

    for (let seat = 0; seat < s.hands.length; seat++) {
      const hand = s.hands[seat]!;
      bytes.push(hand.length);
      for (const c of hand) bytes.push(cardIndex(c));
      bytes.push(s.mauProtection[seat] ? 1 : 0);
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
