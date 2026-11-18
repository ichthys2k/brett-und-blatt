import { gameModule, type FactorGridMove, type FactorGridState } from '../../../../packages/games/factor-grid/src/index';
import { platz, type SpielAdapter } from './typen';

export const teiler: SpielAdapter<FactorGridState, FactorGridMove> = {
  nr: 7,
  id: 'factor-grid',
  modul: gameModule,
  varianten: [
    { name: 'Steuer 30, zu zweit', snes: [0, 1], optionen: { variant: 'taxman', gridSize: '30' } },
    { name: 'Steuer 50, allein', snes: [0, 2], optionen: { variant: 'taxman', gridSize: '50' }, plaetze: 1 },
    { name: 'Kette 20, zu zweit', snes: [1, 0], optionen: { variant: 'chain', gridSize: '20' } },
    { name: 'Kette 30, allein', snes: [1, 1], optionen: { variant: 'chain', gridSize: '30' }, plaetze: 1 },
  ],
  zug: (_s, m) => [m.number],
  stand: (s) => [
    s.seats,
    s.variant === 'chain' ? 1 : 0,
    s.size,
    ...s.owners.map(platz),
    s.scores[0] & 0xff,
    s.scores[0] >> 8,
    s.scores[1] & 0xff,
    s.scores[1] >> 8,
    s.turn,
    platz(s.lastPick),
    s.history.length,
    s.phase === 'done' ? 1 : 0,
    s.winner === 'draw' ? 2 : platz(s.winner),
    platz(s.lastAction?.actor),
    platz(s.lastAction?.picked),
    s.lastAction?.taxed.length ?? 0,
    ...(s.lastAction?.taxed ?? []),
    s.lastAction?.swept.length ?? 0,
    ...(s.lastAction?.swept ?? []),
  ],
  partien: 30,
  botBilder: [20, 60, 130],
  gegenZufall: [6, 4],
};
