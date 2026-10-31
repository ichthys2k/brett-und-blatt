import { computeBotMove, resolveOptions, Rng, type Options } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { detectHand, gameModule, handLabel, scoreHand, type Card, type RunState, type SorterMove, type SorterState } from '../src';
import { MODS } from '../src/mods';
import { altTag } from '../src/rules';
import { DREAMS, NAILS, SPELLS, TAGS, TOOLS } from '../src/content';
import { describeConsumable, describeMod, describeTool } from '../src/ui/texts';

function start(seats = 1, options: Options = {}, seed = 'test'): SorterState {
  return gameModule.setup(seats, resolveOptions(gameModule, options), seed);
}

const c = (rank: number, color: Card['color'], extra: Partial<Card> = {}): Card => ({ id: rank * 10 + 'hsdc'.indexOf(color), rank, color, ...extra });

function play(state: SorterState, seat: number, move: SorterMove): SorterState {
  return gameModule.applyMove(state, seat, move).state;
}

/** Ein Lauf mit eigener Hand – für Wertungstests. */
function runWith(state: SorterState, change: Partial<RunState>): RunState {
  return { ...state.runs[0]!, ...change };
}

describe('Kombis', () => {
  it('erkennt alle Kombis', () => {
    expect(detectHand([c(5, 'h')]).type).toBe('high');
    expect(detectHand([c(5, 'h'), c(5, 's')]).type).toBe('pair');
    expect(detectHand([c(5, 'h'), c(5, 's'), c(7, 'c'), c(7, 'd')]).type).toBe('twoPair');
    expect(detectHand([c(5, 'h'), c(5, 's'), c(5, 'c')]).type).toBe('three');
    expect(detectHand([c(2, 'h'), c(3, 's'), c(4, 'c'), c(5, 'd'), c(6, 'h')]).type).toBe('straight');
    expect(detectHand([c(2, 'h'), c(3, 'h'), c(6, 'h'), c(8, 'h'), c(12, 'h')]).type).toBe('flush');
    expect(detectHand([c(5, 'h'), c(5, 's'), c(5, 'c'), c(8, 'd'), c(8, 'h')]).type).toBe('fullHouse');
    expect(detectHand([c(5, 'h'), c(5, 's'), c(5, 'c'), c(5, 'd')]).type).toBe('four');
    expect(detectHand([c(4, 'c'), c(5, 'c'), c(6, 'c'), c(7, 'c'), c(8, 'c')]).type).toBe('straightFlush');
    expect(detectHand([c(5, 'h'), c(5, 's'), c(5, 'c'), c(5, 'd'), c(5, 'h', { id: 99 })]).type).toBe('five');
    expect(detectHand([c(5, 'h'), c(5, 'h', { id: 1 }), c(5, 'h', { id: 2 }), c(8, 'h'), c(8, 'h', { id: 3 })]).type).toBe('flushHouse');
  });

  it('Das Ass ist der höchste Rang: 10 bis Ass in einer Farbe ist die Königsstraße', () => {
    const cards = [c(10, 's'), c(11, 's'), c(12, 's'), c(13, 's'), c(14, 's')];
    const { type } = detectHand(cards);
    expect(type).toBe('straightFlush');
    expect(handLabel(type, cards)).toBe('Königsstraße');
    expect(handLabel(type, [c(9, 's'), c(10, 's'), c(11, 's'), c(12, 's'), c(13, 's')])).toBe('Farbstraße');
    // Kein Herumlaufen: König, Ass, 2, 3, 4 ist keine Straße, A-2-3-4-5 auch nicht.
    expect(detectHand([c(13, 'h'), c(14, 's'), c(2, 'c'), c(3, 'd'), c(4, 'h')]).type).toBe('high');
    expect(detectHand([c(14, 'h'), c(2, 's'), c(3, 'c'), c(4, 'd'), c(5, 'h')]).type).toBe('high');
  });

  it('wertet nur die Karten der Kombi, Granit immer', () => {
    const played = [c(5, 'h'), c(5, 's'), c(9, 'c'), c(2, 'd', { enh: 'granite' })];
    expect(detectHand(played).scoring).toEqual([0, 1, 3]);
    expect(detectHand([c(3, 'h'), c(9, 's')]).scoring).toEqual([1]);
  });

  it('Ombré zählt als jede Farbe', () => {
    expect(detectHand([c(2, 'h'), c(3, 'h'), c(6, 's', { enh: 'ombre' }), c(8, 'h'), c(12, 'h')]).type).toBe('flush');
  });
});

