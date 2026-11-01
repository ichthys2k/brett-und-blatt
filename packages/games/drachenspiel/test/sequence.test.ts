import { Rng, type GameEvent, type SeatId } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { gameModule } from '../src';
import { HARD_PLAN, planTurn } from '../src/planner';
import type { DrachenspielMove, DrachenspielState, Minion } from '../src/types';
import { buildBeats } from '../src/ui/sequence';

const names = (seat: SeatId) => (seat === 0 ? 'Blau' : 'Rot');

/** Eine laufende Partie zu Beginn von Platz 0, Karten nach Bedarf ändern. */
function playing(): DrachenspielState {
  let state = gameModule.setup(2, { deckSelection: 'forest' }, 'folge');
  for (let step = 0; step < 6 && state.phase !== 'play'; step++) {
    const seat = gameModule.currentPlayers(state)[0] as SeatId;
    const move: DrachenspielMove = state.phase === 'mulligan' ? { type: 'mulligan', discardIndices: [] } : gameModule.legalMoves(state, seat)[0]!;
    state = gameModule.applyMove(state, seat, move).state;
  }
  return JSON.parse(JSON.stringify(state)) as DrachenspielState;
}

function minion(id: string, owner: SeatId, attack: number, health: number, extra: Partial<Minion> = {}): Minion {
  return {
    id, cardId: 'c1', owner, playOrder: 1, name: id, emoji: '🐾', cost: 1, baseAttack: attack, attack, baseHealth: health, maxHealth: health, health,
    damage: 0, enchantments: [], quote: null, sound: null, taunt: false, rush: false, bubble: false, poisonous: false, stealth: false, canAttack: true, hasAttacked: false, ...extra,
  };
}

function withBoards(mine: Minion[], theirs: Minion[]): { state: DrachenspielState; seat: SeatId } {
  const state = playing();
  const seat = state.activeSeat;
  state.players[seat]!.board = mine.map((m) => ({ ...m, owner: seat }));
  state.players[1 - seat]!.board = theirs.map((m) => ({ ...m, owner: (1 - seat) as SeatId }));
  return { state, seat };
}

function apply(state: DrachenspielState, seat: SeatId, move: DrachenspielMove): { after: DrachenspielState; events: GameEvent[] } {
  const { state: after, events } = gameModule.applyMove(state, seat, move);
  return { after, events };
}

describe('Drachenspiel: Animationsreihe', () => {
  it('zeigt Angriff und Treffer zusammen, den Tod danach und entfernt das Tier erst dann', () => {
    const { state, seat } = withBoards([minion('Wolf', 0, 3, 5)], [minion('Hase', 1, 1, 2)]);
    const { events } = apply(state, seat, { type: 'attack', attackerId: 'Wolf', target: { kind: 'minion', id: 'Hase' } });
    const beats = buildBeats(events, gameModule.playerView(state, seat), names);
    expect(beats.length).toBe(2);
    expect(beats[0]!.attack).toEqual({ attackerId: 'Wolf', target: 'Hase' });
    expect(beats[0]!.floats.map((f) => f.target).sort()).toEqual(['Hase', 'Wolf']);
    expect(beats[0]!.boards[seat][0]!.minion.health).toBe(4);
    const dying = beats[1]!.boards[(1 - seat) as SeatId];
    expect(dying.map((s) => [s.minion.id, s.dying])).toEqual([['Hase', true]]);
    expect(beats[1]!.log.join()).toContain('Hase geht vom Feld');
  });

  it('nennt im Verlauf keine gezogenen Karten', () => {
    const { state, seat } = withBoards([], []);
    const { events } = apply(state, seat, { type: 'endTurn' });
    const beats = buildBeats(events, gameModule.playerView(state, seat), names);
    const text = beats.flatMap((b) => b.log).join(' ');
    expect(text).toContain('ist am Zug');
    expect(text).not.toMatch(/zieht/);
    expect(beats.reduce((sum, b) => sum + b.durationMs, 0)).toBe(0);
  });

  it('kürzt lange Ketten auf eine feste Gesamtdauer', () => {
    const state = playing();
    const view = gameModule.playerView(state, 0);
    const hits: GameEvent[] = [];
    for (let i = 0; i < 12; i++) {
      hits.push({ type: 'attack', attackerId: 'x', target: { kind: 'hero' } });
      hits.push({ type: 'minionLeft', minionId: 'x', name: 'x' });
    }
    expect(buildBeats(hits, view, names).reduce((sum, b) => sum + b.durationMs, 0)).toBeLessThanOrEqual(2200);
  });
});

describe('Drachenspiel: Planer', () => {
  const best = (state: DrachenspielState, seat: SeatId) => {
    const plans = [...planTurn(state, seat, HARD_PLAN, () => false).values()];
    return plans.sort((a, b) => b.value - a.value)[0]!;
  };

  it('findet tödlichen Schaden über zwei Angriffe', () => {
    const { state, seat } = withBoards([minion('A', 0, 4, 1), minion('B', 0, 3, 1)], [minion('T', 1, 1, 9)]);
    state.players[1 - seat]!.health = 7;
    const plan = best(state, seat);
    expect(plan.value).toBeGreaterThanOrEqual(10_000);
    expect(plan.move).toMatchObject({ type: 'attack', target: { kind: 'hero' } });
  });

  it('räumt erst den Beschützer ab, wenn dahinter der Sieg liegt', () => {
    const { state, seat } = withBoards([minion('A', 0, 2, 1), minion('B', 0, 5, 1)], [minion('T', 1, 0, 2, { taunt: true })]);
    state.players[1 - seat]!.health = 5;
    const plan = best(state, seat);
    expect(plan.value).toBeGreaterThanOrEqual(10_000);
    expect(plan.move).toMatchObject({ type: 'attack', attackerId: 'A', target: { kind: 'minion', id: 'T' } });
  });

  it('bleibt auch bei knapper Zeit bei einem erlaubten Zug', () => {
    const { state, seat } = withBoards([minion('A', 0, 2, 2)], [minion('T', 1, 1, 1)]);
    const view = gameModule.playerView(state, seat);
    const move = gameModule.bots[0]!.chooseMove({ module: gameModule, view, seat, level: 'hard', rng: Rng.fromSeed('knapp'), timeBudgetMs: 0, now: () => Date.now() });
    expect(gameModule.legalMoves(state, seat).map((m) => JSON.stringify(m))).toContain(JSON.stringify(move));
  });
});
