import { describe, expect, it, test } from 'vitest';
import { Rng, computeBotMove } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { gameModule } from '../src';
import { FRACTION_GROUPS, ORDERS, buildCards, deckSize, mathNotations, mathValue, setSize, shared, symbolText, SYMBOL_SETS } from '../src/deck';
import { DUEL_MS, applyMove, currentPlayers, isLegal, legalMoves, playerView, result, sampleHidden, setup, systemDelayMs, type SymbolMatchMove, type SymbolMatchState } from '../src/rules';

describe('symbol-match: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule)) test(check.name, check.run, 120_000);
});

describe('symbol-match: Kartensatz', () => {
  for (const order of ORDERS) {
    it(`Ordnung ${order}: ${deckSize(order)} Karten mit je ${order + 1} Symbolen, je zwei genau ein gemeinsames`, () => {
      const cards = buildCards(order);
      expect(cards).toHaveLength(deckSize(order));
      expect(cards.every((c) => c.length === order + 1 && new Set(c).size === c.length)).toBe(true);
      for (let a = 0; a < cards.length; a++)
        for (let b = a + 1; b < cards.length; b++) expect(cards[a]!.filter((s) => cards[b]!.includes(s))).toHaveLength(1);
      // Jedes Symbol kommt auf genau n + 1 Karten vor.
      const counts = new Map<number, number>();
      for (const c of cards) for (const s of c) counts.set(s, (counts.get(s) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === order + 1)).toBe(true);
      expect(counts.size).toBe(deckSize(order));
    });
  }

  it('hat in jedem Symbolpaket genug verschiedene Symbole', () => {
    for (const { value } of SYMBOL_SETS) {
      expect(setSize(value)).toBeGreaterThanOrEqual(57);
      const texts = new Set(Array.from({ length: 57 }, (_, s) => symbolText(value, s, 0)));
      if (value !== 'math' && value !== 'fractions') expect(texts.size).toBe(57);
    }
  });

  it('Brüche & Einheiten: 57 eindeutige Gruppen ohne doppelte Schreibweisen', () => {
    expect(FRACTION_GROUPS).toHaveLength(57);
    const seen = new Set<string>();
    for (const group of FRACTION_GROUPS) {
      expect(group.length).toBeGreaterThanOrEqual(3);
      for (const text of group) {
        expect(seen.has(text)).toBe(false);
        seen.add(text);
      }
    }
  });

  it('Mathe-Paket: alle Schreibweisen ergeben denselben Wert', () => {
    const evaluate = (text: string): number => {
      if (text.includes('²')) return Number(text.replace('²', '')) ** 2;
      const m = /^(\d+) ([+−:]) (\d+)$/.exec(text) ?? /^(\d+)(·)(\d+)$/.exec(text);
      if (!m) return Number(text);
      const [a, op, b] = [Number(m[1]), m[2], Number(m[3])];
      return op === '+' ? a + b : op === '−' ? a - b : op === ':' ? a / b : a * b;
    };
    for (let symbol = 0; symbol < 57; symbol++) {
      const list = mathNotations(mathValue(symbol));
      expect(list.length).toBeGreaterThanOrEqual(5);
      for (const n of list) expect(evaluate(n.text)).toBe(n.value);
    }
  });
});

/** Ein Tisch in der Grundstellung mit bestimmten Karten. */
function table(patch: Partial<SymbolMatchState>, seats = 2, options: Record<string, string> = {}): SymbolMatchState {
  return { ...setup(seats, options, 'test'), ...patch };
}

const claimFor = (state: SymbolMatchState, seat: number, target = seat, symbol?: number): Extract<SymbolMatchMove, { type: 'claim' }> => ({
  type: 'claim',
  symbol: symbol ?? shared(state.options.order, state.center!, state.stacks[target]!.at(-1)!),
  center: state.center!,
  target,
  top: state.stacks[target]!.at(-1)!,
});

