import { gameModule, type CheckersMove, type CheckersState } from '../../../../packages/games/checkers/src/index';
import { platz, type SpielAdapter } from './typen';

const ENDE: Record<string, number> = { captured: 1, blocked: 2, repetition: 3, drawMoves: 4 };
const VARIANTE: Record<string, number> = { german: 0, international: 1, english: 2 };

export const dame: SpielAdapter<CheckersState, CheckersMove> = {
  nr: 6,
  id: 'checkers',
  modul: gameModule,
  varianten: [
    { name: 'Deutsch 8×8', snes: [0, 0, 0], optionen: { variant: 'german', size: '8', board: 'turn' } },
    { name: 'International 10×10', snes: [1, 1, 1], optionen: { variant: 'international', size: '10', board: 'fixed' } },
    { name: 'Englisch 8×8', snes: [2, 0, 0], optionen: { variant: 'english', size: '8', board: 'turn' } },
    { name: 'International 8×8', snes: [1, 0, 0], optionen: { variant: 'international', size: '8', board: 'turn' } },
  ],
  zug: (_s, m) => {
    if (m.type !== 'move') throw new Error(`Remis-Zug im SNES-Vergleich: ${m.type}`);
    const caps = m.captures ?? [];
    const pfad = m.path ?? [];
    return [m.from, m.to, caps.length, ...caps, ...(caps.length ? [pfad.length, ...pfad] : [0])];
  },
  stand: (s) => [
    s.size,
    ...s.cells.map((c) => (c === null ? 0 : c.seat === 0 ? (c.king ? 2 : 1) : c.king ? 4 : 3)),
    s.turn,
    platz(s.winner),
    s.end ? ENDE[s.end]! : 0,
    s.sinceCaptureOrAdvance,
    platz(s.lastMove?.from),
    platz(s.lastMove?.to),
    s.history.length & 0xff,
    s.history.length >> 8,
    VARIANTE[s.variant]!,
  ],
  partien: 20,
  botBilder: [60, 90, 140],
  gegenZufall: [6, 5],
};
