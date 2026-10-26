import { Rng, computeBotMove, resolveOptions, type BotLevel, type Options, type SeatId } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { CARD_SETS, cardsInPlay, formatValue, gameModule, groupOf, type CardSet, type QuartettMove, type QuartettState, type StackCard } from '../src';

function start(seats = 2, options: Options = {}, seed = 'test'): QuartettState {
  return gameModule.setup(seats, resolveOptions(gameModule, options), seed);
}

const apply = (state: QuartettState, move: QuartettMove) => gameModule.applyMove(state, state.turn, move);
const stack = (...cards: string[]): StackCard[] => cards.map((card) => ({ card, open: false }));

/** Trumpf-Stand mit festen Stapeln (Set Tiere). */
function trump(stacks: string[][], extra: Partial<QuartettState> = {}): QuartettState {
  return { ...start(stacks.length), stacks: stacks.map((cards) => stack(...cards)), ...extra };
}

/** Sammeln-Stand mit festen Händen (Set Tiere). */
function collect(hands: string[][], extra: Partial<QuartettState> = {}): QuartettState {
  const quartets = 'ABCDEFGH'
    .split('')
    .filter((group) => !hands.flat().some((card) => groupOf(card) === group))
    .map((group) => ({ seat: 0, group }));
  return { ...start(hands.length, { mode: 'collect' }), hands: hands.map((h) => [...h].sort()), talon: [], quartets, asks: [], turn: 0, ...extra };
}

