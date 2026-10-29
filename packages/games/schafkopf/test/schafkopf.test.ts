import { cardId, resolveOptions, Rng } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule } from '../src/index.js';
import {
  createSchafkopfDeck,
  getContract,
  playerView,
  setup,
  type SchafkopfState,
} from '../src/rules.js';

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) {
    test(check.name, check.run);
  }
});

describe('Schafkopf Regeln & Kartendecks', () => {
  it('erstellt langes Blatt mit 32 und kurzes Blatt mit 24 Karten', () => {
    const longDeck = createSchafkopfDeck('long');
    const shortDeck = createSchafkopfDeck('short');
    expect(longDeck).toHaveLength(32);
    expect(shortDeck).toHaveLength(24);
    // Im kurzen Blatt fehlen 7 und 8
    expect(shortDeck.some((c) => c.startsWith('C7') || c.startsWith('C8'))).toBe(false);
    expect(shortDeck.some((c) => c.startsWith('C9'))).toBe(true);
  });

  it('Sauspiel: Ober > Unter > Herz', () => {
    const state = setup(4, {}, 'test');
    state.contract = { gameType: 'sauspiel', calledSuit: 'C' };
    const contract = getContract(state);

    // Eichel-Ober (C12) sticht Gras-Ober (S12)
    expect(contract.cardPower(cardId('C', 12))).toBeGreaterThan(contract.cardPower(cardId('S', 12)));
    // Schellen-Ober (D12) sticht Eichel-Unter (C11)
    expect(contract.cardPower(cardId('D', 12))).toBeGreaterThan(contract.cardPower(cardId('C', 11)));
    // Schellen-Unter (D11) sticht Herz-Sau (H1)
    expect(contract.cardPower(cardId('D', 11))).toBeGreaterThan(contract.cardPower(cardId('H', 1)));
  });

  it('Wenz: Nur Unter sind Trumpf, Ober sind Fehlfarben', () => {
    const state = setup(4, {}, 'test');
    state.contract = { gameType: 'wenz' };
    const contract = getContract(state);

    expect(contract.isTrump(cardId('C', 11))).toBe(true);
    expect(contract.isTrump(cardId('S', 11))).toBe(true);
    expect(contract.isTrump(cardId('C', 12))).toBe(false); // Ober ist kein Trumpf
    expect(contract.isTrump(cardId('H', 1))).toBe(false); // Herz-Sau ist kein Trumpf
  });

  it('Geheimhaltung: playerView verrät den Partner nicht vor der Rufsau', () => {
    const state = setup(4, {}, 'test-partner');
    state.declarerSeat = 0;
    state.partnerSeat = 2;
    state.partnerRevealed = false;
    state.contract = { gameType: 'sauspiel', calledSuit: 'C' };

    // Aus Sicht von Spieler 0 (Rufer): Partner ist geheim!
    const viewRufer = playerView(state, 0);
    expect(viewRufer.partnerSeat).toBeNull();

    // Aus Sicht von Spieler 1 (Gegner): Partner ist geheim!
    const viewGegner = playerView(state, 1);
    expect(viewGegner.partnerSeat).toBeNull();

    // Aus Sicht von Spieler 2 (Partner selbst): Er weiß, wer der Partner ist!
    const viewPartner = playerView(state, 2);
    expect(viewPartner.partnerSeat).toBe(2);

    // Nach dem Fallen der Rufsau sehen es alle:
    state.partnerRevealed = true;
    expect(playerView(state, 0).partnerSeat).toBe(2);
    expect(playerView(state, 1).partnerSeat).toBe(2);
  });
});

/** Spielt mit Zufallszügen bis zum Beginn des zweiten Spiels der Serie. */
function secondDeal(seats: number, seed: string): any {
  const rng = Rng.fromSeed(seed, 'test');
  let state: any = gameModule.setup(seats, resolveOptions(gameModule), seed);
  for (let i = 0; i < 2_000 && state.gameNumber < 2; i++) {
    const actor = rng.pick(gameModule.currentPlayers(state));
    const moves = gameModule.legalMoves(state, actor);
    state = gameModule.applyMove(state, actor, actor === 'system' ? moves[0] : rng.pick(moves)).state;
  }
  expect(state.gameNumber).toBe(2);
  return state;
}

describe('Geben und Geheimnisse', () => {
  it('jede Serie gibt ab dem zweiten Spiel andere Karten', () => {
    const a = secondDeal(4, 'serie-a');
    const b = secondDeal(4, 'serie-b');
    expect(a.hands).not.toEqual(b.hands);
  });

  it('die Sicht verrät den Zufallsstrom fürs Geben nicht', () => {
    const state = secondDeal(4, 'serie-c');
    expect(gameModule.playerView(state, 0).dealRng).toEqual([0, 0, 0, 0]);
    expect(gameModule.playerView(state, 'spectator').dealRng).toEqual([0, 0, 0, 0]);
  });

  it('fremde Ausgangsblätter bleiben verdeckt', () => {
    const state: any = gameModule.setup(4, resolveOptions(gameModule), 'blatt');
    const view: any = gameModule.playerView(state, 0);
    expect(view.initialHands[0]).toEqual(state.initialHands[0]);
    for (const seat of [1, 2, 3]) expect(view.initialHands[seat]).toEqual([]);
  });
});