describe('Wertung', () => {
  const state = start();
  const rng = () => new Rng([1, 2, 3, 4]);

  it('Chips × Mult: Paar aus zwei 5ern ist (12 + 5 + 5) × 2', () => {
    const result = scoreHand(runWith(state, {}), [c(5, 'h'), c(5, 's')], [], rng());
    expect(result.score).toBe(44);
  });

  it('Karten zählen ihren Rang: Bube 11, Dame 12, König 13, Ass 14', () => {
    expect(scoreHand(runWith(state, {}), [c(14, 'h')], [], rng()).score).toBe((8 + 14) * 1);
    expect(scoreHand(runWith(state, {}), [c(11, 'h')], [], rng()).score).toBe((8 + 11) * 1);
    expect(scoreHand(runWith(state, {}), [c(2, 'h')], [], rng()).score).toBe((8 + 2) * 1);
  });

  it('Veredelungen, Folien und Abzeichen', () => {
    const run = runWith(state, {});
    expect(scoreHand(run, [c(5, 'h', { enh: 'volume' })], [], rng()).score).toBe(8 + 5 + 30);
    expect(scoreHand(run, [c(5, 'h', { enh: 'gloss' })], [], rng()).score).toBe((8 + 5) * 5);
    expect(scoreHand(run, [c(5, 'h', { foil: 'iris' })], [], rng()).score).toBe(Math.floor(13 * 1.5));
    expect(scoreHand(run, [c(5, 'h', { seal: 'red' })], [], rng()).score).toBe(8 + 5 + 5);
    expect(scoreHand(run, [c(5, 'h')], [c(9, 's', { enh: 'keratin' })], rng()).score).toBe(Math.floor(13 * 1.5));
  });

  it('Mods wirken von links nach rechts: erst +Mult, dann ×Mult ist mehr', () => {
    const pair = [c(5, 'h'), c(5, 's')];
    const plusThenTimes = runWith(state, {
      mods: [
        { uid: 1, key: 'jolly' },
        { uid: 2, key: 'twins' },
      ],
    });
    const timesThenPlus = runWith(state, {
      mods: [
        { uid: 2, key: 'twins' },
        { uid: 1, key: 'jolly' },
      ],
    });
    expect(scoreHand(plusThenTimes, pair, [], rng()).score).toBe(22 * (2 + 6) * 1.5);
    expect(scoreHand(timesThenPlus, pair, [], rng()).score).toBe(22 * (2 * 1.5 + 6));
  });

  it('Farb-Mods zählen gewertete Karten der Farbe', () => {
    const run = runWith(state, { mods: [{ uid: 1, key: 'inLove' }] });
    expect(scoreHand(run, [c(5, 'h'), c(5, 's')], [], rng()).score).toBe(22 * (2 + 4));
  });

  it('Boss-Farbe zählt nicht', () => {
    const run = runWith(state, {
      current: {
        target: 1,
        score: 0,
        handsLeft: 1,
        discardsLeft: 0,
        boss: 'minotaur',
        duel: false,
        playedTypes: [],
        firstDone: false,
        silenced: false,
        faceDown: [],
      },
    });
    expect(scoreHand(run, [c(5, 'h'), c(5, 's')], [], rng()).score).toBe((12 + 5) * 2);
  });
});