describe('Kartensets', () => {
  // Jede Datei im Ordner, auch eine neue, die noch nicht eingebunden ist.
  const files = import.meta.glob<CardSet>('../../../../content/quartett/*.json', { eager: true, import: 'default' });
  const idOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace('.json', '');

  it('jede Datei in content/quartett ist eingebunden', () => {
    expect(Object.keys(files).map(idOf).sort()).toEqual(Object.keys(CARD_SETS).sort());
  });

  for (const [path, set] of Object.entries(files)) {
    const file = idOf(path);
    it(`${file}: 32 Karten in 8 Gruppen zu 4, alle Werte und Quellen vorhanden`, () => {
      expect(set.id).toBe(file);
      expect(set.license).toBe('CC-BY-SA-4.0');
      expect(set.groups.map((g) => g.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
      expect(set.cards.map((c) => c.id)).toEqual(set.groups.flatMap((g) => [1, 2, 3, 4].map((n) => `${g.id}${n}`)));
      expect(new Set(set.cards.map((c) => c.name)).size).toBe(32);
      expect(set.properties.length).toBeGreaterThanOrEqual(4);
      expect(set.properties.length).toBeLessThanOrEqual(6);
      for (const card of set.cards) {
        expect(card.emoji.length, card.name).toBeGreaterThan(0);
        for (const p of set.properties) {
          expect(Number.isFinite(card.values[p.id]), `${card.name}: ${p.label}`).toBe(true);
          expect(card.sources?.[p.id] ?? card.source, `${card.name}: Quelle für ${p.label}`).toBeTruthy();
        }
        expect(Object.keys(card.values).sort()).toEqual(set.properties.map((p) => p.id).sort());
      }
    });
  }

  it('formatiert Werte lesbar', () => {
    const p = { id: 'x', label: 'x', unit: '', higherWins: true };
    expect(formatValue(p, 6000)).toBe('6.000');
    expect(formatValue(p, 1_432_000_000)).toBe('1,43 Mrd.');
    expect(formatValue(p, 0.0022)).toBe('0,0022');
    expect(formatValue(p, 12.3)).toBe('12,3');
    expect(formatValue({ ...p, format: 'year' }, -1800)).toBe('1800 v. Chr.');
    expect(formatValue({ ...p, format: 'plain' }, 1902)).toBe('1902');
    expect(formatValue({ ...p, valueLabels: { '1': '1. Mose' } }, 1)).toBe('1. Mose');
  });
});

describe('Trumpf', () => {
  it('teilt alle 32 Karten verdeckt aus, Platz 1 beginnt', () => {
    const state = start(3);
    expect(state.stacks.map((s) => s.length)).toEqual([11, 11, 10]);
    expect(new Set(state.stacks.flat().map((e) => e.card)).size).toBe(32);
    expect(gameModule.currentPlayers(state)).toEqual([0]);
    expect(gameModule.legalMoves(state, 0)).toHaveLength(5);
    expect(gameModule.legalMoves(state, 1)).toHaveLength(0);
  });

  it('der höhere Wert gewinnt alle aufgedeckten Karten', () => {
    // A1 Elefant 6000 kg gegen E4 Meerschweinchen 1 kg.
    const { state, events } = apply(trump([['E4', 'B1'], ['A1', 'B2']]), { type: 'chooseProperty', property: 'weight' });
    expect(state.lastTrick?.winner).toBe(1);
    expect(state.stacks[0]!.map((e) => e.card)).toEqual(['B1']);
    expect(state.stacks[1]!.map((e) => e.card)).toEqual(['B2', 'A1', 'E4']);
    expect(state.stacks[1]!.slice(1).every((e) => e.open)).toBe(true);
    expect(state.turn).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['trick']);
  });

  it('bei „kleiner gewinnt“ siegt der niedrigere Wert', () => {
    // Dinosaurier: Erster Fund – Iguanodon (1822) vor Tyrannosaurus (1902).
    const base = { ...start(2, { set: 'dinosaurier' }), stacks: [stack('A1'), stack('F2')] };
    const { state } = gameModule.applyMove(base, 0, { type: 'chooseProperty', property: 'found' });
    expect(state.lastTrick?.winner).toBe(1);
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [1], reason: 'allCards' });
  });

  it('Gleichstand: Karten in die Mitte, derselbe Platz wählt erneut, der nächste Gewinner nimmt alles', () => {
    // Elefant und Giraffe haben beide 1 Junges, Hausrind auch: Gleichstand über zwei Runden.
    let state = trump([['A1', 'C2'], ['A2', 'C1']]);
    state = apply(state, { type: 'chooseProperty', property: 'offspring' }).state;
    expect(state.lastTrick?.winner).toBeNull();
    expect(state.middle).toEqual(['A1', 'A2']);
    expect(state.turn).toBe(0);
    // Hausschwein 11 Junge gegen Hausrind 1.
    state = apply(state, { type: 'chooseProperty', property: 'offspring' }).state;
    expect(state.lastTrick?.winner).toBe(0);
    expect(state.lastTrick?.cards).toBe(4);
    expect(state.middle).toEqual([]);
    expect(state.stacks[0]!.map((e) => e.card)).toEqual(['C2', 'C1', 'A1', 'A2']);
    expect(gameModule.result(state)?.kind).toBe('win');
  });

  it('Gleichstand mit der letzten Karte: Der Wählende scheidet aus, der Nächste ist dran', () => {
    let state = trump([['A1'], ['A2', 'B1'], ['C1', 'B2']]);
    state = apply(state, { type: 'chooseProperty', property: 'offspring' }).state;
    expect(state.stacks[0]).toHaveLength(0);
    expect(state.turn).toBe(1);
    expect(state.middle).toHaveLength(3);
    expect(gameModule.result(state)).toBeNull();
  });

  it('wer keine Karten hat, scheidet aus und wird übersprungen', () => {
    let state = trump([['A1', 'D1'], ['E4'], ['E3', 'H4']]);
    const { state: next, events } = apply(state, { type: 'chooseProperty', property: 'weight' });
    expect(events).toContainEqual({ type: 'out', seat: 1 });
    state = next;
    expect(state.stacks.map((s) => s.length)).toEqual([4, 0, 1]);
    // Der Blauwal (D1) schlägt den Polarfuchs; dann hat Platz 1 alles.
    state = apply(state, { type: 'chooseProperty', property: 'weight' }).state;
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0], reason: 'allCards' });
  });

  it('nach dem Rundenlimit gewinnt, wer die meisten Karten hat', () => {
    let state = start(2, { rounds: '15' }, 'limit');
    let guard = 0;
    while (!gameModule.result(state) && guard++ < 100) state = apply(state, { type: 'chooseProperty', property: 'speed' }).state;
    const result = gameModule.result(state)!;
    if (state.stacks.every((s) => s.length > 0)) {
      expect(state.round).toBe(15);
      const counts = state.stacks.map((s) => s.length);
      if (counts[0] === counts[1]) expect(result.kind).toBe('draw');
      else expect(result).toEqual({ kind: 'win', winners: [counts[0]! > counts[1]! ? 0 : 1], reason: 'rounds' });
    }
  });

  it('die Sicht zeigt nur die eigene oberste Karte und offen gewonnene Karten', () => {
    let state = trump([['E4', 'B1', 'B3'], ['A1', 'B2', 'B4']]);
    state = apply(state, { type: 'chooseProperty', property: 'weight' }).state;
    const view = gameModule.playerView(state, 0);
    expect(view.stacks[0]!.map((e) => e.card)).toEqual(['B1', null]);
    expect(view.stacks[1]!.map((e) => e.card)).toEqual([null, null, 'A1', 'E4']);
    const spectator = gameModule.playerView(state, 'spectator');
    expect(spectator.stacks[0]!.map((e) => e.card)).toEqual([null, null]);
  });
});

