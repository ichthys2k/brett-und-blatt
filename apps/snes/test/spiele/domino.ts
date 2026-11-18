import { gameModule, type DominoMove, type DominoState } from '../../../../packages/games/dominoes/src/index';
import { platz, type SpielAdapter } from './typen';

const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
const u16 = (v: number) => [v & 0xff, v >> 8];
const VARIANTE = { block: 0, draw: 1, fives: 2 } as const;
const ENDE = { left: 0, right: 1, up: 2, down: 3 } as const;

export const domino: SpielAdapter<DominoState, DominoMove> = {
  nr: 12,
  id: 'dominoes',
  modul: gameModule,
  varianten: [
    { name: 'Ziehen zu zweit', snes: [1, 0, 0, 1, 0], optionen: {} },
    { name: 'Block zu dritt, 50', snes: [0, 0, 0, 0, 0], optionen: { variant: 'block', target: '50' }, plaetze: 3, siege: 3 },
    { name: 'Fünfer mit Spinner zu zweit', snes: [2, 0, 0, 1, 1], optionen: { variant: 'fives', spinner: 'yes' } },
    { name: 'Fünfer zu viert in Teams, Doppel-9', snes: [2, 1, 1, 0, 0], optionen: { variant: 'fives', setSize: '9', teams: 'yes', target: '50' }, plaetze: 4, siege: 3 },
    { name: 'Ziehen zu viert, Doppel-12, 150', snes: [1, 2, 0, 2, 0], optionen: { setSize: '12', target: '150' }, plaetze: 4, siege: 2 },
  ],
  zug: (_s, m) => (m.type === 'play' ? [0, m.stone, ENDE[m.end as keyof typeof ENDE]] : m.type === 'draw' ? [1] : [2]),
  stand: (s) => {
    if (s.variant === 'mexican') throw new Error('Mexican Train gibt es im ROM nicht');
    return [
      s.seats,
      VARIANTE[s.variant],
      s.spinner ? 1 : 0,
      s.teams ? 1 : 0,
      s.setSize,
      ...u16(s.target),
      s.round,
      s.chain.length,
      ...s.chain.flatMap((c) => [c.stone, c.left, c.right]),
      platz(s.spinnerIndex),
      s.upBranch.length,
      ...s.upBranch.flatMap((c) => [c.stone, c.right]),
      s.downBranch.length,
      ...s.downBranch.flatMap((c) => [c.stone, c.right]),
      ...s.hands.flatMap((h) => [h.length, ...(h as number[])]),
      s.boneyard.length,
      ...(s.boneyard as number[]),
      ...s.scores.flatMap(u16),
      s.turn,
      platz(s.opening),
      s.passes,
      ...s.lacks.flatMap((l) => [...l, 0xff]),
      platz(s.lastPlayed?.seat),
      ...(s.lastPlayed ? [s.lastPlayed.stone, ENDE[s.lastPlayed.end as keyof typeof ENDE], ...u16(s.lastPlayed.scored)] : []),
      s.lastRound?.round ?? 0,
      ...(s.lastRound ? [platz(s.lastRound.winner), ...u16(s.lastRound.points), s.lastRound.blocked ? 1 : 0] : []),
      s.over ? 1 : 0,
      ...s.rng.flatMap(u32),
    ];
  },
  partien: 4,
  botBilder: [5, 40, 40],
  gegenZufall: [8, 5],
};
