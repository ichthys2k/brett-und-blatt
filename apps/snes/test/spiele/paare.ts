import { gameModule, type PairsMove, type PairsState } from '../../../../packages/games/pairs/src/index';
import { type SpielAdapter } from './typen';

const SAETZE = ['tiere', 'einmaleins', 'englisch'];
const status = (s: PairsState['status'][number]) => (s === 'down' ? 0 : s === 'up' ? 1 : 0x10 + s.takenBy);

export const paare: SpielAdapter<PairsState, PairsMove> = {
  nr: 10,
  id: 'pairs',
  modul: gameModule,
  varianten: [
    { name: 'Tiere 12, allein', snes: [0, 0, 0], optionen: { set: 'tiere', size: '12' }, plaetze: 1 },
    { name: 'Tiere 16, zu zweit', snes: [0, 1, 0], optionen: { set: 'tiere', size: '16' } },
    { name: 'Einmaleins 30, zu dritt, Wechsel', snes: [1, 4, 1], optionen: { set: 'einmaleins', size: '30', continueOnPair: 'off' }, plaetze: 3 },
    { name: 'Englisch 24, zu sechst', snes: [2, 3, 0], optionen: { set: 'englisch', size: '24' }, plaetze: 6 },
    { name: 'Tiere 20, zu viert', snes: [0, 2, 0], optionen: { set: 'tiere', size: '20' }, plaetze: 4 },
  ],
  zug: (_s, m) => [m.card],
  stand: (s) => {
    if (!SAETZE.includes(s.set)) throw new Error(`Set ${s.set}`);
    const fehl = Object.entries(s.slips ?? {})
      .map(([k, v]) => [...k.split(':').map(Number), v] as [number, number, number])
      .sort((a, b) => a[0] * 6 + a[1] - (b[0] * 6 + b[1]));
    return [
      s.scores.length,
      s.cols,
      s.rows,
      s.continueOnPair ? 1 : 0,
      ...s.faces.flatMap((f, i) => [f!.pair, f!.side === 'a' ? 0 : 1, status(s.status[i]!)]),
      s.open.length,
      ...s.open,
      s.turn,
      ...s.scores,
      s.turns & 0xff,
      s.turns >> 8,
      s.step & 0xff,
      s.step >> 8,
      s.log.length,
      ...s.log.flatMap((e) => [e.card, e.face.pair, e.face.side === 'a' ? 0 : 1, e.step & 0xff, e.step >> 8]),
      ...fehl.flat(),
      0xff,
    ];
  },
  partien: 10,
  botBilder: [5, 5, 5],
  gegenZufall: [8, 5],
};