describe('symbol-match: Regeln', () => {
  it('Turmbau: Treffer legt die Mittelkarte auf den eigenen Turm', () => {
    const s = setup(2, { order: '3' }, 'a');
    expect(s.stacks.map((x) => x.length)).toEqual([1, 1]);
    expect(s.deck).toHaveLength(13 - 3);
    const center = s.center!;
    const next = applyMove(s, 0, claimFor(s, 0)).state;
    expect(next.stacks[0]).toHaveLength(2);
    expect(next.stacks[0]!.at(-1)).toBe(center);
    expect(next.center).not.toBe(center);
    expect(next.hits[0]).toBe(1);
  });

  it('ein falsches Symbol sperrt den Platz bis zur nächsten Mittelkarte', () => {
    const s = setup(3, { order: '5' }, 'b');
    const right = claimFor(s, 0).symbol;
    const wrong = claimFor(s, 0, 0, (right + 1) % 31);
    const afterMistake = applyMove(s, 0, wrong).state;
    expect(afterMistake.locked).toEqual([true, false, false]);
    expect(afterMistake.mistakes[0]).toBe(1);
    expect(currentPlayers(afterMistake)).toEqual([1, 2]);
    expect(isLegal(afterMistake, 0, claimFor(afterMistake, 0))).toBe(false);
    // Ein anderer trifft: Alle sind wieder frei.
    const after = applyMove(afterMistake, 1, claimFor(afterMistake, 1)).state;
    expect(after.locked).toEqual([false, false, false]);
  });

  it('sind alle gesperrt, werden alle frei und die Mittelkarte wird verworfen (Turmbau)', () => {
    const s = setup(2, { order: '5' }, 'c');
    const wrong = (state: SymbolMatchState, seat: number) => claimFor(state, seat, seat, (claimFor(state, seat).symbol + 1) % 31);
    const one = applyMove(s, 0, wrong(s, 0)).state;
    const two = applyMove(one, 1, wrong(one, 1)).state;
    expect(two.locked).toEqual([false, false]);
    expect(two.center).not.toBe(s.center);
    expect(two.last).toMatchObject({ ok: false, burned: true });
    expect(two.stacks.map((x) => x.length)).toEqual([1, 1]);
  });

  it('ein Zug auf eine inzwischen verschwundene Mittelkarte ist nicht mehr erlaubt (zu spät)', () => {
    const s = setup(2, { order: '5' }, 'd');
    const slow = claimFor(s, 1);
    const after = applyMove(s, 0, claimFor(s, 0)).state;
    expect(isLegal(after, 1, slow)).toBe(false);
  });

  it('Turmbau: Ist der Stapel leer, gewinnt der höchste Turm', () => {
    let s = setup(2, { order: '3' }, 'e');
    for (let i = 0; i < 20 && s.phase === 'play'; i++) s = applyMove(s, 0, claimFor(s, 0)).state;
    expect(s.phase).toBe('gameEnd');
    expect(result(s)).toEqual({ kind: 'win', winners: [0] });
  });

  it('Brunnen: Alle Karten verteilt, wer zuerst leer ist, gewinnt', () => {
    let s = setup(2, { order: '3', mode: 'fountain' }, 'f');
    expect(s.stacks.reduce((a, x) => a + x.length, 0)).toBe(12);
    const center = s.center!;
    const next = applyMove(s, 0, claimFor(s, 0)).state;
    expect(next.stacks[0]).toHaveLength(s.stacks[0]!.length - 1);
    expect(next.center).toBe(s.stacks[0]!.at(-1));
    expect(next.center).not.toBe(center);
    for (let i = 0; i < 30 && s.phase === 'play'; i++) s = applyMove(s, 1, claimFor(s, 1)).state;
    expect(result(s)).toEqual({ kind: 'win', winners: [1] });
  });

  it('Brunnen: Sind alle gesperrt, werden alle frei – die Mittelkarte bleibt', () => {
    const s = setup(2, { order: '5', mode: 'fountain' }, 'g');
    const wrong = (state: SymbolMatchState, seat: number) => claimFor(state, seat, seat, (claimFor(state, seat).symbol + 1) % 31);
    const one = applyMove(s, 0, wrong(s, 0)).state;
    const two = applyMove(one, 1, wrong(one, 1)).state;
    expect(two.locked).toEqual([false, false]);
    expect(two.center).toBe(s.center);
  });

  it('Vergiftetes Geschenk: Die Karte geht an den anderen, wer am wenigsten hat, gewinnt', () => {
    const s = setup(3, { order: '3', mode: 'gift' }, 'h');
    expect(isLegal(s, 0, claimFor(s, 0, 0))).toBe(false);
    const center = s.center!;
    const next = applyMove(s, 0, claimFor(s, 0, 1)).state;
    expect(next.stacks[1]!.at(-1)).toBe(center);
    expect(next.stacks.map((x) => x.length)).toEqual([1, 2, 1]);
    let end = s;
    for (let i = 0; i < 20 && end.phase === 'play'; i++) end = applyMove(end, 0, claimFor(end, 0, 1)).state;
    const r = result(end);
    expect(r).toMatchObject({ kind: 'win' });
    expect(r && r.kind === 'win' && r.winners).toEqual([0, 2]);
  });

  it('allein gibt es Turmbau und Zeit-Duell', () => {
    expect(setup(1, { mode: 'gift' }, 'i').options.mode).toBe('tower');
    expect(setup(1, { mode: 'fountain' }, 'i').options.mode).toBe('tower');
    expect(setup(1, { mode: 'hotPotato' }, 'i').options.mode).toBe('tower');
    expect(setup(1, { mode: 'duel' }, 'i').options.mode).toBe('duel');
  });

  it('Heiße Kartoffel: Stapel weitergeben, Runden verlieren, wenigste Verluste gewinnen', () => {
    let s = setup(3, { order: '3', mode: 'hotPotato', rounds: '3' }, 'hp-1');
    expect(s.center).toBeNull();
    expect(s.stacks.map((x) => x.length)).toEqual([1, 1, 1]);
    // Platz 0 gibt an Platz 1 ab -> Platz 0 ist für diese Runde sicher.
    const move0 = legalMoves(s, 0).find((m) => m.type === 'claim' && m.target === 1)!;
    s = applyMove(s, 0, move0).state;
    expect(s.stacks.map((x) => x.length)).toEqual([0, 2, 1]);
    expect(currentPlayers(s)).toEqual([1, 2]);
    // Platz 1 gibt an Platz 2 ab -> Runde 1 endet, Platz 2 verliert Runde 1, Runde 2 startet.
    const move1 = legalMoves(s, 1).find((m) => m.type === 'claim' && m.target === 2)!;
    s = applyMove(s, 1, move1).state;
    expect(s.losses).toEqual([0, 0, 1]);
    expect(s.round).toBe(2);
    expect(s.stacks.map((x) => x.length)).toEqual([1, 1, 1]);
    // Bis Spielende spielen (Runde 2 und 3).
    while (s.phase === 'play') {
      const seat = currentPlayers(s)[0] as number;
      s = applyMove(s, seat, legalMoves(s, seat)[0]!).state;
    }
    expect(s.phase).toBe('gameEnd');
    expect(s.losses.reduce((a, b) => a + b, 0)).toBe(3);
    const r = result(s);
    expect(r?.kind).toBe('win');
  });

  it('Zeit-Duell: 60s-Timer, Deck wird neu gemischt, System-Timeout beendet das Spiel', () => {
    let s = setup(2, { order: '3', mode: 'duel' }, 'duel-1');
    expect(systemDelayMs(s)).toBe(DUEL_MS);
    expect(currentPlayers(s)).toContain('system');
    // Mehr als 13 Züge (Deckgröße von order 3) spielen -> Deck mischt automatisch nach.
    for (let i = 0; i < 16; i++) {
      const seat = i % 2;
      s = applyMove(s, seat, legalMoves(s, seat)[0]!).state;
      expect(s.phase).toBe('play');
    }
    expect(s.hits).toEqual([8, 8]);
    // Noch einen für Platz 0, dann Timeout.
    s = applyMove(s, 0, legalMoves(s, 0)[0]!).state;
    s = applyMove(s, 'system', { type: 'timeout' }).state;
    expect(s.phase).toBe('gameEnd');
    expect(systemDelayMs(s)).toBe(0);
    expect(result(s)).toEqual({ kind: 'win', winners: [0] });
  });

  it('Sicht: Stapel verdeckt, sampleHidden gibt dieselbe Sicht zurück', () => {
    const s = setup(3, { order: '5', mode: 'gift' }, 'j');
    const view = playerView(s, 0);
    expect('deck' in view).toBe(false);
    expect('stacks' in view).toBe(false);
    const world = sampleHidden(view, 0, new Rng([5, 6, 7, 8]));
    expect(playerView(world, 0)).toEqual(view);
    expect(world.stacks.flat().length + world.deck.length + 1).toBeGreaterThanOrEqual(3 + s.deck.length);
  });

  it('legalMoves nennt je Ziel das richtige Symbol', () => {
    const s = setup(3, { order: '7', mode: 'gift' }, 'k');
    const moves = legalMoves(s, 0);
    expect(moves.map((m) => (m.type === 'claim' ? m.target : -1))).toEqual([1, 2]);
    for (const m of moves) expect(isLegal(s, 0, m)).toBe(true);
  });
});

