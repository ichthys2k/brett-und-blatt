import { gameModule, type KniffelMove, type KniffelState } from '../../../../packages/games/kniffel/src/index';
import { ALL_CATEGORIES } from '../../../../packages/games/kniffel/src/rules';
import { type SpielAdapter } from './typen';

const LEER = 0xff;
const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

export const kniffel: SpielAdapter<KniffelState, KniffelMove> = {
  nr: 8,
  id: 'kniffel',
  modul: gameModule,
  varianten: [
    { name: 'allein', snes: [], optionen: {}, plaetze: 1 },
    { name: 'zu zweit', snes: [], optionen: {} },
    { name: 'zu sechst', snes: [], optionen: {}, plaetze: 6 },
  ],
  zug: (_s, m) => {
    if (m.type === 'roll') return [0];
    if (m.type === 'score') return [1, ALL_CATEGORIES.indexOf(m.category)];
    if (m.type === 'toggleHold') return [2, m.index];
    throw new Error(`Zug ${m.type} gibt es im ROM nicht`);
  },
  extra: (s) => (s.phase === 'roll' && s.rollsLeft > 0 && s.dice && !s.finished ? [0, 1, 2, 3, 4].map((index) => ({ type: 'toggleHold', index }) as KniffelMove) : []),
  stand: (s) => [
    s.seats,
    s.turn,
    s.phase === 'score' ? 1 : 0,
    s.rollsLeft,
    s.dice ? 1 : 0,
    ...(s.dice ? s.dice.values : [0, 0, 0, 0, 0]),
    ...(s.dice ? s.dice.held.map((h) => (h ? 1 : 0)) : [0, 0, 0, 0, 0]),
    ...s.sheets.flatMap((sh) => [
      ...ALL_CATEGORIES.map((c) => sh.scores[c] ?? LEER),
      sh.upperSum,
      sh.upperBonus,
      sh.lowerSum,
      sh.total & 0xff,
      sh.total >> 8,
    ]),
    s.finished ? 1 : 0,
    ...s.rng.flatMap(u32),
  ],
  partien: 6,
  botBilder: [10, 10, 10],
  gegenZufall: [6, 6],
};