describe('Narren', () => {
  const state = start();
  const rng = () => new Rng([1, 2, 3, 4]);
  const round = (extra: Partial<NonNullable<RunState['current']>> = {}): RunState['current'] => ({
    target: 1,
    score: 0,
    handsLeft: 4,
    discardsLeft: 3,
    boss: null,
    duel: false,
    playedTypes: [],
    firstDone: false,
    silenced: false,
    faceDown: [],
    ...extra,
  });
  const withMod = (key: string, change: Partial<RunState> = {}, value?: number) => runWith(state, { mods: [{ uid: 1, key, ...(value === undefined ? {} : { value }) }], ...change });
  const pair = [c(5, 'h'), c(5, 's')];

  it('Jongleur: +2 Mult je gewertete Karte', () => {
    expect(scoreHand(withMod('juggler'), pair, [], rng()).score).toBe(22 * (2 + 2 + 2));
  });

  it('Spielfrau: +30 Chips nur bei genau 3 gewerteten Karten', () => {
    expect(scoreHand(withMod('fiddler'), [c(5, 'h'), c(5, 's'), c(5, 'c')], [], rng()).score).toBe((25 + 15 + 30) * 3);
    expect(scoreHand(withMod('fiddler'), pair, [], rng()).score).toBe(22 * 2);
  });

  it('Frühaufsteher: erste Runde ×2, sonst +3 Mult', () => {
    expect(scoreHand(withMod('earlyBird', { round: 0 }), pair, [], rng()).score).toBe(22 * 4);
    expect(scoreHand(withMod('earlyBird', { round: 1 }), pair, [], rng()).score).toBe(22 * 5);
  });

  it('Bäckerjunge: +1 T je gewerteter Bube', () => {
    expect(scoreHand(withMod('baker'), [c(11, 'h'), c(11, 's')], [], rng()).tokens).toBe(2);
    expect(scoreHand(withMod('baker'), pair, [], rng()).tokens).toBe(0);
  });

  it('Bänkelsänger: +5 Chips je schon gespielte Hand, neues Level beginnt bei 0', () => {
    const result = scoreHand(withMod('balladeer', {}, 3), pair, [], rng());
    expect(result.score).toBe((22 + 15) * 2);
    expect(result.mods[0]!.value).toBe(4);
    expect(MODS.balladeer!.onRoundEnd!({ uid: 1, key: 'balladeer', value: 4 }, runWith(state, { round: 2 })).mod?.value).toBe(0);
    expect(MODS.balladeer!.onRoundEnd!({ uid: 1, key: 'balladeer', value: 4 }, runWith(state, { round: 1 })).mod).toBeUndefined();
  });

  it('Hofäffchen: wächst beim Verwerfen bis +20 und verliert alles, wenn ein Mod dazukommt', () => {
    const run = runWith(state, {});
    expect(MODS.monkey!.onDiscard!([c(2, 'h'), c(3, 'h')], { uid: 1, key: 'monkey', value: 19 }, run).mod?.value).toBe(20);
    expect(scoreHand(withMod('monkey', {}, 6), pair, [], rng()).score).toBe(22 * (2 + 6));
    const shopState = structuredClone(state);
    const own = shopState.runs[0]!;
    own.phase = 'shop';
    own.tokens = 10;
    own.mods = [{ uid: 1, key: 'monkey', value: 7 }];
    own.shop = { ...own.shop!, offers: [{ type: 'mod', key: 'jolly', price: 1 }], packs: [], tool: null };
    const after = play(shopState, 0, { type: 'buy', index: 0 }).runs[0]!;
    expect(after.mods.map((m) => [m.key, m.value ?? 0])).toEqual([
      ['monkey', 0],
      ['jolly', 0],
    ]);
  });

  it('Bücherwurm: +1 Mult je Level der Kombi', () => {
    const levels = { ...state.runs[0]!.handLevels, pair: 3 };
    // Paar auf Level 3: 12 + 2 × 12 Chips, 2 + 2 Mult
    expect(scoreHand(withMod('bookworm', { handLevels: levels }), pair, [], rng()).score).toBe((36 + 10) * (4 + 3));
  });

  it('Herold: ×3 Mult für die ausgerufene Kombi, auch als Teil einer größeren', () => {
    expect(describeMod({ key: 'herald', value: 1 }).text).toContain('Ausgerufen: Paar');
    expect(scoreHand(withMod('herald', {}, 1), pair, [], rng()).score).toBe(22 * 6);
    const full = [c(5, 'h'), c(5, 's'), c(5, 'c'), c(8, 'd'), c(8, 'h')];
    expect(scoreHand(withMod('herald', {}, 1), full, [], rng()).score).toBe((45 + 31) * 12);
    expect(scoreHand(withMod('herald', {}, 3), pair, [], rng()).score).toBe(22 * 2);
  });

  it('Königspaar: ×2 Mult bei König und Dame derselben Farbe', () => {
    const same = [c(13, 'h'), c(12, 'h'), c(2, 'h'), c(6, 'h'), c(9, 'h')];
    expect(scoreHand(withMod('royalCouple'), same, [], rng()).score).toBe((40 + 42) * 8);
    const mixed = [c(13, 'h'), c(13, 'c'), c(12, 's'), c(12, 'd')];
    expect(scoreHand(withMod('royalCouple'), mixed, [], rng()).score).toBe((24 + 50) * 2);
  });

  it('Doppelgesichtiger: die erste Hand einer Runde wertet alle Karten zweimal', () => {
    expect(scoreHand(withMod('twoFaced', { current: round() }), pair, [], rng()).score).toBe((12 + 20) * 2);
    expect(scoreHand(withMod('twoFaced', { current: round({ firstDone: true }) }), pair, [], rng()).score).toBe(22 * 2);
  });
});

