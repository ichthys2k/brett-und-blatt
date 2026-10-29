import { describe, expect, it, test } from 'vitest';
import { Rng, computeBotMove } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { gameModule } from '../src';
import { ORDERS, buildCards, deckSize, mathNotations, mathValue, setSize, shared, symbolText, SYMBOL_SETS } from '../src/deck';
import { applyMove, currentPlayers, isLegal, legalMoves, playerView, result, sampleHidden, setup, type SymbolMatchMove, type SymbolMatchState } from '../src/rules';

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
      if (value !== 'math') expect(texts.size).toBe(57);
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

const claimFor = (state: SymbolMatchState, seat: number, target = seat, symbol?: number): SymbolMatchMove => ({
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

  it('allein gibt es nur den Turmbau', () => {
    expect(setup(1, { mode: 'gift' }, 'i').options.mode).toBe('tower');
    expect(setup(1, { mode: 'fountain' }, 'i').options.mode).toBe('tower');
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
    expect(moves.map((m) => m.target)).toEqual([1, 2]);
    for (const m of moves) expect(isLegal(s, 0, m)).toBe(true);
  });
});

describe('symbol-match: Bot', () => {
  for (const level of ['easy', 'medium', 'hard'] as const) {
    for (const mode of ['tower', 'fountain', 'gift']) {
      it(`spielt auf „${level}“ eine ganze Partie (${mode})`, () => {
        let s = gameModule.setup(3, { order: '3', mode }, `bot-${level}-${mode}`);
        for (let guard = 0; !gameModule.result(s) && guard < 2000; guard++) {
          const seat = currentPlayers(s)[guard % currentPlayers(s).length] as number;
          const move = computeBotMove(gameModule, { gameId: 'symbol-match', botId: 'adlerauge', level, seat, view: playerView(s, seat), seed: `${guard}`, timeBudgetMs: 50 }) as SymbolMatchMove;
          s = applyMove(s, seat, move).state;
        }
        expect(gameModule.result(s)).not.toBeNull();
      });
    }
  }
});
