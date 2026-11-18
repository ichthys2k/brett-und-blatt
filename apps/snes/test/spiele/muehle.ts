import { gameModule, type MillMove, type MillState } from '../../../../packages/games/mill/src/index';
import { platz, type SpielAdapter } from './typen';

const zugBytes = (m: MillMove) => [m.type === 'place' ? 0 : 1, m.type === 'move' ? m.from : 0xff, m.to, m.remove.length, ...[...m.remove].sort((a, b) => a - b)];

export const muehle: SpielAdapter<MillState, MillMove> = {
  nr: 5,
  id: 'mill',
  modul: gameModule,
  varianten: [
    { name: 'Standard', snes: [0, 0, 0, 0], optionen: { flying: 'on', removeFromMills: 'fallback', doubleMill: 'one', drawRule: '50' } },
    { name: 'ohne Springen, immer, zwei, 30', snes: [1, 1, 1, 1], optionen: { flying: 'off', removeFromMills: 'always', doubleMill: 'two', drawRule: '30' } },
    { name: 'Doppelmühle, Remis aus', snes: [0, 0, 1, 2], optionen: { flying: 'on', removeFromMills: 'fallback', doubleMill: 'two', drawRule: 'off' } },
  ],
  zug: (_s, m) => zugBytes(m),
  stand: (s) => [
    ...s.cells.map(platz),
    s.inHand[0],
    s.inHand[1],
    s.turn,
    s.sinceMill & 0xff,
    s.sinceMill >> 8,
    platz(s.winner),
    s.draw === 'repetition' ? 1 : s.draw === 'moveLimit' ? 2 : 0,
    ...(s.lastMove ? [zugBytes(s.lastMove).length, ...zugBytes(s.lastMove)] : [0]),
    s.rules.flying ? 1 : 0,
    s.rules.removeFromMills === 'always' ? 1 : 0,
    s.rules.doubleRemove ? 1 : 0,
    s.rules.drawAfter,
  ],
  partien: 20,
  botBilder: [60, 90, 140],
  gegenZufall: [6, 5],
};
