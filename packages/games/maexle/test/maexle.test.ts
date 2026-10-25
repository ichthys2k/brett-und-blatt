import { computeBotMove, resolveOptions, type BotLevel, type Options, type SeatId } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { MAEXLE, PROBABILITY, RANKING, chanceAtLeast, gameModule, isDouble, rankOf, valueOf, type MaexleMove, type MaexleState } from '../src';

function start(seats = 3, options: Options = {}, seed = 'test'): MaexleState {
  return gameModule.setup(seats, resolveOptions(gameModule, options), seed);
}

const apply = (state: MaexleState, move: MaexleMove) => gameModule.applyMove(state, state.turn, move).state;

/** Ein Spielstand, in dem `seat` gerade mit `dice` gewürfelt hat. */
function rolled(state: MaexleState, dice: [number, number]): MaexleState {
  const next = apply(state, { type: 'roll' });
  return { ...next, dice };
}

describe('Rangfolge und Wahrscheinlichkeiten', () => {
  it('21 Werte, Pasche über allen normalen, Mäxle ganz oben', () => {
    expect(RANKING).toHaveLength(21);
    expect(new Set(RANKING).size).toBe(21);
    expect(RANKING[RANKING.length - 1]).toBe(MAEXLE);
    const lowestDouble = Math.min(...RANKING.filter(isDouble).map(rankOf));
    const highestNormal = Math.max(...RANKING.filter((v) => !isDouble(v) && v !== MAEXLE).map(rankOf));
    expect(lowestDouble).toBeGreaterThan(highestNormal);
    expect(rankOf(66)).toBeGreaterThan(rankOf(11));
  });

  it('jeder Wurf zweier Würfel ergibt einen Wert der Rangfolge', () => {
    const counts = new Map<number, number>();
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) counts.set(valueOf([a, b]), (counts.get(valueOf([a, b])) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual([...RANKING].sort());
    for (const [value, count] of counts) expect(PROBABILITY[rankOf(value)]).toBeCloseTo(count / 36);
  });

  it('die Wahrscheinlichkeiten ergeben zusammen 36/36', () => {
    expect(PROBABILITY.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(chanceAtLeast(0)).toBeCloseTo(1);
    expect(chanceAtLeast(rankOf(MAEXLE))).toBeCloseTo(2 / 36);
  });
});

describe('Regeln', () => {
  it('die Ansage muss höher sein als die vorige', () => {
    let state = rolled(start(), [4, 2]);
    expect(gameModule.legalMoves(state, 0)).toHaveLength(21);
    state = apply(state, { type: 'announce', value: 54 });
    state = apply(state, { type: 'believe' });
    expect(state.phase).toBe('announce');
    const values = gameModule.legalMoves(state, 1).map((m) => (m.type === 'announce' ? m.value : null));
    expect(values[0]).toBe(61);
    expect(values).not.toContain(54);
    expect(() => apply(state, { type: 'announce', value: 53 })).toThrow();
  });

  it('Anzweifeln einer Lüge kostet den Ansager ein Leben, er beginnt die neue Runde', () => {
    let state = rolled(start(), [3, 1]);
    state = apply(state, { type: 'announce', value: 55 });
    state = apply(state, { type: 'doubt' });
    expect(state.penalties).toEqual([1, 0, 0]);
    expect(state.lastReveal).toMatchObject({ truthful: false, loser: 0, challenger: 1, dice: [3, 1] });
    expect(state.turn).toBe(0);
    expect(state.phase).toBe('roll');
    expect(state.history).toEqual([]);
    expect(state.record[0]).toEqual({ shown: 1, lies: 1, nearLies: 0 });
  });

  it('Anzweifeln einer wahren Ansage kostet den Zweifler ein Leben', () => {
    let state = rolled(start(), [5, 5]);
    state = apply(state, { type: 'announce', value: 44 });
    state = apply(state, { type: 'doubt' });
    expect(state.penalties).toEqual([0, 1, 0]);
    expect(state.turn).toBe(1);
  });

  it('Mäxle glauben kostet ein Leben ohne Aufdecken', () => {
    let state = rolled(start(), [3, 2]);
    state = apply(state, { type: 'announce', value: MAEXLE });
    state = apply(state, { type: 'believe' });
    expect(state.penalties).toEqual([0, 1, 0]);
    expect(state.lastReveal).toMatchObject({ dice: null, believedMaexle: true, loser: 1 });
  });

  it('echtes Mäxle anzweifeln kostet zwei Leben – oder eines mit der Option', () => {
    for (const [cost, expected] of [['2', 2], ['1', 1]] as const) {
      let state = rolled(start(3, { maexleCost: cost }), [1, 2]);
      state = apply(state, { type: 'announce', value: MAEXLE });
      state = apply(state, { type: 'doubt' });
      expect(state.penalties).toEqual([0, expected, 0]);
    }
    let state = rolled(start(), [6, 6]);
    state = apply(state, { type: 'announce', value: MAEXLE });
    state = apply(state, { type: 'doubt' });
    expect(state.penalties).toEqual([1, 0, 0]);
  });

  it('blind weitergeben nur mit Option; die Lüge zählt für den Blinden', () => {
    let state = rolled(start(3), [4, 3]);
    state = apply(state, { type: 'announce', value: 43 });
    expect(gameModule.legalMoves(state, 1).some((m) => m.type === 'passBlind')).toBe(false);

    state = rolled(start(3, { blind: 'on' }), [4, 3]);
    state = apply(state, { type: 'announce', value: 43 });
    state = apply(state, { type: 'passBlind', value: 51 });
    expect(state.turn).toBe(2);
    expect(state.dice).toEqual([4, 3]);
    state = apply(state, { type: 'doubt' });
    expect(state.penalties).toEqual([0, 1, 0]);
  });

  it('wer keine Leben mehr hat, scheidet aus; der Letzte gewinnt', () => {
    let state = start(3, { lives: '1' });
    state = rolled(state, [3, 1]);
    state = apply(state, { type: 'announce', value: 66 });
    state = apply(state, { type: 'doubt' });
    expect(state.penalties[0]).toBe(1);
    // Platz 0 ist raus, deshalb beginnt Platz 1 und gibt an Platz 2 weiter.
    expect(state.turn).toBe(1);
    expect(gameModule.result(state)).toBeNull();
    state = rolled(state, [3, 2]);
    state = apply(state, { type: 'announce', value: 32 });
    expect(state.turn).toBe(2);
    state = apply(state, { type: 'doubt' });
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [1], reason: 'lives' });
  });

  it('Strafpunkte: niemand scheidet aus, die wenigsten Punkte gewinnen', () => {
    let state = start(3, { lives: '1', scoring: 'points' });
    state = rolled(state, [3, 1]);
    state = apply(state, { type: 'announce', value: 66 });
    state = apply(state, { type: 'doubt' });
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [1, 2], reason: 'points' });

    state = start(3, { lives: '2', scoring: 'points' });
    state = rolled(state, [3, 1]);
    state = apply(state, { type: 'announce', value: 66 });
    state = apply(state, { type: 'doubt' });
    expect(gameModule.result(state)).toBeNull();
    expect(state.turn).toBe(0);
  });

  it('die Sicht zeigt den Wurf nur dem Würfelnden bis zum Aufdecken', () => {
    let state = apply(start(), { type: 'roll' });
    expect(gameModule.playerView(state, 0).dice).toEqual(state.dice);
    expect(gameModule.playerView(state, 1).dice).toBeNull();
    expect(gameModule.playerView(state, 'spectator').dice).toBeNull();
    expect(gameModule.playerView(state, 0).rng).toEqual([0, 0, 0, 0]);
    state = apply(state, { type: 'announce', value: 31 });
    expect(gameModule.playerView(state, 1).dice).toBeNull();
    const dice = state.dice;
    state = apply(state, { type: 'doubt' });
    expect(gameModule.playerView(state, 2).lastReveal?.dice).toEqual(dice);
  });

  it('kein Ereignis verrät den Wurf vor dem Aufdecken', () => {
    const { events } = gameModule.applyMove(start(), 0, { type: 'roll' });
    expect(JSON.stringify(events)).not.toContain('dice');
  });
});

