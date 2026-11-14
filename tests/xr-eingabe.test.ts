/**
 * VR-App (#358): Bei Spielen mit freier Eingabe baut die App den Zug selbst. Hier wird geprüft,
 * dass sie aus den Werten der Beispielzüge genau diese Züge baut und dass der Server sie annimmt.
 */
import { describe, expect, it } from 'vitest';
import type { AnyGameModule } from '../packages/engine/src';
import { resolveOptions } from '../packages/engine/src';
import type { GameMessage } from '../packages/online/src';
import { onlineGames } from '../apps/server/src/games';
import { inputPlan } from '../apps/xr/src/scene/input-spec';
import { tafelLines } from '../apps/xr/src/scene/tafel-lines';

// Wer bin ich? bietet freies Raten (guessText) nur in manchen Spielarten an; die Eingabe dafür ist dieselbe Tastatur wie bei Wort-Salat.
const GAMES = ['duck-rally', 'estimate', 'timeline', 'word-salad', 'category-sprint', 'describe-duel', 'number-wall', 'target-number', 'symbol-match'];

/** Baut aus einem Beispielzug dieselbe Eingabe nach, die ein Mensch machen würde. */
function rebuild(plan: NonNullable<ReturnType<typeof inputPlan>>, sample: Record<string, unknown>): unknown[] {
  const spec = plan.spec;
  switch (spec.kind) {
    case 'number':
      return [spec.make((sample.value ?? sample.answer) as number)];
    case 'text': {
      const text = (sample.word ?? sample.text ?? (sample.words as string[] | undefined)?.join(' ')) as string;
      return [spec.make(text, (sample.category as number | undefined) ?? 0)];
    }
    case 'choice':
      return spec.options.map((o) => o.move);
    case 'numbers':
      return [spec.make(sample.values as number[])];
    case 'order':
      return [spec.make(sample.answer as number[])];
    case 'calc':
      return [spec.make(sample.steps as { a: number; op: string; b: number }[], sample.finalIndex as number)];
    case 'symbols':
      return spec.targets.flatMap((t) => t.symbols.map((s) => s.move));
  }
}

describe('VR-Eingabe', () => {
  for (const id of GAMES) {
    it(`${id}: gebaute Züge passen zu den Beispielzügen`, () => {
      const module = onlineGames.find((m) => m.info.id === id) as AnyGameModule;
      const seats = Math.max(2, module.info.players.min);
      // Systemzüge (Zeitablauf, Strömung) nur, wenn sonst niemand ziehen kann – der Server wartet damit auch.
      let state = module.setup(seats, resolveOptions(module, {}), `xr-${id}`);
      let checked = 0;
      for (let step = 0; step < 200 && !module.result(state); step++) {
        const current = module.currentPlayers(state).filter((a): a is number => a !== 'system');
        if (current.length === 0 || current.every((s) => module.legalMoves(state, s).length === 0)) {
          const sys = module.legalMoves(state, 'system')[0];
          if (sys === undefined) break;
          state = module.applyMove(state, 'system', sys).state;
          continue;
        }
        const seat = current[step % current.length]!;
        const legalMoves = module.legalMoves(state, seat) as Record<string, unknown>[];
        const message = { gameId: id, yourSeat: seat, seats: Array.from({ length: seats }, (_, i) => ({ name: `P${i + 1}` })), view: module.playerView(state, seat), legalMoves, result: null } as unknown as GameMessage;
        const plan = inputPlan(message);
        if (plan) {
          for (const sample of legalMoves.filter((m) => plan.hide.includes(m.type as string))) {
            const built = rebuild(plan, sample);
            expect(built, `${id}: ${JSON.stringify(sample)}`).toContainEqual(sample);
            for (const move of built) if (module.isLegal) expect(module.isLegal(state, seat, move), JSON.stringify(move)).toBe(true);
            checked++;
          }
        }
        state = module.applyMove(state, seat, legalMoves[(step * 3) % legalMoves.length]).state;
      }
      expect(checked, `${id}: keine Eingabe geprüft`).toBeGreaterThan(0);
    });
  }

  it('Spieltafel und Eingabe lesen jede Sicht ohne Fehler', () => {
    for (const module of onlineGames) {
      const seats = Math.max(2, module.info.players.min);
      let state = module.setup(seats, resolveOptions(module, {}), `tafel-${module.info.id}`);
      for (let step = 0; step < 80 && !module.result(state); step++) {
        const actors = module.currentPlayers(state);
        const seat = actors.find((a): a is number => a !== 'system' && module.legalMoves(state, a).length > 0);
        for (let s = 0; s < seats; s++) {
          const message = { gameId: module.info.id, yourSeat: s, seats: Array.from({ length: seats }, (_, i) => ({ name: `P${i + 1}` })), view: module.playerView(state, s), legalMoves: module.legalMoves(state, s), result: null } as unknown as GameMessage;
          expect(() => tafelLines(message), module.info.id).not.toThrow();
          expect(() => inputPlan(message), module.info.id).not.toThrow();
        }
        const actor = seat ?? (actors.includes('system') ? 'system' : null);
        if (actor === null) break;
        const moves = module.legalMoves(state, actor);
        if (moves.length === 0) break;
        state = module.applyMove(state, actor, moves[(step * 7) % moves.length]).state;
      }
    }
  });
});
