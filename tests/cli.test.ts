import { describe, expect, it } from 'vitest';
// @ts-expect-error – reines JavaScript ohne Typen (Text-Client, #336)
import { parseArgs } from '../apps/cli/src/main.mjs';
// @ts-expect-error – reines JavaScript ohne Typen
import { formatMoves, formatResult, shortJson } from '../apps/cli/src/format.mjs';

type Game = { legalMoves: unknown[]; moveLabels?: string[]; yourSeat: number | null; seats: { name: string }[]; result: unknown };

describe('Text-Client (#336)', () => {
  it('liest die Befehlszeile', () => {
    const options = parseArgs(['neu', '--spiel', 'tic-tac-toe', '--bot', 'leicht', '--platz', '2', '--start', '--server', 'http://127.0.0.1:8787/']);
    expect(options).toMatchObject({ code: null, game: 'tic-tac-toe', bot: 'easy', seat: 1, start: true, server: 'http://127.0.0.1:8787' });
    expect(parseArgs(['🐻🦊🌈🚀']).code).toBe('🐻🦊🌈🚀');
    expect(() => parseArgs(['neu', '--bot', 'gemein'])).toThrow();
    expect(() => parseArgs(['neu', '--unbekannt'])).toThrow();
  });

  it('nummeriert die Züge mit den Zugtexten des Servers, sonst mit JSON', () => {
    const withLabels: Game = { legalMoves: [{ cell: 0 }, { cell: 4 }], moveLabels: ['Kreuz auf oben links', 'Kreuz auf Mitte'], yourSeat: 0, seats: [], result: null };
    expect(formatMoves(withLabels)).toBe('    1) Kreuz auf oben links\n    2) Kreuz auf Mitte');
    const without: Game = { legalMoves: [{ type: 'pass' }], yourSeat: 0, seats: [], result: null };
    expect(formatMoves(without)).toBe('    1) {"type":"pass"}');
  });

  it('kürzt lange Sichten und nennt das Ergebnis', () => {
    expect((shortJson({ text: 'x'.repeat(1000) }, 20) as string).length).toBe(20);
    const game: Game = { legalMoves: [], yourSeat: 0, seats: [{ name: 'Ada' }, { name: 'Bot' }], result: { kind: 'win', winners: [0] } };
    expect(formatResult(game)).toBe('Partie vorbei: Du gewinnst! 🎉');
    expect(formatResult({ ...game, yourSeat: 1 })).toBe('Partie vorbei: Es gewinnt Platz 1 (Ada).');
  });
});