describe('Kataloge (Schritt 4)', () => {
  const rng = () => new Rng([1, 2, 3, 4]);
  /** Ein Lauf mitten in einer Audienz, mit dieser Hand und diesen Narren. */
  function inRound(hand: Card[], change: Partial<RunState> = {}): SorterState {
    let state = start();
    state = play(state, 0, { type: 'start' });
    Object.assign(state.runs[0]!, { hand, ...change });
    return state;
  }
  const use = (state: SorterState, kind: 'spell' | 'dream', key: string, cards: number[] = []) => {
    Object.assign(state.runs[0]!, { consumables: [{ kind, key }] });
    return play(state, 0, { type: 'use', index: 0, cards }).runs[0]!;
  };
  const hand = [c(2, 'h'), c(5, 's'), c(9, 'd'), c(13, 'c')];

  it('Färberei: alle gewählten Karten bekommen die Farbe der linken', () => {
    const run = use(inRound(hand), 'spell', 'dye', [0, 2, 3]);
    expect(run.hand.map((x) => x.color)).toEqual(['h', 's', 'h', 'h']);
  });

  it('Purzelbaum: die linke steigt, die zweite fällt', () => {
    const run = use(inRound(hand), 'spell', 'strength', [1, 2]);
    expect(run.hand.map((x) => x.rank)).toEqual([2, 6, 8, 13]);
  });

  it('Vertauscht!: zwei Karten tauschen ihre Ränge', () => {
    const run = use(inRound(hand), 'spell', 'swap', [0, 3]);
    expect(run.hand.map((x) => x.rank)).toEqual([13, 5, 9, 2]);
  });

  it('Ausmisten und Pflastern bringen Brezeln', () => {
    const before = inRound(hand).runs[0]!.tokens;
    expect(use(inRound(hand), 'spell', 'hanged', [0, 1]).tokens).toBe(before + 2);
    const paved = use(inRound(hand), 'spell', 'hierophant', [2]);
    expect(paved.tokens).toBe(before + 2);
    expect(paved.hand[2]!.enh).toBe('granite');
  });

  it('Erntedank: +2 je Herrschaft, höchstens 16', () => {
    expect(use(inRound(hand, { tokens: 0, bossesBeaten: 3 }), 'spell', 'harvest').tokens).toBe(6);
    expect(use(inRound(hand, { tokens: 0, bossesBeaten: 20 }), 'spell', 'harvest').tokens).toBe(16);
  });

  it('Polierlappen: der erste Narr ohne Glanz bekommt Perlmutt', () => {
    const mods = [
      { uid: 1, key: 'clown', foil: 'hot' as const },
      { uid: 2, key: 'pi' },
    ];
    expect(use(inRound(hand, { mods }), 'spell', 'polish').mods.map((m) => m.foil)).toEqual(['hot', 'holo']);
  });

  it('Schulstunde: Übung der meistgespielten Kombi', () => {
    const state = inRound(hand);
    const plays = { ...state.runs[0]!.handPlays, flush: 3, pair: 1 };
    expect(use(inRound(hand, { handPlays: plays }), 'spell', 'priestess').consumables).toEqual([{ kind: 'nail', key: 'fullcover' }]);
  });

  it('Zauberspiegel: der linke Narr wird verdoppelt, ein anderer geht', () => {
    const mods = [
      { uid: 1, key: 'clown' },
      { uid: 2, key: 'pi' },
      { uid: 3, key: 'jolly' },
    ];
    const keys = use(inRound(hand, { mods }), 'dream', 'magicMirror').mods.map((m) => m.key);
    expect(keys.filter((k) => k === 'clown')).toHaveLength(2);
    expect(keys).toHaveLength(3);
  });

  it('Sanduhr: +1 Vorführung in der nächsten Audienz, Handgröße −1', () => {
    const state = inRound(hand);
    const run = use(state, 'dream', 'hourglass');
    expect(run.stickers).toContain('hourglass');
    expect(run.handSize).toBe(state.runs[0]!.handSize - 1);
  });

  it('Lehrbrief: Übungen bringen zwei Stufen', () => {
    const state = inRound(hand, { tools: ['diploma'] });
    Object.assign(state.runs[0]!, { consumables: [{ kind: 'nail', key: 'clearCoat' }] });
    expect(play(state, 0, { type: 'use', index: 0, cards: [] }).runs[0]!.handLevels.pair).toBe(3);
  });

  it('Gefallen Nachhilfe und Bäckerbesuch wirken sofort, Lob des Königs senkt das Ziel', () => {
    let state = start();
    Object.assign(state.tags, { 0: 'tutoring', 1: 'praise' });
    Object.assign(state.runs[0]!, { mods: [{ uid: 1, key: 'clown' }, { uid: 2, key: 'pi' }] });
    state = play(state, 0, { type: 'skip' });
    expect(state.runs[0]!.handLevels.high).toBe(3);
    state = play(state, 0, { type: 'skip' });
    if (state.runs[0]!.phase === 'pack') state = play(state, 0, { type: 'skipPack' });
    expect(state.runs[0]!.stickers).toContain('praise');
  });

  it('Wanderbühne: ein zweiter Gefallen zur Wahl', () => {
    const state = start();
    expect(gameModule.legalMoves(state, 0).filter((m) => m.type === 'skip')).toHaveLength(1);
    state.runs[0]!.tools = ['touringStage'];
    const skips = gameModule.legalMoves(state, 0).filter((m) => m.type === 'skip');
    expect(skips).toHaveLength(2);
    expect(altTag(state.tags[0]!, 1)).not.toBe(state.tags[0]);
  });

  it('Narren: Kuppler, Läufer, Malerin, Gauklerfamilie', () => {
    const run = (key: string) => runWith(start(), { mods: [{ uid: 1, key }] });
    const twoPair = [c(5, 'h'), c(5, 's'), c(9, 'h'), c(9, 's')];
    expect(scoreHand(run('jolly'), twoPair, [], rng()).score).toBe((24 + 28) * (2 + 6) * 2);
    const flush = [c(2, 'h'), c(4, 'h'), c(11, 'h'), c(12, 'h'), c(9, 'h')];
    expect(scoreHand(run('palette'), flush, [], rng()).score).toBe((40 + 38) * (4 + 8 + 4));
    const full = [c(5, 'h'), c(5, 's'), c(5, 'c'), c(9, 'h'), c(9, 's')];
    expect(scoreHand(run('family'), full, [], rng()).score).toBe((45 + 33) * 4 * 3);
    const straightFlush = [c(5, 'h'), c(6, 'h'), c(7, 'h'), c(8, 'h'), c(9, 'h')];
    expect(scoreHand(run('ruler'), straightFlush, [], rng()).score).toBe((90 + 35) * (9 + 10) * 2);
  });

  it('Narren: Aufrechter, Querkopf, Assjäger, Papagei, Hofzauberer', () => {
    const run = (key: string) => runWith(start(), { mods: [{ uid: 1, key }] });
    expect(scoreHand(run('even'), [c(4, 'h'), c(4, 's')], [], rng()).score).toBe((12 + 8) * (2 + 12));
    expect(scoreHand(run('even'), [c(5, 'h'), c(5, 's')], [], rng()).score).toBe(22 * 2);
    expect(scoreHand(run('odd'), [c(5, 'h'), c(5, 's')], [], rng()).score).toBe((22 + 60) * 2);
    expect(scoreHand(run('santaFan'), [c(14, 'h'), c(14, 's')], [], rng()).score).toBe((12 + 28) * 4);
    expect(scoreHand(run('echo'), [c(5, 'h'), c(5, 's')], [], rng()).score).toBe((22 + 5) * 2);
    expect(scoreHand(run('santaClaus'), [c(12, 'h'), c(12, 's')], [], rng()).score).toBe((12 + 48) * 2);
  });

  it('Narren: Kräuterfrau und Hofschnecke wachsen, der Apfel wird aufgegessen', () => {
    const clubs = [c(5, 'c'), c(5, 'c', { id: 1 })];
    const herb = scoreHand(runWith(start(), { mods: [{ uid: 1, key: 'broccoli', value: 3 }] }), clubs, [], rng());
    expect(herb.score).toBe(22 * (2 + 5));
    expect(herb.mods[0]!.value).toBe(5);
    const apple = scoreHand(runWith(start(), { mods: [{ uid: 1, key: 'apple', value: 1 }] }), [c(5, 'h'), c(5, 's')], [], rng());
    expect(apple.score).toBe(22 * 6);
    expect(apple.mods).toEqual([]);
  });

  it('Das Einhorn: jede Karte zählt als jede Farbe', () => {
    const mixed = [c(2, 'h'), c(4, 's'), c(7, 'd'), c(9, 'c'), c(12, 'h')];
    expect(detectHand(mixed).type).toBe('high');
    expect(scoreHand(runWith(start(), { mods: [{ uid: 1, key: 'unicorn' }] }), mixed, [], rng()).type).toBe('flush');
  });
});

