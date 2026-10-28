import { cardId, inlineBotRunner, LocalSession, Rng } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule } from '../src';
import {
  canPlayCard,
  defaultOptions,
  getNextPlayer,
  isLegal,
  legalMoves,
  playerView,
  sampleHidden,
  setup,
} from '../src/rules';
import type { MauMauOptions, MauMauState } from '../src/types';

function fresh(seats = 3, options: Partial<MauMauOptions> = {}): MauMauState {
  return setup(seats, Rng.fromSeed('regeltest'), options);
}

function setTop(state: MauMauState, card: string, activeSuit: MauMauState['activeSuit']): void {
  state.discard = [cardId(card[0] as 'C' | 'D' | 'H' | 'S', Number(card.slice(1)))];
  state.activeSuit = activeSuit;
}

describe('Mau-Mau Vertrag', () => {
  for (const check of gameContractChecks(gameModule, {
    seatCounts: [2, 5],
    randomGames: 20,
    maxMoves: 3_000,
  })) {
    test(check.name, check.run, 120_000);
  }
});

describe('Mau-Mau Regeln', () => {
  it('startet mit fünf Karten je Platz und einem vollständigen 32er-Blatt', () => {
    for (const seats of [2, 3, 4, 5]) {
      const state = fresh(seats);
      expect(state.hands).toHaveLength(seats);
      for (const hand of state.hands) expect(hand).toHaveLength(5);
      expect(state.discard).toHaveLength(1);

      const all = [...state.hands.flat(), ...state.stock, ...state.discard];
      expect(all).toHaveLength(32);
      expect(new Set(all).size).toBe(32);
      expect(state.turn).toBe(0);
      expect(state.direction).toBe(1);
      expect(state.pendingDraw).toBe(0);
    }
  });

  it('erlaubt Anlegen nach Farbe oder Wert und verbietet Unpassendes', () => {
    const top = cardId('H', 9);
    expect(canPlayCard(cardId('H', 7), top, 'H', defaultOptions)).toBe(true);
    expect(canPlayCard(cardId('C', 9), top, 'H', defaultOptions)).toBe(true);
    expect(canPlayCard(cardId('C', 8), top, 'H', defaultOptions)).toBe(false);
    expect(canPlayCard(cardId('S', 11), top, 'H', defaultOptions)).toBe(true);
  });

  it('Bube auf Bube ist standardmäßig verboten, mit aktiver Wunschfarbe aber nicht', () => {
    const top = cardId('H', 11);
    expect(canPlayCard(cardId('C', 11), top, 'C', defaultOptions)).toBe(false);
    expect(canPlayCard(cardId('C', 5), top, 'C', defaultOptions)).toBe(true);
    expect(
      canPlayCard(cardId('C', 11), top, 'C', { ...defaultOptions, jackOnJack: 'allowed' }),
    ).toBe(true);
  });

  it('Bube auf alles kann abgeschaltet werden', () => {
    const top = cardId('H', 5);
    const options = { ...defaultOptions, jackOnEverything: 'off' as const };
    expect(canPlayCard(cardId('C', 11), top, 'H', options)).toBe(false);
    expect(canPlayCard(cardId('H', 11), top, 'H', options)).toBe(true);
  });

  it('7 legt zwei Strafkarten auf den nächsten Platz und lässt sie stapeln', () => {
    const state = fresh(3);
    setTop(state, 'S7', 'S');
    state.hands[0] = [cardId('S', 7), cardId('C', 5), cardId('D', 6)];
    state.hands[1] = [cardId('H', 7), cardId('C', 8)];
    state.hands[2] = [cardId('C', 9), cardId('D', 10)];

    const { state: afterSeven } = gameModule.applyMove(state, 0, {
      type: 'play',
      cardId: cardId('S', 7),
    });
    expect(afterSeven.pendingDraw).toBe(2);
    expect(afterSeven.turn).toBe(1);
    expect(legalMoves(afterSeven, 1).some((m) => m.type === 'play')).toBe(true);

    const { state: afterStack } = gameModule.applyMove(afterSeven, 1, {
      type: 'play',
      cardId: cardId('H', 7),
    });
    expect(afterStack.pendingDraw).toBe(4);
    expect(afterStack.turn).toBe(2);

    const before = afterStack.hands[2]!.length;
    const { state: afterDraw } = gameModule.applyMove(afterStack, 2, { type: 'draw' });
    expect(afterDraw.pendingDraw).toBe(0);
    expect(afterDraw.hands[2]).toHaveLength(before + 4);
    expect(afterDraw.turn).toBe(0);
  });

  it('7 ohne Stapeln lässt den Nächsten zwei Karten ziehen und setzt ihn aus', () => {
    const state = fresh(3, { sevenStack: 'off' });
    setTop(state, 'S7', 'S');
    state.hands[0] = [cardId('S', 7), cardId('C', 5)];
    const before = state.hands[1]!.length;

    const { state: next } = gameModule.applyMove(state, 0, {
      type: 'play',
      cardId: cardId('S', 7),
    });
    expect(next.pendingDraw).toBe(0);
    expect(next.hands[1]).toHaveLength(before + 2);
    expect(next.turn).toBe(2);
  });

  it('8 setzt den nächsten Platz aus', () => {
    const state = fresh(3);
    setTop(state, 'H8', 'H');
    state.hands[0] = [cardId('H', 8), cardId('C', 5)];
    const { state: next } = gameModule.applyMove(state, 0, { type: 'play', cardId: cardId('H', 8) });
    expect(next.turn).toBe(2);
  });

  it('9 dreht die Richtung, bei zwei Spielern setzt sie aus', () => {
    const four = fresh(4);
    setTop(four, 'H9', 'H');
    four.hands[0] = [cardId('H', 9), cardId('C', 5)];
    const { state: reversed } = gameModule.applyMove(four, 0, { type: 'play', cardId: cardId('H', 9) });
    expect(reversed.direction).toBe(-1);
    expect(reversed.turn).toBe(3);

    const two = fresh(2);
    setTop(two, 'H9', 'H');
    two.hands[0] = [cardId('H', 9), cardId('C', 5)];
    const { state: skipped } = gameModule.applyMove(two, 0, { type: 'play', cardId: cardId('H', 9) });
    expect(skipped.direction).toBe(1);
    expect(skipped.turn).toBe(0);
  });

  it('Ass gibt mit Option „an“ einen weiteren Zug', () => {
    const state = fresh(3, { aceExtraTurn: 'on' });
    setTop(state, 'HA', 'H');
    state.hands[0] = [cardId('H', 1), cardId('C', 5)];
    const { state: next } = gameModule.applyMove(state, 0, { type: 'play', cardId: cardId('H', 1) });
    expect(next.turn).toBe(0);
  });

  it('Bube verlangt eine Wunschfarbe und setzt sie', () => {
    const state = fresh(3);
    setTop(state, 'H5', 'H');
    state.hands[0] = [cardId('C', 11), cardId('C', 5)];

    expect(
      isLegal(state, 0, { type: 'play', cardId: cardId('C', 11) }),
    ).toBe(false);

    const { state: next } = gameModule.applyMove(state, 0, {
      type: 'play',
      cardId: cardId('C', 11),
      chosenSuit: 'D',
    });
    expect(next.activeSuit).toBe('D');
    expect(next.discard.at(-1)).toBe(cardId('C', 11));
  });

  it('„Mau!“ vergessen kostet eine Strafkarte, rechtzeitig gerufen schützt', () => {
    const state = fresh(2);
    setTop(state, 'H5', 'H');
    state.hands[0] = [cardId('H', 6), cardId('C', 5)];
    state.hands[1] = [cardId('C', 2), cardId('D', 3)];

    const { state: silent } = gameModule.applyMove(state, 0, {
      type: 'play',
      cardId: cardId('H', 6),
      callMau: false,
    });
    expect(silent.mauProtection[0]).toBe(false);
    expect(legalMoves(silent, 1).some((m) => m.type === 'catchMau' && m.target === 0)).toBe(true);

    const before = silent.hands[0]!.length;
    const { state: caught } = gameModule.applyMove(silent, 1, { type: 'catchMau', target: 0 });
    expect(caught.hands[0]).toHaveLength(before + 1);
    expect(caught.mauProtection[0]).toBe(true);

    const { state: called } = gameModule.applyMove(state, 0, {
      type: 'play',
      cardId: cardId('H', 6),
      callMau: true,
    });
    expect(called.mauProtection[0]).toBe(true);
    expect(legalMoves(called, 1).some((m) => m.type === 'catchMau')).toBe(false);
    expect(isLegal(called, 1, { type: 'catchMau', target: 0 })).toBe(false);
  });

  it('ein alter Mau-Schutz erlischt, wenn der Spieler wieder Karten aufnimmt', () => {
    const state = fresh(2);
    setTop(state, 'H5', 'H');
    state.hands[0] = [cardId('H', 6), cardId('C', 5)];
    state.hands[1] = [cardId('C', 2), cardId('D', 3)];

    const { state: protectedState } = gameModule.applyMove(state, 0, {
      type: 'play',
      cardId: cardId('H', 6),
      callMau: true,
    });
    expect(protectedState.mauProtection[0]).toBe(true);
    expect(protectedState.turn).toBe(1);

    // Spieler 0 ist nicht am Zug; der Schutz wird erst beim eigenen Ziehen zurückgesetzt.
    const next = JSON.parse(JSON.stringify(protectedState)) as MauMauState;
    next.turn = 0;
    next.hands[0] = [cardId('C', 5)];
    next.hasDrawn = false;
    next.stock = [cardId('C', 7)];

    const { state: afterDraw } = gameModule.applyMove(next, 0, { type: 'draw' });
    expect(afterDraw.hands[0]).toHaveLength(2);
    expect(afterDraw.mauProtection[0]).toBe(false);
  });

  it('die letzte Karte gewinnt sofort, auch wenn sie eine 7 ist', () => {
    const state = fresh(2);
    setTop(state, 'H7', 'H');
    state.hands[0] = [cardId('H', 7)];
    state.hands[1] = [cardId('C', 2), cardId('D', 3)];

    const { state: next } = gameModule.applyMove(state, 0, { type: 'play', cardId: cardId('H', 7) });
    expect(next.winner).toBe(0);
    expect(next.pendingDraw).toBe(0);
    expect(gameModule.result(next)).toEqual({ kind: 'win', winners: [0] });
  });

  it('zieht bei „bis passend“ mehrere Karten und darf dann spielen', () => {
    const state = fresh(2, { drawRule: 'untilMatch' });
    setTop(state, 'H5', 'H');
    state.hands[0] = [cardId('C', 2)];
    state.stock = [cardId('H', 6), cardId('C', 3)]; // wird von hinten gezogen

    const { state: next } = gameModule.applyMove(state, 0, { type: 'draw' });
    expect(next.hands[0]).toEqual([cardId('C', 2), cardId('C', 3), cardId('H', 6)]);
    expect(next.hasDrawn).toBe(true);
    expect(next.turn).toBe(0);
    expect(legalMoves(next, 0).some((m) => m.type === 'play' && m.cardId === cardId('H', 6))).toBe(true);
  });

  it('zieht bei „eine Karte“ genau eine und gibt bei Nichtpassen weiter', () => {
    const state = fresh(2);
    setTop(state, 'H5', 'H');
    state.hands[0] = [cardId('C', 2)];
    state.stock = [cardId('C', 3)];

    const { state: next } = gameModule.applyMove(state, 0, { type: 'draw' });
    expect(next.hands[0]).toEqual([cardId('C', 2), cardId('C', 3)]);
    expect(next.hasDrawn).toBe(false);
    expect(next.turn).toBe(1);
  });

  it('verdeckt fremde Hände und den Talon in der Sicht', () => {
    const state = fresh(3);
    const view = playerView(state, 1);
    expect(view.hands[1]).toEqual(state.hands[1]);
    expect(view.hands[0]).toHaveLength(5);
    expect(view.hands[0]!.every((card) => card === 'hidden')).toBe(true);
    expect(view.stock.every((card) => card === 'hidden')).toBe(true);
    expect(view.rng).toEqual([0, 0, 0, 0]);
  });

  it('füllt unbekannte Karten für Simulationen ohne Doppelte auf', () => {
    const state = fresh(3);
    const view = playerView(state, 1);
    const sample = sampleHidden(view, 1, Rng.fromSeed('sample'));
    const all = [...sample.hands.flat(), ...sample.stock, ...sample.discard];
    expect(all).toHaveLength(32);
    expect(new Set(all).size).toBe(32);
    expect(sample.hands[1]).toEqual(state.hands[1]);
  });

  it('erlaubt das Spielen über eine LocalSession', () => {
    const session = new LocalSession(
      gameModule,
      {
        gameId: 'mau-mau',
        seats: [
          { kind: 'human', name: 'Ich' },
          { kind: 'bot', name: 'Bot' },
        ],
        options: {},
        seed: 'partie-1',
        time: { kind: 'perMove', moveMs: 60_000 },
      },
      { botRunner: inlineBotRunner([gameModule]) },
    );

    const playMove = session.legalMoves(0).find((m) => m.type === 'play');
    expect(playMove).toBeDefined();
    expect(
      session.submit(0, playMove as { type: 'play'; cardId: string; chosenSuit?: 'C' | 'D' | 'H' | 'S' }),
    ).toBe(true);

    session.dispose();
  });

  it('rechnet den nächsten Platz in beide Richtungen richtig', () => {
    expect(getNextPlayer(0, 1, 4)).toBe(1);
    expect(getNextPlayer(0, -1, 4)).toBe(3);
    expect(getNextPlayer(3, 1, 4, 2)).toBe(1);
    expect(getNextPlayer(1, -1, 4, 2)).toBe(3);
  });
});
