import { gameModule, type MaexleMove, type MaexleState } from '../../../../packages/games/maexle/src/index';
import { platz, type SpielAdapter } from './typen';

const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
const ART: Record<MaexleMove['type'], number> = { roll: 0, announce: 1, believe: 2, doubt: 3, passBlind: 4 };

export const maexle: SpielAdapter<MaexleState, MaexleMove> = {
  nr: 9,
  id: 'maexle',
  modul: gameModule,
  varianten: [
    { name: 'Standard, zu dritt', snes: [2, 0, 0, 0, 0], optionen: { lives: '3', maexleCost: '2', blind: 'off', scoring: 'lives', shake: 'on' }, plaetze: 3 },
    { name: 'blind, 1 Leben Kosten, zu zweit', snes: [1, 1, 1, 0, 1], optionen: { lives: '2', maexleCost: '1', blind: 'on', scoring: 'lives', shake: 'off' } },
    { name: 'Strafpunkte, zu sechst', snes: [3, 0, 1, 1, 0], optionen: { lives: '4', maexleCost: '2', blind: 'on', scoring: 'points', shake: 'on' }, plaetze: 6 },
  ],
  zug: (_s, m) => (m.type === 'announce' || m.type === 'passBlind' ? [ART[m.type], m.value] : [ART[m.type]]),
  stand: (s) => [
    s.scoring === 'points' ? 1 : 0,
    s.limit,
    s.maexleCost,
    s.blind ? 1 : 0,
    s.shake ? 1 : 0,
    s.penalties.length,
    ...s.penalties,
    s.turn,
    s.phase === 'roll' ? 0 : s.phase === 'announce' ? 1 : 2,
    s.dice ? 1 : 0,
    s.dice?.[0] ?? 0,
    s.dice?.[1] ?? 0,
    platz(s.rolledBy),
    s.history.length,
    ...s.history.flatMap((a) => [a.seat, a.value, a.blind ? 1 : 0]),
    s.lastReveal ? 1 : 0,
    ...(s.lastReveal
      ? [
          s.lastReveal.dice ? 1 : 0,
          s.lastReveal.dice?.[0] ?? 0,
          s.lastReveal.dice?.[1] ?? 0,
          s.lastReveal.announcement.seat,
          s.lastReveal.announcement.value,
          s.lastReveal.announcement.blind ? 1 : 0,
          s.lastReveal.challenger,
          s.lastReveal.truthful ? 1 : 0,
          s.lastReveal.loser,
          s.lastReveal.amount,
          s.lastReveal.believedMaexle ? 1 : 0,
        ]
      : []),
    s.round & 0xff,
    s.round >> 8,
    ...s.record.flatMap((r) => [r.shown, r.lies, r.nearLies]),
    ...s.rng.flatMap(u32),
  ],
  partien: 25,
  botBilder: [5, 5, 5],
  gegenZufall: [8, 3],
};