describe('Neue Narren (zweite Truppe)', () => {
  const rng = () => new Rng([1, 2, 3, 4]);
  const base = start();
  const current = (extra: Partial<NonNullable<RunState['current']>> = {}): RunState['current'] => ({
    target: 1, score: 0, handsLeft: 4, discardsLeft: 3, startDiscards: 3, boss: null, duel: false, playedTypes: [], firstDone: false, silenced: false, faceDown: [], ...extra,
  });
  const run = (key: string, change: Partial<RunState> = {}, value?: number) =>
    runWith(base, { mods: [{ uid: 1, key, ...(value === undefined ? {} : { value }) }], current: current(), ...change });
  const pair = [c(5, 'h'), c(5, 's')];

  it('Mundschenk: +3 je Karte nur ohne Tauschen', () => {
    expect(scoreHand(run('cupbearer'), pair, [], rng()).score).toBe(22 * (2 + 6));
    expect(scoreHand(run('cupbearer', { current: current({ discardsLeft: 2 }) }), pair, [], rng()).score).toBe(22 * 2);
  });

  it('Kerzenzieher, Fanfarenbläser und Schlafmütze hängen an der Vorführung', () => {
    expect(scoreHand(run('candle', { current: current({ handsLeft: 2 }) }), pair, [], rng()).score).toBe(22 * (2 + 6));
    expect(scoreHand(run('trumpeter'), pair, [], rng()).score).toBe(22 * (2 + 12));
    expect(scoreHand(run('trumpeter', { current: current({ firstDone: true }) }), pair, [], rng()).score).toBe(22 * 2);
    expect(scoreHand(run('sleepyhead', { current: current({ handsLeft: 1 }) }), pair, [], rng()).score).toBe(22 * 4);
    expect(scoreHand(run('sleepyhead'), pair, [], rng()).score).toBe(22 * 2);
  });

  it('Hofhund und Nachtigall zählen die Hand, die Königinmutter die Damen darin', () => {
    const held = [c(9, 'h'), c(12, 'd'), c(12, 'c', { id: 999 })];
    expect(scoreHand(run('hound'), pair, held, rng()).score).toBe((22 + 18) * 2);
    expect(scoreHand(run('nightingale'), pair, held, rng()).score).toBe(22 * (2 + 3));
    expect(scoreHand(run('queenMother'), pair, held, rng()).score).toBe(Math.floor(22 * 2 * 1.25 * 1.25));
  });

  it('Hofrichter, Rechenlehrling, Zehnerfreund und Schwanenjungfer prüfen die gewerteten Karten', () => {
    expect(scoreHand(run('judge'), pair, [], rng()).score).toBe(22 * 4);
    expect(scoreHand(run('judge'), [c(5, 'h'), c(5, 'd')], [], rng()).score).toBe(22 * 2);
    // 7 + 7 = 14 ist keine Primzahl, 14 (Ass) allein schon gar nicht; 13 (König) ist eine.
    expect(scoreHand(run('primeScholar'), [c(7, 'h'), c(7, 's')], [], rng()).score).toBe((12 + 14) * 2);
    expect(scoreHand(run('primeScholar'), [c(13, 'h')], [], rng()).score).toBe((8 + 13) * 2);
    expect(scoreHand(run('tenFriend'), pair, [], rng()).score).toBe(22 * 22);
    expect(scoreHand(run('swan'), [c(5, 'h'), c(5, 'd')], [], rng()).score).toBe(22 * 3);
    expect(scoreHand(run('swan'), pair, [], rng()).score).toBe(22 * 2);
  });

  it('Bogenschütze lässt die höchste Karte doppelt zählen, Zwillingsnarren jede mehrfache', () => {
    expect(scoreHand(run('archer'), [c(14, 'h')], [], rng()).score).toBe((8 + 28) * 1);
    expect(scoreHand(run('twinFools'), pair, [], rng()).score).toBe((12 + 20) * 2);
  });

  it('Thronfolger, Burgvogt, Kämmerer, Märchenerzählerin, Einsiedler', () => {
    expect(scoreHand(run('heir', { level: 3 }), pair, [], rng()).score).toBe(22 * 8);
    expect(scoreHand(run('castellan', { round: 2 }), pair, [], rng()).score).toBe(82 * 8);
    expect(scoreHand(run('castellan'), pair, [], rng()).score).toBe(22 * 2);
    expect(scoreHand(run('treasurer', { tokens: 100 }), pair, [], rng()).score).toBe(22 * 14);
    expect(scoreHand(run('storyteller'), [c(7, 'h'), c(7, 's')], [], rng()).score).toBe(26 * 16);
    expect(scoreHand(run('hermit'), pair, [], rng()).score).toBe(22 * 6);
    const two = runWith(base, { mods: [{ uid: 1, key: 'hermit' }, { uid: 2, key: 'hound' }], current: current() });
    expect(scoreHand(two, pair, [], rng()).score).toBe(22 * 5);
  });

  it('Pfau und Näherin mögen Verzierungen', () => {
    const fancy = [c(5, 'h', { enh: 'volume' }), c(5, 's', { enh: 'gloss' })];
    expect(scoreHand(run('peacock'), fancy, [], rng()).score).toBe((22 + 30) * (2 + 4) * 2);
    const deck = [...base.runs[0]!.deck.slice(0, 3).map((card) => ({ ...card, enh: 'gold' as const })), ...base.runs[0]!.deck.slice(3)];
    expect(scoreHand(run('seamstress', { deck }), pair, [], rng()).score).toBe((22 + 15) * 2);
  });

  it('Schreiber, Kartografin, Imker und Trommler', () => {
    expect(scoreHand(run('scribe', { lastHandType: 'high' }), pair, [], rng()).score).toBe(22 * 12);
    expect(scoreHand(run('scribe', { lastHandType: 'pair' }), pair, [], rng()).score).toBe(22 * 2);
    const plays = { ...base.runs[0]!.handPlays, high: 2, flush: 1 };
    expect(scoreHand(run('cartographer', { handPlays: plays }), pair, [], rng()).score).toBe((22 + 45) * 2);
    const five = [c(5, 'h'), c(5, 's'), c(5, 'c'), c(9, 'h'), c(9, 's')];
    const bee = scoreHand(run('beekeeper', {}, 8), five, [], rng());
    expect(bee.score).toBe((45 + 33 + 12) * 4);
    expect(bee.mods[0]!.value).toBe(12);
    const drum = scoreHand(run('drummer', {}, 2), pair, [], rng());
    expect(drum.score).toBe(22 * 5);
    expect(drum.mods[0]!.value).toBe(3);
  });

  it('Lügenbaron: Paar bekommt den Grundwert von Zwei Paaren', () => {
    const result = scoreHand(run('baron'), pair, [], rng());
    expect(result.type).toBe('pair');
    expect(result.score).toBe((24 + 10) * 2);
  });

  it('Pilger: +1 Handgröße, −1 Tauschen', () => {
    let state = start();
    state.runs[0]!.mods = [{ uid: 99, key: 'pilgrim' }];
    state = play(state, 0, { type: 'start' });
    expect(state.runs[0]!.hand).toHaveLength(9);
    expect(state.runs[0]!.current!.discardsLeft).toBe(2);
  });

  it('Holzfäller: getauschte 2er und 3er verlassen das Deck', () => {
    let state = start();
    state.runs[0]!.mods = [{ uid: 99, key: 'woodcutter' }];
    state = play(state, 0, { type: 'start' });
    const r = state.runs[0]!;
    const low = r.hand.map((card, i) => ({ card, i })).filter(({ card }) => card.rank <= 3);
    const pick = low.length ? low.map(({ i }) => i).slice(0, 5) : [0];
    const before = r.deck.length;
    state = play(state, 0, { type: 'discard', cards: pick });
    expect(state.runs[0]!.deck.length).toBe(before - low.slice(0, 5).length);
  });

  it('Maskenbildnerin schminkt nach dem Sieg eine Handkarte, der Zuckerbäcker backt nach dem Thronsaal eine Übung', () => {
    let state = start();
    state.runs[0]!.mods = [{ uid: 98, key: 'makeupArtist' }, { uid: 99, key: 'confectioner' }];
    state.runs[0]!.round = 2;
    state = play(state, 0, { type: 'start' });
    state.runs[0]!.current!.target = 1;
    const rest = state.runs[0]!.hand.slice(1).find((card) => !card.enh)!;
    state = play(state, 0, { type: 'play', cards: [0] });
    const r = state.runs[0]!;
    expect(r.deck.find((card) => card.id === rest.id)!.enh).toBe('gloss');
    expect(r.consumables.some((item) => item.kind === 'nail')).toBe(true);
  });
});

