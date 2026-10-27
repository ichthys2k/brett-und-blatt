import { computeBotMove, resolveOptions, type BotLevel, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { endSum, FRACTION_POOL, gameModule, halfLabel, STONES, TERM_POOL, type DominoMove, type DominoState, type StoneId } from '../src';

const id = (a: number, b: number): StoneId => STONES.findIndex(([x, y]) => x === Math.min(a, b) && y === Math.max(a, b));
const start = (options: Options = {}, seats = 2, seed = 'test') => gameModule.setup(seats, resolveOptions(gameModule, options), seed);

function custom(hands: StoneId[][], options: Options = {}, chain: DominoState['chain'] = [], boneyard: StoneId[] = []): DominoState {
  return { ...start(options, hands.length), hands, chain, boneyard, turn: 0, opening: null, passes: 0, lacks: hands.map(() => []) };
}

describe('Regeln', () => {
  it('der höchste Pasch beginnt und muss zuerst gelegt werden', () => {
    const s = start();
    const opening = s.opening!;
    expect(s.hands[s.turn]).toContain(opening);
    expect(gameModule.legalMoves(s, s.turn)).toEqual([{ type: 'play', stone: opening, end: 'right' }]);
    expect(s.hands.every((h) => h.length === 7)).toBe(true);
    expect(start({}, 4).hands.every((h) => h.length === 5)).toBe(true);
    expect(start({ variant: 'block' }, 4).hands.every((h) => h.length === 7)).toBe(true);
  });

  it('anlegen dreht den Stein passend, nur passende Steine sind erlaubt', () => {
    const s = custom([[id(2, 5), id(1, 1)], [id(0, 0)]], {}, [{ stone: id(3, 5), left: 3, right: 5 }]);
    expect(gameModule.legalMoves(s, 0)).toEqual([{ type: 'play', stone: id(2, 5), end: 'right' }]);
    const next = gameModule.applyMove(s, 0, { type: 'play', stone: id(2, 5), end: 'right' }).state;
    expect(next.chain.at(-1)).toEqual({ stone: id(2, 5), left: 5, right: 2 });
  });

  it('ziehen, wenn nichts passt; beim Block passen', () => {
    const draw = custom([[id(1, 1)], [id(0, 0)]], {}, [{ stone: id(3, 5), left: 3, right: 5 }], [id(2, 2)]);
    expect(gameModule.legalMoves(draw, 0)).toEqual([{ type: 'draw' }]);
    const drawn = gameModule.applyMove(draw, 0, { type: 'draw' }).state;
    expect(drawn.hands[0]).toContain(id(2, 2));
    expect(drawn.lacks[0]).toEqual([3, 5]);
    const block = custom([[id(1, 1)], [id(0, 0)]], { variant: 'block' }, [{ stone: id(3, 5), left: 3, right: 5 }], [id(2, 2)]);
    expect(gameModule.legalMoves(block, 0)).toEqual([{ type: 'pass' }]);
  });

  it('wer zuerst leer ist, bekommt die Augen der anderen; dann neue Runde', () => {
    const s = custom([[id(5, 6)], [id(2, 3), id(4, 4)]], {}, [{ stone: id(3, 5), left: 3, right: 5 }]);
    const { state, events } = gameModule.applyMove(s, 0, { type: 'play', stone: id(5, 6), end: 'right' });
    expect(state.scores[0]).toBe(13);
    expect(state.round).toBe(2);
    expect(state.lastRound).toMatchObject({ winner: 0, points: 13, blocked: false });
    expect(events.some((e) => e.type === 'roundOver')).toBe(true);
  });

  it('gesperrt: die wenigsten Augen gewinnen', () => {
    let s = custom([[id(1, 1)], [id(6, 6)]], { variant: 'block' }, [{ stone: id(3, 5), left: 3, right: 5 }]);
    s = gameModule.applyMove(s, 0, { type: 'pass' }).state;
    s = gameModule.applyMove(s, 1, { type: 'pass' }).state;
    expect(s.lastRound).toMatchObject({ winner: 0, points: 12, blocked: true });
  });

  it('Fünfer-Domino: Vielfache von 5 an den Enden zählen sofort, Pasch doppelt', () => {
    expect(endSum([{ stone: id(5, 5), left: 5, right: 5 }])).toBe(10);
    expect(endSum([{ stone: id(2, 3), left: 2, right: 3 }, { stone: id(3, 3), left: 3, right: 3 }])).toBe(8);
    const s = custom([[id(5, 3), id(0, 0)], [id(1, 2)]], { variant: 'fives' }, [{ stone: id(5, 5), left: 5, right: 5 }]);
    // [5|5] … [5|3]: Pasch-Ende 10 + 3 = 13 – nichts. Gegenprobe mit [5|0]: 10 + 0 = 10.
    expect(gameModule.applyMove(s, 0, { type: 'play', stone: id(5, 3), end: 'left' }).state.scores[0]).toBe(0);
    const t = custom([[id(5, 0), id(0, 0)], [id(1, 2)]], { variant: 'fives' }, [{ stone: id(5, 5), left: 5, right: 5 }]);
    expect(gameModule.applyMove(t, 0, { type: 'play', stone: id(5, 0), end: 'left' }).state.scores[0]).toBe(10);
  });

  it('Spinner: erster Pasch wird zum Spinner und öffnet bis zu vier Enden', () => {
    // Kette mit Pasch in der Mitte [5|5] und [3|5] links, [5|2] rechts
    const s: DominoState = {
      ...start({ variant: 'fives', spinner: 'yes' }),
      chain: [
        { stone: id(3, 5), left: 3, right: 5 },
        { stone: id(5, 5), left: 5, right: 5 },
        { stone: id(5, 2), left: 5, right: 2 },
      ],
      spinnerIndex: 1,
      upBranch: [],
      downBranch: [],
      hands: [[id(5, 0), id(1, 2)], [id(1, 1)]],
      turn: 0,
      opening: null,
      passes: 0,
      lacks: [[], []],
    };

    // Beide Linienenden sind belegt: Anlegen an 'up' und 'down' muss für [5|0] erlaubt sein!
    const moves = gameModule.legalMoves(s, 0);
    expect(moves).toContainEqual({ type: 'play', stone: id(5, 0), end: 'up' });
    expect(moves).toContainEqual({ type: 'play', stone: id(5, 0), end: 'down' });

    // Wenn an 'up' angelegt wird:
    // Linkes Ende: 3, rechtes Ende: 2.
    // Unten ist noch frei (zählt Paschwert 5).
    // Oben liegt nun [5|0] (äußeres Ende 0).
    // Summe der offenen Enden: 3 + 2 + 5 + 0 = 10 Punkte (Vielfaches von 5)!
    const next = gameModule.applyMove(s, 0, { type: 'play', stone: id(5, 0), end: 'up' }).state;
    expect(next.upBranch).toHaveLength(1);
    expect(next.upBranch[0]).toEqual({ stone: id(5, 0), left: 5, right: 0 });
    expect(next.scores[0]).toBe(10);
  });

  it('Sicht: fremde Hände, Vorrat und Zufall bleiben verborgen', () => {
    const s = start({}, 3);
    const view = gameModule.playerView(s, 1);
    expect(view.hands[0]!.every((x) => x === null)).toBe(true);
    expect(view.boneyard.every((x) => x === null)).toBe(true);
    expect(view.rng).toEqual([0, 0, 0, 0]);
  });

  it('Mathe-Darstellungen (Terme & Brüche) liefern deterministische Beschriftungen für Werte 0..6', () => {
    const sTerms = start({ display: 'terms' });
    expect(sTerms.display).toBe('terms');
    const sFractions = start({ display: 'fractions' });
    expect(sFractions.display).toBe('fractions');

    for (let pip = 0 as const; pip <= 6; pip++) {
      const p = pip as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      expect(TERM_POOL[p].length).toBeGreaterThanOrEqual(4);
      expect(FRACTION_POOL[p].length).toBeGreaterThanOrEqual(4);
      expect(halfLabel(p, 'pips', 0, 0)).toBe(String(p));
      expect(TERM_POOL[p]).toContain(halfLabel(p, 'terms', 3, 1));
      expect(FRACTION_POOL[p]).toContain(halfLabel(p, 'fractions', 5, 0));
    }
  });
});

describe('Bot', () => {
  it('nimmt Fünferpunkte mit', () => {
    const s = custom([[id(5, 0), id(1, 2), id(6, 4)], [id(3, 4), id(1, 1)]], { variant: 'fives' }, [{ stone: id(5, 5), left: 5, right: 5 }]);
    const move = computeBotMove(gameModule, { gameId: 'dominoes', botId: 'dominoes', level: 'medium', seat: 0, view: gameModule.playerView(s, 0), seed: 'x', timeBudgetMs: 100 });
    expect(move).toEqual({ type: 'play', stone: id(5, 0), end: 'left' });
  });

  it('der schwere Bot schlägt den leichten meistens', () => {
    let wins = 0;
    const games = 10;
    for (let g = 0; g < games; g++) {
      let s = start({ variant: g % 2 ? 'fives' : 'draw', target: '50' }, 2, `duell/${g}`);
      const strong = g % 2;
      for (let step = 0; !gameModule.result(s); step++) {
        const seat = s.turn;
        const level: BotLevel = seat === strong ? 'hard' : 'easy';
        const move = computeBotMove(gameModule, { gameId: 'dominoes', botId: 'dominoes', level, seat, view: gameModule.playerView(s, seat), seed: `${g}/${step}`, timeBudgetMs: 50 }) as DominoMove;
        s = gameModule.applyMove(s, seat, move).state;
      }
      const r = gameModule.result(s);
      if (r?.kind === 'win' && r.winners.includes(strong)) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(7);
  }, 60_000);
});

describe('Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12 })) test(check.name, check.run, 120_000);
});