/** Partie zwischen Bots; `levels[seat]` legt die Stufe je Platz fest. Gibt die Gewinner zurück. */
function botGame(levels: BotLevel[], seed: string): SeatId[] {
  let state = gameModule.setup(levels.length, resolveOptions(gameModule), seed);
  for (let step = 0; !gameModule.result(state); step++) {
    const seat = state.turn;
    const move = computeBotMove(gameModule, {
      gameId: 'maexle',
      botId: 'maexle',
      level: levels[seat]!,
      seat,
      view: gameModule.playerView(state, seat),
      seed: `${seed}/${step}`,
      timeBudgetMs: 10,
    }) as MaexleMove;
    state = gameModule.applyMove(state, seat, move).state;
  }
  const result = gameModule.result(state);
  return result?.kind === 'win' ? result.winners : [];
}

describe('Bot', () => {
  it('der schwere Bot schlägt den leichten deutlich', () => {
    let hardWins = 0;
    const games = 300;
    for (let g = 0; g < games; g++) {
      // Abwechselnd beginnen, damit der Anfang nichts verzerrt.
      const levels: BotLevel[] = g % 2 === 0 ? ['hard', 'easy'] : ['easy', 'hard'];
      const winners = botGame(levels, `stärke${g}`);
      if (winners.includes(g % 2 === 0 ? 0 : 1)) hardWins++;
    }
    // Bei gleich starken Bots wären 150 ± 9 Siege zu erwarten.
    expect(hardWins).toBeGreaterThan(games * 0.56);
  });

  it('der schwere Bot hat keine feste Lügenquote', () => {
    // Gleiche Lage, verschiedene Zufallszahlen: Mal sagt er die Wahrheit, mal mehr.
    const state = rolled(start(2), [5, 3]);
    const said = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const move = computeBotMove(gameModule, { gameId: 'maexle', botId: 'maexle', level: 'hard', seat: 0, view: gameModule.playerView(state, 0), seed: `quote${i}`, timeBudgetMs: 10 }) as MaexleMove;
      if (move.type === 'announce') said.add(move.value);
    }
    expect(said.has(53)).toBe(true);
    expect(said.size).toBeGreaterThan(1);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 24, seatCounts: [2, 3, 10] })) test(check.name, check.run);
});