describe('Neue Herrschaften und Höflinge (W-017)', () => {
  const rng = () => new Rng([1, 2, 3, 4]);
  const base = start();
  const current = (boss: string, extra: Partial<NonNullable<RunState['current']>> = {}): RunState['current'] => ({
    target: 1, score: 0, handsLeft: 4, discardsLeft: 3, startDiscards: 3, boss, duel: false, playedTypes: [], firstDone: true, silenced: false, faceDown: [], ...extra,
  });
  const pair = [c(5, 'h'), c(5, 's')];

  it('Krähe: die erste gewertete Karte zählt nicht', () => {
    expect(scoreHand(runWith(base, { current: current('crow') }), pair, [], rng()).score).toBe(17 * 2);
  });

  it('Esel: mehr als drei Karten bringen nichts, Faultier halbiert die erste Vorführung', () => {
    const four = [c(5, 'h'), c(5, 's'), c(9, 'h'), c(9, 's')];
    expect(scoreHand(runWith(base, { current: current('donkey') }), four, [], rng()).score).toBe(0);
    expect(scoreHand(runWith(base, { current: current('donkey') }), pair, [], rng()).score).toBe(44);
    expect(scoreHand(runWith(base, { current: current('sloth', { firstDone: false }) }), pair, [], rng()).score).toBe(22);
    expect(scoreHand(runWith(base, { current: current('sloth') }), pair, [], rng()).score).toBe(44);
  });

  it('Kater: Tauschen kostet eine Brezel, ohne Brezeln kein Tauschen', () => {
    let state = start();
    state = play(state, 0, { type: 'start' });
    state.runs[0]!.current!.boss = 'tomcat';
    state.runs[0]!.tokens = 1;
    state = play(state, 0, { type: 'discard', cards: [0] });
    expect(state.runs[0]!.tokens).toBe(0);
    expect(gameModule.isLegal!(state, 0, { type: 'discard', cards: [0] })).toBe(false);
    expect(gameModule.legalMoves(state, 0).some((m) => m.type === 'discard')).toBe(false);
  });

  it('Höflinge: je Partie acht verschiedene je Audienz, für alle gleich', async () => {
    const { courtierFor, COURTIERS } = await import('../src/content');
    expect(new Set(COURTIERS.map((x) => x.key)).size).toBe(32);
    const morning = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((level) => courtierFor('abc', level, 0).key));
    const feast = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((level) => courtierFor('abc', level, 1).key));
    expect(morning.size).toBe(8);
    expect(feast.size).toBe(8);
    expect(courtierFor('abc', 3, 1)).toEqual(courtierFor('abc', 3, 1));
    expect(courtierFor('abc', 9, 0)).toEqual(courtierFor('abc', 1, 0));
  });
});

