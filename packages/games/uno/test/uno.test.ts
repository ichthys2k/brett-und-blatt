import { Rng } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule } from '../src';
import { canPlayCard, canStackCard, setup } from '../src/rules';
import type { UnoCard } from '../src/types';

import { playRandomGame } from '@brett-und-blatt/engine/testing';

describe('Eins! Vertrag', () => {
  for (const check of gameContractChecks(gameModule, { seatCounts: [2, 4], randomGames: 20, maxMoves: 4_000 })) {
    test(check.name, check.run);
  }
});

describe('Eins! Regeln & Varianten', () => {
  it('startet mit 7 Karten je Spieler und einer offenen Startkarte', () => {
    const rng = Rng.fromSeed('seed-1');
    const state = setup(3, rng);

    expect(state.hands).toHaveLength(3);
    for (const hand of state.hands) {
      expect(hand).toHaveLength(7);
    }
    expect(state.discard).toHaveLength(1);
    expect(state.activeColor).toBeTruthy();
    expect(state.turn).toBe(0);
    expect(state.direction).toBe(1);
  });

  it('erlaubt passendes Anlegen nach Farbe oder Zahl und verbietet Unpassendes', () => {
    const topCard: UnoCard = { id: 'top', front: { color: 'red', type: '5' } };

    const redNine: UnoCard = { id: 'c1', front: { color: 'red', type: '9' } };
    const blueFive: UnoCard = { id: 'c2', front: { color: 'blue', type: '5' } };
    const blueZero: UnoCard = { id: 'c3', front: { color: 'blue', type: '0' } };
    const wild: UnoCard = { id: 'c4', front: { color: 'wild', type: 'wild' } };

    expect(canPlayCard(redNine, topCard, 'red', 'light')).toBe(true);
    expect(canPlayCard(blueFive, topCard, 'red', 'light')).toBe(true);
    expect(canPlayCard(blueZero, topCard, 'red', 'light')).toBe(false);
    expect(canPlayCard(wild, topCard, 'red', 'light')).toBe(true);
  });

  it('Strafkarten stapeln (stacking: same und progressive)', () => {
    const draw2: UnoCard = { id: 'd2', front: { color: 'red', type: 'draw2' } };
    const draw4: UnoCard = { id: 'd4', front: { color: 'wild', type: 'wildDraw4' } };

    // Same: +2 auf +2 erlaubt, +4 auf +2 verboten
    expect(canStackCard(draw2, draw2, 'light', 'same')).toBe(true);
    expect(canStackCard(draw4, draw2, 'light', 'same')).toBe(false);

    // Progressive: +4 auf +2 erlaubt
    expect(canStackCard(draw4, draw2, 'light', 'progressive')).toBe(true);
    expect(canStackCard(draw2, draw4, 'light', 'progressive')).toBe(false);
  });

  it('Aussetzen überspringt den nächsten Spieler', () => {
    const rng = Rng.fromSeed('seed-skip');
    const state = setup(3, rng);

    // Gib Spieler 0 eine rote Aussetzen-Karte
    const skipCard: UnoCard = { id: 'skip-1', front: { color: 'red', type: 'skip' } };
    state.activeColor = 'red';
    state.hands[0] = [skipCard];

    const { state: next } = gameModule.applyMove(state, 0, { type: 'play', cardId: 'skip-1' });

    // Spieler 1 wird übersprungen, Spieler 2 ist dran (oder Spieler 0 hat gewonnen weil Hand leer)
    expect(next.winner).toBe(0);
  });

  it('Richtungswechsel kehrt die Spielrichtung um', () => {
    const rng = Rng.fromSeed('seed-rev');
    const state = setup(4, rng);

    const revCard: UnoCard = { id: 'rev-1', front: { color: 'red', type: 'reverse' } };
    state.activeColor = 'red';
    state.hands[0] = [revCard, { id: 'dummy', front: { color: 'red', type: '1' } }];

    const { state: next } = gameModule.applyMove(state, 0, { type: 'play', cardId: 'rev-1' });

    expect(next.direction).toBe(-1);
    // Bei 4 Spielern und Richtung -1 ist nach Spieler 0 Spieler 3 dran
    expect(next.turn).toBe(3);
  });

  it('Eins! vergessen führt bei Anprangern (catchUno) zu 2 Strafkarten', () => {
    const rng = Rng.fromSeed('seed-uno');
    const state = setup(2, rng);

    // Spieler 0 legt seine vorletzte Karte, vergisst aber Eins! (callUno: false)
    const cardToPlay: UnoCard = { id: 'play-1', front: { color: 'red', type: '1' } };
    state.activeColor = 'red';
    state.hands[0] = [cardToPlay, { id: 'last-card', front: { color: 'blue', type: '2' } }];

    const { state: afterPlay } = gameModule.applyMove(state, 0, { type: 'play', cardId: 'play-1', callUno: false });

    expect(afterPlay.hands[0]).toHaveLength(1);
    expect(afterPlay.unoProtection[0]).toBe(false);

    // Spieler 1 prangert Spieler 0 an
    const { state: afterCatch } = gameModule.applyMove(afterPlay, 1, { type: 'catchUno', target: 0 });

    // Spieler 0 muss 2 Strafkarten ziehen und hat nun 3 Karten
    expect(afterCatch.hands[0]).toHaveLength(3);
  });

  it('Wenden (Flip): Dreht die aktive Seite auf dark und spiegelt die Farbe', () => {
    const rng = Rng.fromSeed('seed-flip');
    const state = setup(2, rng, { variant: 'flip' });

    const flipCard: UnoCard = {
      id: 'flip-1',
      front: { color: 'red', type: 'flip' },
      back: { color: 'orange', type: 'flip' },
    };
    state.activeColor = 'red';
    state.hands[0] = [flipCard, { id: 'dummy', front: { color: 'blue', type: '1' } }];

    const { state: next } = gameModule.applyMove(state, 0, { type: 'play', cardId: 'flip-1' });

    expect(next.activeSide).toBe('dark');
    expect(next.activeColor).toBe('orange');
  });

  it('Keine Gnade (No Mercy): Scheidet bei 25 Karten automatisch aus (Mercy-Regel)', () => {
    const rng = Rng.fromSeed('seed-mercy');
    const state = setup(2, rng, { variant: 'no-mercy', mercyLimit: 25 });

    // Spieler 1 sammelt 25 Karten an
    state.pendingDraw = 20;
    state.hands[1] = Array.from({ length: 6 }, (_, i) => ({ id: `c_${i}`, front: { color: 'red', type: '1' } }));
    state.turn = 1;

    // Spieler 1 muss ziehen
    const { state: next } = gameModule.applyMove(state, 1, { type: 'draw' });

    expect(next.eliminated[1]).toBe(true);
    // Da Spieler 1 ausgeschieden ist, gewinnt der verbleibende Spieler 0
    expect(next.winner).toBe(0);
  });

  it('7-0 Tauschregel: 7 tauscht Hand mit Zielspieler', () => {
    const rng = Rng.fromSeed('seed-70');
    const state = setup(2, rng, { sevenZero: 'on' });

    const sevenCard: UnoCard = { id: 'seven-1', front: { color: 'red', type: '7' } };
    state.activeColor = 'red';
    state.hands[0] = [sevenCard, { id: 'a1', front: { color: 'blue', type: '1' } }];
    state.hands[1] = [
      { id: 'b1', front: { color: 'green', type: '2' } },
      { id: 'b2', front: { color: 'green', type: '3' } },
      { id: 'b3', front: { color: 'green', type: '4' } },
    ];

    const { state: next } = gameModule.applyMove(state, 0, { type: 'play', cardId: 'seven-1', targetPlayer: 1 });

    // Spieler 0 hat nun die 3 Karten von Spieler 1, Spieler 1 hat die verbliebene 1 Karte von Spieler 0
    expect(next.hands[0]).toHaveLength(3);
    expect(next.hands[1]).toHaveLength(1);
  });
});
