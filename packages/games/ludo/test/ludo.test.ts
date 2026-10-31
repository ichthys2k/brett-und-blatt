import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { SIX_GEOMETRY, cornerColors } from '../src/ui/geometry';
import {
  SIX_TRACK_LENGTH,
  armOf,
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

  it('Schlagen ist standardmäßig freiwillig', () => {
    let state = gameModule.setup(4, {}, 'test-seed') as LudoState;
    expect(state.mandatoryCapture).toBe(false);
    state.pieces[0][0] = { area: 'track', index: 5 };
    state.pieces[1][0] = { area: 'track', index: 38 };
    state.pieces[0][1] = { area: 'track', index: 20 };
    state = { ...state, turn: 0, phase: 'move', dice: 3, rollsLeft: 0 };

    expect(gameModule.legalMoves(state, 0)).toEqual([
      { type: 'move', pieceIndex: 0 },
      { type: 'move', pieceIndex: 1 },
    ]);
  });

  it('Wurf ohne Zug: der Würfel liegt nicht beim nächsten Spieler (F-004)', () => {
    let state = gameModule.setup(4, {}, 'kein-zug') as LudoState;
    // Kurz vor Schluss: drei Figuren im Ziel (a–c), die letzte steht vor dem Ziel.
    // Mit 1–3 träfe sie ein besetztes Feld, mit 4 müsste sie überspringen, 5 und 6 schießen über.
    state.pieces[0] = [
      { area: 'goal', index: 0 },
      { area: 'goal', index: 1 },
      { area: 'goal', index: 2 },
      { area: 'track', index: 39 },
    ];
    state = { ...state, rollsLeft: 1 };

    const res = gameModule.applyMove(state, 0, { type: 'roll' });
    const rolled = res.events.find((e) => e.type === 'rolled') as { dice: number } | undefined;
    expect(rolled).toBeDefined();
    expect(res.state.turn).toBe(1);
    expect(res.state.phase).toBe('roll');
    // Grün würfelt selbst neu, der alte Wurf gehört sichtbar zu Gelb.
    expect(res.state.dice).toBeNull();
    expect(res.state.lastRoll).toEqual({ seat: 0, dice: rolled!.dice });
    expect(gameModule.legalMoves(res.state, 1)).toEqual([{ type: 'roll' }]);

    // Sobald Grün würfelt, ist der Hinweis auf Gelbs Wurf weg.
    const next = gameModule.applyMove(res.state, 1, { type: 'roll' });
    expect(next.state.lastRoll).toBeNull();
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

describe('Nicht ärgern! zu sechst – Sternbrett', () => {
  it('ab fünf Spielern gilt immer das Sechser-Brett, bis vier nur auf Wunsch', () => {
    expect((gameModule.setup(4, {}, 's') as LudoState).board).toBe('classic');
    expect((gameModule.setup(4, { board: 'six' }, 's') as LudoState).board).toBe('six');
    expect((gameModule.setup(5, {}, 's') as LudoState).board).toBe('six');
    expect((gameModule.setup(6, { board: 'classic' }, 's') as LudoState).board).toBe('six');
    expect((gameModule.setup(6, {}, 's') as LudoState).pieces).toHaveLength(6);
  });

  it('Startfelder liegen je Arm 9 Felder auseinander, freie Arme gleichmäßig verteilt', () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => startTrackIndex(s, 6, 'six'))).toEqual([5, 14, 23, 32, 41, 50]);
    expect([0, 1].map((s) => armOf(s, 2))).toEqual([0, 3]);
    expect([0, 1, 2].map((s) => armOf(s, 3))).toEqual([0, 2, 4]);
    expect(toAbsoluteTrackIndex(5, SIX_TRACK_LENGTH - 1, 6, 'six')).toBe(49);
    // Farben hängen nur am Platz: zu zweit Gelb und Rot, auch auf dem Sternbrett.
    expect(cornerColors(2, 'six')).toEqual([0, null, null, 2, null, null]);
    expect(cornerColors(6, 'six')).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('die Felder des Sternbretts überlappen nicht und folgen dicht aufeinander', () => {
    const points = [
      ...SIX_GEOMETRY.track,
      ...SIX_GEOMETRY.goals.flat(),
      ...SIX_GEOMETRY.homes.flat(),
    ];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      expect(p.x).toBeGreaterThan(30);
      expect(p.x).toBeLessThan(SIX_GEOMETRY.size - 30);
      expect(p.y).toBeGreaterThan(30);
      expect(p.y).toBeLessThan(SIX_GEOMETRY.size - 30);
      for (let j = i + 1; j < points.length; j++) {
        expect(Math.hypot(p.x - points[j].x, p.y - points[j].y)).toBeGreaterThan(64);
      }
    }
    // Aufeinanderfolgende Streckenfelder sind Nachbarn.
    const track = SIX_GEOMETRY.track;
    for (let i = 0; i < track.length; i++) {
      const next = track[(i + 1) % track.length];
      expect(Math.hypot(track[i].x - next.x, track[i].y - next.y)).toBeLessThan(140);
    }
  });

  it('eine Figur läuft 54 Felder und biegt dann ins Ziel ein', () => {
    let state = gameModule.setup(6, {}, 'stern') as LudoState;
    state.pieces[2][0] = { area: 'track', index: 50 };
    state = { ...state, turn: 2, phase: 'move', dice: 4, rollsLeft: 0 };
    const moves = gameModule.legalMoves(state, 2);
    expect(moves).toContainEqual({ type: 'move', pieceIndex: 0 });
    const res = gameModule.applyMove(state, 2, { type: 'move', pieceIndex: 0 });
    expect(res.state.pieces[2][0]).toEqual({ area: 'goal', index: 0 });
  });

  it('Schlagen wirkt über die Arme hinweg', () => {
    let state = gameModule.setup(6, {}, 'stern') as LudoState;
    // Platz 0 auf Schritt 10 = absolut 15, Platz 1 startet bei 14 und steht auf Schritt 0.
    state.pieces[1][0] = { area: 'track', index: 0 };
    state.pieces[0][0] = { area: 'track', index: 7 };
    state = { ...state, turn: 0, phase: 'move', dice: 2, rollsLeft: 0 };
    const res = gameModule.applyMove(state, 0, { type: 'move', pieceIndex: 0 });
    expect(res.state.pieces[0][0]).toEqual({ area: 'track', index: 9 });
    expect(res.state.pieces[1][0]).toEqual({ area: 'home', index: 0 });
  });
});

describe('Nicht ärgern! – Plattform-Vertragstests', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12, maxMoves: 6000, botGames: 1, botMoveLimit: 300 })) {
    test(check.name, check.run, 60_000);
  }
});