describe('Ablauf', () => {
  it('Solo beginnt mit 4 T, 8 Karten, 4 Händen, 3-mal Verwerfen', () => {
    let state = start();
    expect(state.mode).toBe('solo');
    expect(state.runs[0]!.tokens).toBe(4);
    state = play(state, 0, { type: 'start' });
    const run = state.runs[0]!;
    expect(run.hand).toHaveLength(8);
    expect(run.current).toMatchObject({
      target: 300,
      handsLeft: 4,
      discardsLeft: 3,
    });
  });

  it('Überspringen gibt einen Sticker, den Boss kann man nicht überspringen', () => {
    let state = start();
    state = play(state, 0, { type: 'skip' });
    state = play(state, 0, state.runs[0]!.phase === 'pack' ? { type: 'skipPack' } : { type: 'skip' });
    if (state.runs[0]!.phase === 'pack') state = play(state, 0, { type: 'skipPack' });
    expect(state.runs[0]!.round).toBe(2);
    expect(gameModule.legalMoves(state, 0).some((m) => m.type === 'skip')).toBe(false);
  });

  it('gleicher Seed: Alle Plätze ziehen dieselben Karten', () => {
    let state = start(3);
    for (const seat of [0, 1, 2]) state = play(state, seat, { type: 'start' });
    const hands = state.runs.map((r) => r.hand.map((card) => `${card.rank}${card.color}`).join());
    expect(new Set(hands).size).toBe(1);
  });

  it('die Sicht verrät weder Stapelreihenfolge noch fremde Hände', () => {
    let state = start(2);
    state = play(state, 0, { type: 'start' });
    const view = gameModule.playerView(state, 1);
    expect(view.runs[0]!.hand.every((card) => 'hidden' in card)).toBe(true);
    expect(view.runs[0]!.pile).toEqual([]);
    const own = gameModule.playerView(state, 0).runs[0]!;
    expect(own.pileCount).toBe(44);
    expect(own.rng.deal).toEqual([0, 0, 0, 0]);
    const ranks = own.pile.map((card) => card.rank + 100 * 'hsdc'.indexOf(card.color));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('Duell: Wer weniger Punkte holt, verliert ein Leben', () => {
    let state = start(2, { mode: 'duel', lives: '4' });
    // Beide spielen bis zum Treffpunkt in Level 2 mit dem Bot.
    for (let step = 0; step < 400 && !state.duel && !state.lastDuel; step++) {
      for (const seat of gameModule.currentPlayers(state) as number[]) {
        const move = computeBotMove(gameModule, {
          gameId: 'color-sorter',
          botId: 'color-sorter',
          level: seat === 0 ? 'hard' : 'medium',
          seat,
          view: gameModule.playerView(state, seat),
          seed: `d/${step}/${seat}`,
          timeBudgetMs: 10,
        }) as SorterMove;
        state = play(state, seat, move);
        if (state.duel || state.lastDuel) break;
      }
    }
    expect(state.duel).not.toBeNull();
    expect(state.runs.every((r) => r.phase === 'play' && r.current?.duel)).toBe(true);
    for (let step = 0; step < 100 && !state.lastDuel; step++) {
      for (const seat of gameModule.currentPlayers(state) as number[]) {
        const move = computeBotMove(gameModule, {
          gameId: 'color-sorter',
          botId: 'color-sorter',
          level: seat === 0 ? 'hard' : 'medium',
          seat,
          view: gameModule.playerView(state, seat),
          seed: `e/${step}/${seat}`,
          timeBudgetMs: 10,
        }) as SorterMove;
        state = play(state, seat, move);
      }
    }
    const duel = state.lastDuel!;
    expect(duel.level).toBe(2);
    const [a, b] = duel.scores as number[];
    if (a !== b) expect(duel.losers).toEqual([a! < b! ? 0 : 1]);
  });
});

describe('Bot', () => {
  it('der schwere Bot schafft meist mehr Level als der leichte', () => {
    const levels = (level: 'easy' | 'hard') => {
      let total = 0;
      for (let g = 0; g < 6; g++) {
        let state = start(1, {}, `bot/${g}`);
        for (let step = 0; step < 1500 && !gameModule.result(state); step++) {
          const move = computeBotMove(gameModule, {
            gameId: 'color-sorter',
            botId: 'color-sorter',
            level,
            seat: 0,
            view: gameModule.playerView(state, 0),
            seed: `${g}/${step}`,
            timeBudgetMs: 10,
          }) as SorterMove;
          state = play(state, 0, move);
        }
        total += state.runs[0]!.level;
      }
      return total;
    };
    expect(levels('hard')).toBeGreaterThan(levels('easy'));
  });
});

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule, {
    randomGames: 24,
    seatCounts: [1, 3],
    maxMoves: 6000,
  }))
    test(check.name, check.run, 120_000);
});

