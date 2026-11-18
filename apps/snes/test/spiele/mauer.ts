import { gameModule, type NumberWallMove, type NumberWallState } from '../../../../packages/games/number-wall/src/index';
import { Rng } from '../../../../packages/engine/src/random';
import { type SpielAdapter } from './typen';

const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
const u24 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff];
const MODUS = { natural: 0, integers: 1, decimals: 2, products: 3 } as const;
const zufall = Rng.fromSeed('mauer-extra');

/** Abgabe-Bytes: je Lücke 3 Bytes; zurück nur, wenn die Bytes eine Mauer ergeben, die isLegal annimmt. */
function lesen(s: NumberWallState, b: number[]): NumberWallMove | null {
  if (b[0] !== 0) return null;
  const values: number[] = [];
  let k = 1;
  for (let i = 0; i < s.givens.length; i++) {
    const g = s.givens[i];
    if (g !== null) {
      values.push(g!);
      continue;
    }
    if (k + 3 > b.length) return null;
    let v = b[k]! | (b[k + 1]! << 8) | (b[k + 2]! << 16);
    if (v & 0x800000) v -= 0x1000000;
    values.push(v);
    k += 3;
  }
  return k === b.length ? { type: 'submit', values } : null;
}

export const mauer: SpielAdapter<NumberWallState, NumberWallMove> = {
  nr: 13,
  id: 'number-wall',
  modul: gameModule,
  varianten: [
    { name: 'natürlich, 4 Stufen, allein', snes: [0, 1, 1], optionen: {}, plaetze: 1 },
    { name: 'ganz, 3 Stufen, zu dritt', snes: [1, 0, 0], optionen: { numbers: 'integers', height: '3', rounds: '3' }, plaetze: 3 },
    { name: 'Dezimal, 4 Stufen, zu zweit', snes: [2, 1, 1], optionen: { numbers: 'decimals' } },
    { name: 'Produkt, 4 Stufen, zu viert', snes: [3, 1, 2], optionen: { numbers: 'products', rounds: '8' }, plaetze: 4 },
    { name: 'Produkt, 3 Stufen, zu sechst', snes: [3, 0, 0], optionen: { numbers: 'products', height: '3', rounds: '3' }, plaetze: 6 },
  ],
  zug: (s, m) => [0, ...m.values.flatMap((v, i) => (s.givens[i] === null ? u24(v) : []))],
  // Freie Abgaben: zufällige Werte aus den Chips (wie über die Bedienung).
  extra: (s) => {
    const seat = gameModule.currentPlayers(s)[0];
    if (seat === undefined) return [];
    return [{ type: 'submit', values: s.givens.map((g) => g ?? zufall.pick(s.choicePool)) }];
  },
  pruefen: (s, b) => {
    const m = lesen(s, b);
    const seat = gameModule.currentPlayers(s)[0];
    return m !== null && seat !== undefined && gameModule.isLegal!(s, seat, m);
  },
  stand: (s) => [
    s.seats,
    MODUS[s.numberMode],
    s.height,
    s.totalRounds,
    s.round,
    s.phase === 'done' ? 1 : 0,
    ...s.solution.flatMap((v, i) => [s.givens[i] === null ? 0 : 1, ...u24(v)]),
    s.choicePool.length,
    ...s.choicePool.flatMap(u24),
    ...s.submissions.flatMap((sub) => (sub ? [1, ...sub.values!.flatMap(u24), sub.correctCount!, sub.points!] : [0xff])),
    ...s.scores.flatMap((v) => [v & 0xff, v >> 8]),
    s.lastRound?.round ?? 0,
    ...(s.lastRound ? s.lastRound.submissions.flatMap((x) => [x.correctCount, x.points]) : []),
    ...s.rng.flatMap(u32),
  ],
  partien: 4,
  botBilder: [5, 5, 5],
  gegenZufall: [6, 5],
};
