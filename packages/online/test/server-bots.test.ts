import type { AnyGameModule } from '@brett-und-blatt/engine';
import { gameModule as ticTacToe } from '@brett-und-blatt/game-tic-tac-toe';
import { describe, expect, it } from 'vitest';
import { serverBotRunner } from '../src';

describe('Bots auf dem Server', () => {
  it('eine Suche bis zum Zeitablauf endet auch bei stehender Uhr – nach festen Schritten', async () => {
    let looks = 0;
    // Ein Bot, der nur über die Uhr aufhört – wie die Monte-Carlo-Suche.
    const module = {
      ...ticTacToe,
      bots: [
        {
          id: 'uhr',
          name: 'Uhr',
          levels: ['easy'],
          chooseMove(ctx: { now: () => number; timeBudgetMs: number }) {
            const deadline = ctx.now() + ctx.timeBudgetMs;
            while (ctx.now() < deadline) looks++;
            return { cell: 0 };
          },
        },
      ],
    } as unknown as AnyGameModule;
    const runner = serverBotRunner([module], { stepMs: 1 });
    const move = await runner.requestMove({ gameId: 'tic-tac-toe', botId: 'uhr', level: 'easy', seat: 0, view: ticTacToe.setup(2, {}, 's'), seed: 's', timeBudgetMs: 100 });
    expect(move).toEqual({ cell: 0 });
    expect(looks).toBe(99);
  });
});