describe('Schafkopf-Bot', () => {
  it('spielt Serien regelgerecht und gewinnt als Spieler einen guten Teil', async () => {
    const { computeBotMove, isLegalMove } = await import('@brett-und-blatt/engine');
    let played = 0;
    let won = 0;
    for (let g = 0; g < 4; g++) {
      let s = gameModule.setup(4, {}, `bot-${g}`);
      for (let i = 0; i < 3000 && !gameModule.result(s); i++) {
        const seat = gameModule.currentPlayers(s)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'schafkopf', botId: 'schafkopf', level: 'medium', seat, view: gameModule.playerView(s, seat), seed: `${g}/${i}`, timeBudgetMs: 50 }) as never;
        expect(isLegalMove(gameModule, s, seat, move)).toBe(true);
        s = gameModule.applyMove(s, seat, move).state;
      }
      expect(gameModule.result(s)).not.toBeNull();
      for (const h of s.history) {
        if (h.contract.gameType === 'ramsch') continue;
        played++;
        if (h.won) won++;
      }
    }
    expect(played).toBeGreaterThan(10);
    expect(won / played).toBeGreaterThan(0.45);
  }, 60_000);
});

describe('Sonderspiele Bettel und Tout', () => {
  /** Reizt mit „wantToPlay“ für Vorhand, sagt `contract` an und spielt mit Zufallszügen zu Ende. */
  function playOut(contractType: 'bettel' | 'wenz', tout: boolean, seed: string): SchafkopfState {
    const rng = Rng.fromSeed(seed, 'test');
    let state = setup(4, resolveOptions(gameModule, { extras: 'all' }), seed);
    for (let turn = 0; turn < 4; turn++) {
      const seat = gameModule.currentPlayers(state)[0] as number;
      const move = turn === 0 ? { type: 'wantToPlay' as const, contractType } : { type: 'pass' as const };
      state = gameModule.applyMove(state, seat, move).state;
    }
    expect(state.phase).toBe('declare');
    const declarer = state.declarerSeat!;
    const declare = gameModule.legalMoves(state, declarer).find((m) => m.type === 'declare' && m.contract.gameType === contractType && !!m.contract.tout === tout);
    expect(declare).toBeDefined();
    state = gameModule.applyMove(state, declarer, declare!).state;
    for (let i = 0; i < 200 && state.phase !== 'roundOver'; i++) {
      const seat = gameModule.currentPlayers(state)[0] as number;
      const moves = gameModule.legalMoves(state, seat).filter((m) => m.type !== 'double' || state.phase !== 'doubling');
      state = gameModule.applyMove(state, seat, rng.pick(moves)).state;
    }
    expect(state.phase).toBe('roundOver');
    return state;
  }

  it('Bettel lässt sich ansagen und ist gewonnen, wenn der Spieler keinen Stich macht', () => {
    for (const seed of ['bettel-a', 'bettel-b', 'bettel-c', 'bettel-d', 'bettel-e', 'bettel-f']) {
      const state = playOut('bettel', false, seed);
      const last = state.history[state.history.length - 1]!;
      expect(last.contract.gameType).toBe('bettel');
      const tricks = state.completedTricks.filter((t) => t.winner === state.declarerSeat).length;
      expect(last.won).toBe(tricks === 0);
      if (!last.won) {
        // Verloren: Schluss mit genau diesem einen Stich des Spielers.
        expect(tricks).toBe(1);
        expect(state.completedTricks.at(-1)!.winner).toBe(state.declarerSeat);
      }
    }
  });

  it('Tout ist nur mit allen Stichen gewonnen und zählt doppelt', () => {
    for (const seed of ['tout-a', 'tout-b', 'tout-c', 'tout-d', 'tout-e', 'tout-f']) {
      const state = playOut('wenz', true, seed);
      const last = state.history[state.history.length - 1]!;
      const tricks = state.completedTricks.filter((t) => t.winner === state.declarerSeat).length;
      expect(last.won).toBe(tricks === state.completedTricks.length);
      expect(Math.abs(last.scorePerPlayer[state.declarerSeat!]!)).toBe(3 * 100);
      if (!last.won) {
        // Verloren: Schluss mit dem ersten Stich der Gegner.
        expect(state.completedTricks.filter((t) => t.winner !== state.declarerSeat)).toHaveLength(1);
        expect(state.completedTricks.at(-1)!.winner).not.toBe(state.declarerSeat);
      }
    }
  });
});
