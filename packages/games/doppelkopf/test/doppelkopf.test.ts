import { cardId, resolveOptions, Rng } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule } from '../src/index.js';
import {
  createDokoDeck,
  getContract,
  playerView,
  setup,
} from '../src/rules.js';

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) {
    test(check.name, check.run);
  }
});

describe('Doppelkopf Regeln & Kartendeck', () => {
  it('erstellt ein Doppelkopf-Blatt mit 48 Karten', () => {
    const deck = createDokoDeck();
    expect(deck).toHaveLength(48);
    // 9 bis Ass doppelt
    expect(deck.filter((c) => c === cardId('C', 12, 1))).toHaveLength(1);
    expect(deck.filter((c) => c === cardId('C', 12, 2))).toHaveLength(1);
  });

  it('Normalspiel: Dulle (H10) > Kreuz-Dame > Buben > Karo', () => {
    const state = setup(4, {}, 'test-doko');
    state.contract = { type: 'normal' };
    const contract = getContract(state);

    // Herz-10 (Dulle) sticht Kreuz-Dame
    expect(contract.cardPower(cardId('H', 10, 1))).toBeGreaterThan(contract.cardPower(cardId('C', 12, 1)));
    // Kreuz-Dame sticht Pik-Dame
    expect(contract.cardPower(cardId('C', 12, 1))).toBeGreaterThan(contract.cardPower(cardId('S', 12, 1)));
    // Karo-Dame sticht Kreuz-Bube
    expect(contract.cardPower(cardId('D', 12, 1))).toBeGreaterThan(contract.cardPower(cardId('C', 11, 1)));
    // Karo-Bube sticht Karo-Ass
    expect(contract.cardPower(cardId('D', 11, 1))).toBeGreaterThan(contract.cardPower(cardId('D', 1, 1)));
  });

  it('Geheimhaltung: playerView verrät keine fremden Re-Spieler vor der Ansage', () => {
    const state = setup(4, {}, 'test-doko-teams');
    state.reTeam = [0, 2];
    state.revealedRe = [];

    // Aus Sicht von Spieler 1 (Kontra): Er weiß nur, dass er NICHT Re ist
    const view1 = playerView(state, 1);
    expect(view1.reTeam).not.toContain(0);
    expect(view1.reTeam).not.toContain(2);

    // Aus Sicht von Spieler 0 (Re): Er weiß, dass er selbst Re ist
    const view0 = playerView(state, 0);
    expect(view0.reTeam).toContain(0);
    expect(view0.reTeam).not.toContain(2); // Weiß noch nicht, dass Spieler 2 Re ist

    // Wenn Spieler 2 Re ansagt:
    state.revealedRe = [2];
    expect(playerView(state, 1).reTeam).toContain(2);
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
});
