import { cardId } from '@brett-und-blatt/engine';
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