describe('symbol-match: Bot', () => {
  for (const level of ['easy', 'medium', 'hard'] as const) {
    for (const mode of ['tower', 'fountain', 'gift', 'hotPotato']) {
      it(`spielt auf „${level}“ eine ganze Partie (${mode})`, () => {
        let s = gameModule.setup(3, { order: '3', mode, rounds: '3' }, `bot-${level}-${mode}`);
        for (let guard = 0; !gameModule.result(s) && guard < 2000; guard++) {
          const players = currentPlayers(s).filter((a): a is number => typeof a === 'number');
          const seat = players[guard % players.length]!;
          const move = computeBotMove(gameModule, { gameId: 'symbol-match', botId: 'adlerauge', level, seat, view: playerView(s, seat), seed: `${guard}`, timeBudgetMs: 50 }) as SymbolMatchMove;
          s = applyMove(s, seat, move).state;
        }
        expect(gameModule.result(s)).not.toBeNull();
      });
    }

    it(`spielt auf „${level}“ im Zeit-Duell bis zum Timeout`, () => {
      let s = gameModule.setup(2, { order: '3', mode: 'duel' }, `bot-${level}-duel`);
      for (let guard = 0; guard < 20; guard++) {
        const players = currentPlayers(s).filter((a): a is number => typeof a === 'number');
        const seat = players[guard % players.length]!;
        const move = computeBotMove(gameModule, { gameId: 'symbol-match', botId: 'adlerauge', level, seat, view: playerView(s, seat), seed: `${guard}`, timeBudgetMs: 50 }) as SymbolMatchMove;
        s = applyMove(s, seat, move).state;
      }
      s = applyMove(s, 'system', { type: 'timeout' }).state;
      expect(gameModule.result(s)).not.toBeNull();
    });
  }
});