describe('Umsortieren', () => {
  it('moveCard verschiebt eine Handkarte, ohne sie zu verändern', () => {
    let state = start();
    state = play(state, 0, { type: 'start' });
    const before = state.runs[0]!.hand.map((card) => card.id);
    expect(gameModule.isLegal?.(state, 0, { type: 'moveCard', from: 0, to: before.length - 1 })).toBe(true);
    state = play(state, 0, { type: 'moveCard', from: 0, to: before.length - 1 });
    expect(state.runs[0]!.hand.map((card) => card.id)).toEqual([...before.slice(1), before[0]]);
    expect(gameModule.isLegal?.(state, 0, { type: 'moveCard', from: 0, to: 0 })).toBe(false);
    expect(gameModule.isLegal?.(state, 0, { type: 'moveCard', from: 0, to: before.length })).toBe(false);
  });

  it('moveMod springt an jede Stelle', () => {
    const state = start();
    const run = runWith(state, { mods: ['juggler', 'fiddler', 'earlyBird'].map((key, uid) => ({ uid, key })) as RunState['mods'] });
    const next = { ...state, runs: [run] };
    const moved = play(next, 0, { type: 'moveMod', from: 0, to: 2 });
    expect(moved.runs[0]!.mods.map((m) => m.key)).toEqual(['fiddler', 'earlyBird', 'juggler']);
  });
});

describe('Sprechblasen', () => {
  it('jeder Narr, jedes Kunststück, jede Übung, Kuriosität, jedes Privileg und jeder Gefallen hat eine Beschreibung', () => {
    for (const key of Object.keys(MODS)) expect(describeMod({ key }).text, `Narr ${key}`).not.toBe('');
    for (const key of Object.keys(SPELLS)) expect(describeConsumable({ kind: 'spell', key }).text, `Kunststück ${key}`).not.toBe('');
    for (const key of Object.keys(NAILS)) expect(describeConsumable({ kind: 'nail', key }).text, `Übung ${key}`).not.toBe('');
    for (const key of Object.keys(DREAMS)) expect(describeConsumable({ kind: 'dream', key }).text, `Kuriosität ${key}`).not.toBe('');
    for (const key of Object.keys(TOOLS)) expect(describeTool(key).text, `Privileg ${key}`).not.toBe('');
    for (const tag of Object.values(TAGS)) expect(tag.text, `Gefallen ${tag.key}`).not.toBe('');
  });
});
