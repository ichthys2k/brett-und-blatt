import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import {
  colorIndex,
  gameModule,
  startTrackIndex,
  toAbsoluteTrackIndex,
  type LudoMove,
  type LudoState,
} from '../src';

describe('Nicht ärgern! (Ludo) – Regeln & Mechanik', () => {
  it('Startzustand hat alle Figuren im Haus und Spieler 0 beginnt', () => {
    const state = gameModule.setup(4, {}, 'test-seed') as LudoState;
    expect(state.turn).toBe(0);
    expect(state.phase).toBe('roll');
    expect(state.rollsLeft).toBe(3);
    expect(state.seats).toBe(4);

    for (let s = 0; s < 4; s++) {
      expect(state.pieces[s]).toHaveLength(4);
      for (const p of state.pieces[s]) {
        expect(p.area).toBe('home');
      }
    }

    const moves = gameModule.legalMoves(state, 0);
    expect(moves).toEqual([{ type: 'roll' }]);
  });

  it('Startpositionen auf dem 40er-Rundkurs sind korrekt', () => {
    // 4 Spieler: 0, 10, 20, 30
    expect(startTrackIndex(0, 4)).toBe(0);
    expect(startTrackIndex(1, 4)).toBe(10);
    expect(startTrackIndex(2, 4)).toBe(20);
    expect(startTrackIndex(3, 4)).toBe(30);

    // 2 Spieler: Gelb (0) und Rot (20) sitzen sich gegenüber
    expect(startTrackIndex(0, 2)).toBe(0);
    expect(startTrackIndex(1, 2)).toBe(20);
    expect(colorIndex(0, 2)).toBe(0);
    expect(colorIndex(1, 2)).toBe(2);
  });

  it('Schritt-zu-Absolut-Umrechnung berücksichtigt den Rundkurs modulo 40', () => {
    // Spieler 1 (Start bei 10): Schritt 35 landet auf (10 + 35) % 40 = 5
    expect(toAbsoluteTrackIndex(1, 35, 4)).toBe(5);
    // Spieler 3 (Start bei 30): Schritt 15 landet auf (30 + 15) % 40 = 5
    expect(toAbsoluteTrackIndex(3, 15, 4)).toBe(5);
  });

  it('Herauskommen bei einer 6 setzt Figur auf Startfeld und gewährt Zusatzzug', () => {
    let state = gameModule.setup(4, {}, 'test-seed') as LudoState;
    // Setzen wir die Phase auf 'move' und dice auf 6
    state = {
      ...state,
      phase: 'move',
      dice: 6,
      canRollAgain: true,
      rollsLeft: 0,
    };

    const moves = gameModule.legalMoves(state, 0);
    expect(moves).toEqual([{ type: 'move', pieceIndex: 0 }]);

    const res = gameModule.applyMove(state, 0, moves[0]);
    expect(res.state.pieces[0][0]).toEqual({ area: 'track', index: 0 });
    // Hat eine 6 gewürfelt -> darf noch einmal würfeln!
    expect(res.state.turn).toBe(0);
    expect(res.state.phase).toBe('roll');
    expect(res.state.rollsLeft).toBe(1);
  });

  it('Startfeld freimachen: Eigene Figur auf Startfeld muss bei 6 weichen', () => {
    let state = gameModule.setup(4, {}, 'test-seed') as LudoState;
    // Figur 0 steht auf Startfeld (index 0), Figuren 1,2,3 noch im Haus
    state.pieces[0][0] = { area: 'track', index: 0 };
    state = {
      ...state,
      phase: 'move',
      dice: 6,
      canRollAgain: true,
      rollsLeft: 0,
    };

    const moves = gameModule.legalMoves(state, 0);
    // Figur 0 MUSS ziehen, um das Startfeld für nachfolgende Figuren freizumachen
    expect(moves).toEqual([{ type: 'move', pieceIndex: 0 }]);

    const res = gameModule.applyMove(state, 0, moves[0]);
    expect(res.state.pieces[0][0].index).toBe(6);
  });

  it('Gegnerische Figur auf der Strecke wird geschlagen', () => {
    let state = gameModule.setup(4, {}, 'test-seed') as LudoState;
    // Spieler 0 steht auf absolutem Feld 8 (Schritt 8)
    state.pieces[0][0] = { area: 'track', index: 8 };
    // Spieler 1 (Start bei 10) steht auf absolutem Feld 12 (Schritt 2)
    state.pieces[1][0] = { area: 'track', index: 2 };

    // Spieler 0 ist am Zug und würfelt eine 4 (8 + 4 = 12)
    state = {
      ...state,
      turn: 0,
      phase: 'move',
      dice: 4,
      canRollAgain: false,
      rollsLeft: 0,
    };

    const moves = gameModule.legalMoves(state, 0);
    expect(moves).toEqual([{ type: 'move', pieceIndex: 0 }]);

    const res = gameModule.applyMove(state, 0, moves[0]);
    // Spieler 0 steht nun auf Feld 12
    expect(res.state.pieces[0][0].index).toBe(12);
    // Spieler 1 wurde geschlagen und ist wieder im Stall!
    expect(res.state.pieces[1][0].area).toBe('home');
    expect(res.events.some((e) => e.type === 'captured')).toBe(true);
  });

  it('Schlagpflicht zwingt zum Schlagen, wenn Schlagzüge vorhanden sind', () => {
    let state = gameModule.setup(4, { capture: 'on' }, 'test-seed') as LudoState;
    // Figur 0 kann einen Gegner schlagen
    state.pieces[0][0] = { area: 'track', index: 5 }; // Zieht mit 3 auf 8 (wo Gegner steht)
    state.pieces[1][0] = { area: 'track', index: 38 }; // Start bei 10 -> (10 + 38) % 40 = 8

    // Figur 1 kann normal ziehen (ohne zu schlagen)
    state.pieces[0][1] = { area: 'track', index: 20 };

    state = {
      ...state,
      turn: 0,
      phase: 'move',
      dice: 3,
      rollsLeft: 0,
    };

    const moves = gameModule.legalMoves(state, 0);
    // Schlagpflicht: Nur Figur 0 darf ziehen!
    expect(moves).toEqual([{ type: 'move', pieceIndex: 0 }]);
  });

  it('Einzug ins Zielhaus und Siegbedingungen', () => {
    let state = gameModule.setup(4, {}, 'test-seed') as LudoState;
    // 3 Figuren bereits im Ziel
    state.pieces[0][0] = { area: 'goal', index: 1 };
    state.pieces[0][1] = { area: 'goal', index: 2 };
    state.pieces[0][2] = { area: 'goal', index: 3 };
    // Letzte Figur auf Schritt 38 (benötigt genau 2 Schritte für Zielfeld 0, da 38 + 2 = 40)
    state.pieces[0][3] = { area: 'track', index: 38 };

    state = {
      ...state,
      turn: 0,
      phase: 'move',
      dice: 2,
      rollsLeft: 0,
    };

    const moves = gameModule.legalMoves(state, 0);
    expect(moves).toEqual([{ type: 'move', pieceIndex: 3 }]);

    const res = gameModule.applyMove(state, 0, moves[0]);
    expect(res.state.pieces[0][3]).toEqual({ area: 'goal', index: 0 });

    const winResult = gameModule.result(res.state);
    expect(winResult).toEqual({ kind: 'win', winners: [0] });
  });

  it('Überschießen über das Zielhaus ist bei exactGoal unzulässig', () => {
    let state = gameModule.setup(4, { exactGoal: 'on' }, 'test-seed') as LudoState;
    state.pieces[0][0] = { area: 'track', index: 39 }; // Braucht 1..4 für Ziel

    state = {
      ...state,
      turn: 0,
      phase: 'move',
      dice: 5, // 39 + 5 = 44 -> slot 4 (überschießt 0..3)
      rollsLeft: 0,
    };

    const moves = gameModule.legalMoves(state, 0);
    expect(moves).toEqual([{ type: 'pass' }]);
  });
});

describe('Nicht ärgern! – Plattform-Vertragstests', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12, maxMoves: 6000, botGames: 1, botMoveLimit: 300 })) {
    test(check.name, check.run, 60_000);
  }
});