describe('Sammeln', () => {
  it('ab vier Spielern wird alles ausgeteilt, Quartette werden sofort abgelegt', () => {
    const state = start(4, { mode: 'collect' });
    const inHands = state.hands.flat().length + state.quartets.length * 4;
    expect(inHands).toBe(32);
    expect(state.talon).toEqual([]);
    expect(state.stacks).toEqual([]);
  });

  it('zu zweit und zu dritt: je 7 Karten, der Rest ist ein Stapel', () => {
    for (const seats of [2, 3]) {
      const state = start(seats, { mode: 'collect' });
      expect(state.hands.flat().length + state.quartets.length * 4).toBe(7 * seats);
      expect(state.talon).toHaveLength(32 - 7 * seats);
      expect(gameModule.playerView(state, 0).talon.every((c) => c === null)).toBe(true);
    }
  });

  it('Niete mit Stapel: Der Fragende zieht eine Karte, der Gefragte ist dran', () => {
    const state = collect([['A1', 'B1'], ['A2', 'B2']], { talon: ['C1', 'A3'] });
    const { state: next, events } = apply(state, { type: 'ask', target: 1, card: 'A3' });
    expect(next.hands[0]).toEqual(['A1', 'B1', 'C1']);
    expect(next.talon).toEqual(['A3']);
    expect(next.turn).toBe(1);
    expect(next.asks.at(-1)).toEqual({ asker: 0, target: 1, card: 'A3', got: false, drew: [0] });
    expect(events.map((e) => e.type)).toEqual(['asked', 'drew']);
  });

  it('wer seine letzte Karte abgibt, zieht vom Stapel nach', () => {
    const state = apply(collect([['A1', 'B1'], ['A2']], { talon: ['C1'] }), { type: 'ask', target: 1, card: 'A2' }).state;
    expect(state.hands[1]).toEqual(['C1']);
    expect(state.asks.at(-1)?.drew).toEqual([1]);
    expect(state.turn).toBe(0);
  });

  it('fragen nur nach fehlenden Karten von Gruppen, aus denen man selbst etwas hat', () => {
    const state = collect([['A1', 'A2', 'B1'], ['A3', 'A4', 'B2', 'B3', 'B4']]);
    const moves = gameModule.legalMoves(state, 0);
    expect(moves).toHaveLength(5);
    expect(moves).toContainEqual({ type: 'ask', target: 1, card: 'A3' });
    expect(() => gameModule.applyMove(state, 0, { type: 'ask', target: 1, card: 'C1' })).toThrow();
    expect(() => gameModule.applyMove(state, 0, { type: 'ask', target: 1, card: 'A1' })).toThrow();
    expect(() => gameModule.applyMove(state, 0, { type: 'ask', target: 0, card: 'A3' })).toThrow();
  });

  it('Treffer: Karte wandert, der Fragende fragt weiter und legt das Quartett ab', () => {
    let state = collect([['A1', 'A2', 'A3', 'B1'], ['A4', 'B2'], ['B3', 'B4']]);
    const first = apply(state, { type: 'ask', target: 1, card: 'A4' });
    state = first.state;
    expect(first.events).toEqual([
      { type: 'asked', asker: 0, target: 1, card: 'A4', got: true },
      { type: 'quartet', seat: 0, group: 'A' },
    ]);
    expect(state.hands[0]).toEqual(['B1']);
    expect(state.turn).toBe(0);
    expect(state.quartets.at(-1)).toEqual({ seat: 0, group: 'A' });
  });

  it('Niete: Der Gefragte ist dran', () => {
    const state = apply(collect([['A1', 'B1'], ['A2', 'A3', 'A4'], ['B2', 'B3', 'B4']]), { type: 'ask', target: 2, card: 'A2' }).state;
    expect(state.turn).toBe(2);
    expect(state.asks).toEqual([{ asker: 0, target: 2, card: 'A2', got: false, drew: [] }]);
  });

  it('wer nach dem Ablegen keine Karten mehr hat, gibt weiter; die Partie endet mit dem letzten Quartett', () => {
    let state = collect([['A1', 'A2', 'A3'], ['A4', 'B1'], ['B2', 'B3', 'B4']]);
    state = apply(state, { type: 'ask', target: 1, card: 'A4' }).state;
    expect(state.hands[0]).toEqual([]);
    expect(state.turn).toBe(1);
    state = apply(state, { type: 'ask', target: 2, card: 'B2' }).state;
    state = apply(state, { type: 'ask', target: 2, card: 'B3' }).state;
    state = apply(state, { type: 'ask', target: 2, card: 'B4' }).state;
    // Platz 0 hat im Hilfsaufbau alle anderen Gruppen: 7 gegen 1.
    expect(gameModule.result(state)).toEqual({ kind: 'win', winners: [0], reason: 'quartets' });
  });

  it('die Sicht verrät keine fremden Hände, Protokoll und Kartenzahlen sind öffentlich', () => {
    const state = apply(collect([['A1', 'B1'], ['A2', 'A3', 'A4'], ['B2', 'B3', 'B4']]), { type: 'ask', target: 2, card: 'A2' }).state;
    const view = gameModule.playerView(state, 1);
    expect(view.hands[1]).toEqual(['A2', 'A3', 'A4']);
    expect(view.hands[0]).toEqual([null, null]);
    expect(view.hands[2]).toEqual([null, null, null]);
    expect(view.asks).toHaveLength(1);
  });

  it('sampleHidden hält sich an alles, was das Protokoll verrät', () => {
    let state = collect([['A1', 'B1', 'C1'], ['A2', 'B2', 'C2', 'C3'], ['A3', 'A4', 'B3', 'B4', 'C4']]);
    state = apply(state, { type: 'ask', target: 1, card: 'B2' }).state; // 0 bekommt B2
    state = apply(state, { type: 'ask', target: 2, card: 'A2' }).state; // Niete: A2 liegt also bei 1
    state = apply(state, { type: 'ask', target: 1, card: 'A1' }).state; // Niete: A1 liegt also bei 0
    expect(state.turn).toBe(1);
    const view = gameModule.playerView(state, 2);
    for (let i = 0; i < 50; i++) {
      const sample = gameModule.sampleHidden!(view, 2, new Rng([i + 1, 2, 3, 4]));
      expect(sample.hands.map((h) => h.length)).toEqual(state.hands.map((h) => h.length));
      expect(sample.hands[2]).toEqual(state.hands[2]);
      expect(sample.hands[0]).toContain('B2');
      expect(sample.hands[0]).toContain('A1');
      expect(sample.hands[1]).toContain('A2');
      expect([...sample.hands.flat()].sort()).toEqual(cardsInPlay(state).sort());
    }
  });
});

