import { gameModule, type LudoMove, type LudoState } from '../../../../packages/games/ludo/src/index';
import { platz, type SpielAdapter } from './typen';

const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
const BEREICH = { home: 0, track: 1, goal: 2 } as const;

export const ludo: SpielAdapter<LudoState, LudoMove> = {
  nr: 11,
  id: 'ludo',
  modul: gameModule,
  varianten: [
    { name: 'Kreuz zu zweit', snes: [0, 0, 0, 0, 0], optionen: {} },
    { name: 'Kreuz zu viert, Schlagpflicht, flexibel', snes: [0, 1, 0, 0, 1], optionen: { capture: 'on', exactGoal: 'off' }, plaetze: 4, siege: 3 },
    { name: 'Kreuz zu dritt, ein Wurf, 6 oder 1', snes: [0, 0, 1, 1, 0], optionen: { threeRolls: 'never', enterRule: 'six_or_one' }, plaetze: 3, siege: 4 },
    { name: 'Stern zu sechst', snes: [1, 0, 0, 0, 0], optionen: { board: 'six' }, plaetze: 6, siege: 1 },
    { name: 'Stern zu dritt, Schlagpflicht', snes: [1, 1, 0, 1, 0], optionen: { board: 'six', capture: 'on', enterRule: 'six_or_one' }, plaetze: 3, siege: 4 },
    { name: 'Stern zu zweit', snes: [1, 0, 0, 0, 1], optionen: { board: 'six', exactGoal: 'off' } },
  ],
  zug: (_s, m) => (m.type === 'roll' ? [0] : m.type === 'move' ? [1, m.pieceIndex] : [2]),
  stand: (s) => [
    s.seats,
    s.board === 'six' ? 1 : 0,
    s.turn,
    s.phase === 'move' ? 1 : 0,
    s.dice ?? 0,
    s.rollsLeft,
    s.canRollAgain ? 1 : 0,
    ...s.pieces.flatMap((row) => row.flatMap((p) => [BEREICH[p.area], p.index])),
    s.mandatoryCapture ? 1 : 0,
    s.threeRollsRule === 'never' ? 1 : 0,
    s.enterRule === 'six_or_one' ? 1 : 0,
    s.exactGoal ? 1 : 0,
    platz(s.lastRoll?.seat),
    platz(s.lastRoll?.dice),
    ...s.rng.flatMap(u32),
  ],
  partien: 6,
  botBilder: [5, 5, 5],
  gegenZufall: [8, 5],
};
