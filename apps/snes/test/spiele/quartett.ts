import { gameModule } from '../../../../packages/games/quartett/src/index';
import type { CardId, QuartettMove, QuartettState } from '../../../../packages/games/quartett/src/rules';
import { type SpielAdapter } from './typen';

const PROPERTIES = ['weight', 'length', 'speed', 'lifespan', 'offspring'];

function toCardIdx(card: CardId): number {
  const grp = card.charCodeAt(0) - 65;
  const num = parseInt(card[1]!, 10) - 1;
  return grp * 4 + num;
}

export const quartett: SpielAdapter<QuartettState, QuartettMove> = {
  nr: 20,
  id: 'quartett',
  modul: gameModule,
  varianten: [
    {
      name: 'Trumpf zu zweit',
      snes: [0, 0],
      optionen: { mode: 'trump', rounds: '30', set: 'tiere' },
      plaetze: 2,
      siege: 3,
    },
    {
      name: 'Trumpf zu viert',
      snes: [0, 0],
      optionen: { mode: 'trump', rounds: '30', set: 'tiere' },
      plaetze: 4,
      siege: 2,
    },
    {
      name: 'Sammeln zu zweit',
      snes: [1, 0],
      optionen: { mode: 'collect', set: 'tiere' },
      plaetze: 2,
      siege: 2,
    },
    {
      name: 'Sammeln zu dritt',
      snes: [1, 0],
      optionen: { mode: 'collect', set: 'tiere' },
      plaetze: 3,
      siege: 2,
    },
    {
      name: 'Sammeln zu viert',
      snes: [1, 0],
      optionen: { mode: 'collect', set: 'tiere' },
      plaetze: 4,
      siege: 2,
    },
  ],
  zug: (_s, m) => {
    if (m.type === 'chooseProperty') {
      return [0, PROPERTIES.indexOf(m.property)];
    }
    if (m.type === 'ask') {
      return [1, m.target, toCardIdx(m.card)];
    }
    return [0, 0];
  },
  stand: (s) => {
    const bytes: number[] = [];
    const isTrump = s.mode === 'trump';
    bytes.push(isTrump ? 0 : 1);
    bytes.push(s.turn);

    if (isTrump) {
      bytes.push(s.round);
      bytes.push(s.roundLimit);
      bytes.push(s.middle.length);
      for (const c of s.middle) bytes.push(toCardIdx(c));

      for (let seat = 0; seat < s.stacks.length; seat++) {
        const stack = s.stacks[seat]!;
        bytes.push(stack.length);
        for (const item of stack) {
          bytes.push(toCardIdx(item.card!));
          bytes.push(item.open ? 1 : 0);
        }
      }
    } else {
      bytes.push(s.talon.length);
      for (const c of s.talon) bytes.push(toCardIdx(c!));

      bytes.push(s.quartets.length);
      for (const q of s.quartets) {
        bytes.push(q.seat);
        bytes.push(q.group.charCodeAt(0) - 65);
      }

      for (let seat = 0; seat < s.hands.length; seat++) {
        const hand = s.hands[seat]!;
        bytes.push(hand.length);
        for (const c of hand) bytes.push(toCardIdx(c!));
      }
    }

    return bytes;
  },
  partien: 20,
  botBilder: [5, 10, 20],
  gegenZufall: [6, 2],
};