/** Bot gegen Bot zu zweit: Wie oft gewinnt `strong` gegen `weak`? */
function winRate(mode: 'trump' | 'collect', strong: BotLevel, weak: BotLevel, games: number, seats = 2): number {
  let wins = 0;
  for (let g = 0; g < games; g++) {
    const strongSeat: SeatId = g % seats;
    let state = start(seats, { mode, rounds: '30' }, `stärke/${mode}/${g}`);
    for (let step = 0; !gameModule.result(state) && step < 2_000; step++) {
      const seat = state.turn;
      const level = seat === strongSeat ? strong : weak;
      const move = computeBotMove(gameModule, { gameId: 'quartett', botId: 'quartett', level, seat, view: gameModule.playerView(state, seat), seed: `${g}/${step}`, timeBudgetMs: 10 });
      state = gameModule.applyMove(state, seat, move as QuartettMove).state;
    }
    const result = gameModule.result(state);
    if (result?.kind === 'win' && result.winners.length === 1 && result.winners[0] === strongSeat) wins++;
    else if (result?.kind === 'draw' || (result?.kind === 'win' && result.winners.includes(strongSeat))) wins += 0.5;
  }
  return wins / games;
}

describe('Bot', () => {
  it('Trumpf: mittel schlägt leicht, schwer schlägt mittel', () => {
    expect(winRate('trump', 'medium', 'easy', 120)).toBeGreaterThan(0.6);
    expect(winRate('trump', 'hard', 'medium', 120)).toBeGreaterThan(0.52);
  });

  it('Sammeln: mittel schlägt leicht, schwer schlägt mittel (zu viert)', () => {
    expect(winRate('collect', 'medium', 'easy', 80, 4)).toBeGreaterThan(0.3);
    expect(winRate('collect', 'hard', 'medium', 80, 4)).toBeGreaterThan(0.27);
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [2, 4, 6], randomGames: 30, maxMoves: 5_000 })) test(check.name, check.run);
});
