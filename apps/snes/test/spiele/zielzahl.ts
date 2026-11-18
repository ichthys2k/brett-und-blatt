import {
  gameModule,
  findCandidateMoves,
  type CalcStep,
  type TargetNumberMove,
  type TargetNumberState,
} from '../../../../packages/games/target-number/src/index';
import { type SpielAdapter } from './typen';

const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
const u24 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff];
const OP_ZU_SNES = { '+': 0, '-': 1, '*': 2, '/': 3 } as const;
const SNES_ZU_OP = ['+', '-', '*', '/'] as const;

function lesen(b: number[]): TargetNumberMove | null {
  if (b.length < 3 || b[0] !== 0) return null;
  const schritte = b[1]!;
  if (schritte > 3 || b.length !== 3 + schritte * 3) return null;
  const steps: CalcStep[] = [];
  for (let i = 0; i < schritte; i++) {
    const op = SNES_ZU_OP[b[3 + i * 3]!];
    if (!op) return null;
    steps.push({ a: b[2 + i * 3]!, op, b: b[4 + i * 3]! });
  }
  const finalIndex = b[2 + schritte * 3]!;
  return { type: 'submit', steps, finalIndex };
}

export const zielzahl: SpielAdapter<TargetNumberState, TargetNumberMove> = {
  nr: 14,
  id: 'target-number',
  modul: gameModule,
  varianten: [
    { name: 'Klassisch 24 (+ − · :), 5 Runden, allein', snes: [0, 1], optionen: {}, plaetze: 1 },
    { name: 'Klassisch 24 (+ − ·), 3 Runden, zu zweit', snes: [1, 0], optionen: { ops: 'addSubMul', rounds: '3' }, plaetze: 2 },
    { name: 'Klassisch 24 (+ − · :), 8 Runden, zu dritt', snes: [0, 2], optionen: { rounds: '8' }, plaetze: 3 },
    { name: 'Klassisch 24 (+ − · :), 3 Runden, zu sechst', snes: [0, 0], optionen: { rounds: '3' }, plaetze: 6 },
  ],
  zug: (_s, m) => [0, m.steps.length, ...m.steps.flatMap((st) => [st.a, OP_ZU_SNES[st.op], st.b]), m.finalIndex],
  extra: (s) => {
    const seat = gameModule.currentPlayers(s)[0];
    if (seat === undefined) return [];
    return findCandidateMoves(s.cards, s.target, s.allowedOps, 3).map((c) => c.move);
  },
  pruefen: (s, b) => {
    const m = lesen(b);
    const seat = gameModule.currentPlayers(s)[0];
    return m !== null && seat !== undefined && gameModule.isLegal!(s, seat, m);
  },
  stand: (s) => [
    s.seats,
    s.allowedOps === 'addSubMul' ? 1 : 0,
    s.totalRounds,
    s.round,
    s.phase === 'done' ? 1 : 0,
    s.target,
    ...s.cards,
    ...s.submissions.flatMap((sub) =>
      sub && sub.submitted && sub.value !== null
        ? [1, ...u24(sub.value), sub.usedAll ? 1 : 0, sub.points ?? 0]
        : [0xff],
    ),
    ...s.scores.flatMap((v) => [v & 0xff, (v >> 8) & 0xff]),
    s.lastRound?.round ?? 0,
    ...(s.lastRound
      ? s.lastRound.submissions.flatMap((sub) => [...u24(sub.value), sub.usedAll ? 1 : 0, sub.points])
      : []),
    ...s.rng.flatMap(u32),
  ],
  partien: 4,
  botBilder: [2, 2, 2],
  gegenZufall: [6, 5],
};
