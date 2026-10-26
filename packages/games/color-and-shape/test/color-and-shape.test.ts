import { computeBotMove, type BotLevel } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { checkPlacement, gameModule, placements, validLine, type ColorShapeState, type Placed, type TileId } from '../src';

/** Stein aus Farbe, Form und Exemplar. */
const t = (color: number, shape: number, copy = 0): TileId => color * 18 + shape * 3 + copy;
const at = (x: number, y: number, tile: TileId): Placed => ({ x, y, tile });

function state(board: Placed[], hand: TileId[], seats = 2): ColorShapeState {
  const base = gameModule.setup(seats, {}, 'test');
  return { ...base, board, hands: [hand, ...base.hands.slice(1)], turn: 0 };
}

describe('Regeln', () => {
  it('Reihen: gleiche Farbe oder gleiche Form, keine Doppelten, höchstens sechs', () => {
    expect(validLine([t(0, 0), t(0, 1), t(0, 2)])).toBe(true);
    expect(validLine([t(0, 0), t(1, 0), t(2, 0)])).toBe(true);
    expect(validLine([t(0, 0), t(1, 1)])).toBe(false);
    expect(validLine([t(0, 0), t(0, 0, 1)])).toBe(false);
  });

  it('Punkte: jede berührte Reihe zählt, Sechserreihe +6', () => {
    const board = [at(0, 0, t(0, 0)), at(1, 0, t(0, 1))];
    // Ein Stein an die Zweierreihe: 3 Punkte.
    expect(checkPlacement(board, [t(0, 2)], [at(2, 0, t(0, 2))])).toMatchObject({ ok: true, points: 3 });
    // Ein Stein, der zwei Reihen bildet: Reihe 3 + Spalte 2 = 5.
    const cross = [...board, at(2, 1, t(1, 2))];
    expect(checkPlacement(cross, [t(0, 2, 1)], [at(2, 0, t(0, 2, 1))])).toMatchObject({ ok: true, points: 5 });
    // Sechserreihe: 6 + 6.
    const five = [0, 1, 2, 3, 4].map((s) => at(s, 0, t(0, s)));
    expect(checkPlacement(five, [t(0, 5)], [at(5, 0, t(0, 5))])).toMatchObject({ ok: true, points: 12, fullLines: 1 });
    // Erster Stein allein: 1 Punkt.
    expect(checkPlacement([], [t(3, 3)], [at(0, 0, t(3, 3))])).toMatchObject({ ok: true, points: 1 });
  });

  it('nicht erlaubt: Lücken, zwei Reihen, ohne Anlegen, fremde Steine, falsche Reihe', () => {
    const board = [at(0, 0, t(0, 0))];
    const hand = [t(0, 1), t(0, 2), t(0, 3), t(1, 1)];
    expect(checkPlacement(board, hand, [at(1, 0, t(0, 1)), at(3, 0, t(0, 2))]).ok).toBe(false);
    expect(checkPlacement(board, hand, [at(1, 0, t(0, 1)), at(0, 1, t(0, 2))]).ok).toBe(false);
    expect(checkPlacement(board, hand, [at(5, 5, t(0, 1))]).ok).toBe(false);
    expect(checkPlacement(board, hand, [at(1, 0, t(4, 4))]).ok).toBe(false);
    expect(checkPlacement(board, hand, [at(1, 0, t(1, 1))]).ok).toBe(false);
    // Über einen liegenden Stein hinweg ist erlaubt.
    expect(checkPlacement(board, hand, [at(-1, 0, t(0, 1)), at(1, 0, t(0, 2))])).toMatchObject({ ok: true, points: 3 });
  });

  it('die Zugsuche findet jeden erlaubten Zug und nur solche', () => {
    const board = [at(0, 0, t(0, 0)), at(1, 0, t(0, 1)), at(1, 1, t(1, 1))];
    const hand = [t(0, 2), t(0, 3), t(1, 2), t(2, 1), t(0, 2, 1), t(5, 5)];
    const found = placements({ board }, hand);
    for (const move of found) expect(checkPlacement(board, hand, move.tiles).ok).toBe(true);
    // Rot-Raute und Rot-Stern zusammen rechts an die rote Reihe.
    expect(found.some((m) => m.tiles.length === 2 && m.points === 4)).toBe(true);
  });

  it('Tauschen zieht neue Steine, Ende mit leerem Beutel und Bonus', () => {
    let s = gameModule.setup(2, {}, 'tausch');
    const hand = s.hands[s.turn] as TileId[];
    const swapped = gameModule.applyMove(s, s.turn, { type: 'swap', tiles: hand.slice(0, 3) }).state;
    expect(swapped.hands[s.turn]).toHaveLength(6);
    expect(swapped.bag.slice(0, 3)).toEqual(hand.slice(0, 3));
    // Letzter Stein bei leerem Beutel: +6 und Ende.
    s = { ...state([at(0, 0, t(0, 0))], [t(0, 1)]), bag: [] };
    const end = gameModule.applyMove(s, 0, { type: 'place', tiles: [at(1, 0, t(0, 1))] }).state;
    expect(end.over).toBe(true);
    expect(end.scores[0]).toBe(2 + 6);
    expect(gameModule.result(end)).toEqual({ kind: 'win', winners: [0] });
  });

  it('die Sicht verrät keine fremden Steine und gezogene Steine nur dem Ziehenden', () => {
    const s = gameModule.setup(3, {}, 'sicht');
    const view = gameModule.playerView(s, 1);
    expect(view.hands[1]).toEqual(s.hands[1]);
    expect(view.hands[0]!.every((x) => x === null)).toBe(true);
    expect(view.bag.every((x) => x === null)).toBe(true);
    expect(gameModule.eventView!({ type: 'drew', seat: 0, tiles: [1, 2] }, 1)).toEqual({ type: 'drew', seat: 0, count: 2 });
  });
});

describe('Bot', () => {
  it('nimmt die Sechserreihe', () => {
    const five = [0, 1, 2, 3, 4].map((s) => at(s, 0, t(0, s)));
    const s = state(five, [t(0, 5), t(3, 3), t(4, 4), t(2, 1), t(1, 2), t(5, 0)]);
    const move = computeBotMove(gameModule, { gameId: 'color-and-shape', botId: 'color-and-shape', level: 'medium', seat: 0, view: gameModule.playerView(s, 0), seed: 'x', timeBudgetMs: 100 });
    expect(move).toMatchObject({ type: 'place' });
    expect(checkPlacement(five, s.hands[0] as TileId[], (move as { tiles: Placed[] }).tiles)).toMatchObject({ points: 12 });
  });

  it('der schwere Bot schlägt den leichten meistens', () => {
    let wins = 0;
    for (let g = 0; g < 6; g++) {
      let s = gameModule.setup(2, {}, `duell/${g}`);
      const strong = g % 2;
      while (!gameModule.result(s)) {
        const seat = s.turn;
        const level: BotLevel = seat === strong ? 'hard' : 'easy';
        const move = computeBotMove(gameModule, { gameId: 'color-and-shape', botId: 'color-and-shape', level, seat, view: gameModule.playerView(s, seat), seed: `${g}/${s.board.length}/${s.bag.length}`, timeBudgetMs: 50 });
        s = gameModule.applyMove(s, seat, move as never).state;
      }
      const r = gameModule.result(s);
      if (r?.kind === 'win' && r.winners.includes(strong)) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  }, 60_000);
});

describe('Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 6 })) test(check.name, check.run, 120_000);
});
