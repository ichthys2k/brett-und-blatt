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

describe('Doppelkopf-Bot', () => {
  it('spielt Serien regelgerecht auf allen Stufen', async () => {
    const { computeBotMove, isLegalMove } = await import('@brett-und-blatt/engine');
    for (const level of ['easy', 'medium', 'hard'] as const) {
      let s = gameModule.setup(4, {}, `bot-${level}`);
      for (let i = 0; i < 3000 && !gameModule.result(s); i++) {
        const seat = gameModule.currentPlayers(s)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'doppelkopf', botId: 'doppelkopf', level, seat, view: gameModule.playerView(s, seat), seed: `${i}`, timeBudgetMs: 50 }) as never;
        expect(isLegalMove(gameModule, s, seat, move)).toBe(true);
        s = gameModule.applyMove(s, seat, move).state;
      }
      expect(gameModule.result(s)).not.toBeNull();
    }
  }, 60_000);
});

describe('Pflichtsolo', () => {
  const play = async (opts: Record<string, string>, seed: string, seats = 4) => {
    const { computeBotMove } = await import('@brett-und-blatt/engine');
    let s = gameModule.setup(seats, opts, seed);
    for (let i = 0; i < 20_000 && !gameModule.result(s); i++) {
      const seat = gameModule.currentPlayers(s)[0] as number;
      const move = computeBotMove(gameModule, { gameId: 'doppelkopf', botId: 'doppelkopf', level: 'medium', seat, view: gameModule.playerView(s, seat), seed: `${i}`, timeBudgetMs: 50 }) as never;
      s = gameModule.applyMove(s, seat, move).state;
    }
    return s;
  };

  it('Pflichtsolo: Solist kommt heraus, Geber bleibt, das Spiel zählt nicht', () => {
    let s = gameModule.setup(4, { mandatorySolo: 'true', rounds: '8' }, 'pflicht-1');
    // Platz 2 meldet einen Vorbehalt, die anderen sind gesund.
    for (const seat of s.activeSeats) {
      s = gameModule.applyMove(s, seat, seat === 2 ? { type: 'reservation' } : { type: 'healthy' }).state;
    }
    expect(s.phase).toBe('chooseSolo');
    s = gameModule.applyMove(s, 2, { type: 'chooseContract', contract: { type: 'damensolo', soloist: 2 } }).state;
    expect(s.contract.mandatory).toBe(true);
    expect(s.leaderSeat).toBe(2);
    // Spiel zu Ende spielen.
    while (s.phase === 'play') {
      const seat = gameModule.currentPlayers(s)[0] as number;
      const move = gameModule.legalMoves(s, seat).find((m) => m.type === 'play')!;
      s = gameModule.applyMove(s, seat, move).state;
    }
    expect(s.mandatoryDone).toEqual([2]);
    const dealer = s.dealerSeat;
    s = gameModule.applyMove(s, s.activeSeats[0]!, { type: 'nextGame' }).state;
    expect(s.gameNumber).toBe(1);
    expect(s.dealerSeat).toBe(dealer);
  });

  it('ein zweites Solo ist ein Lustsolo: Vorhand kommt heraus, das Spiel zählt', () => {
    let s = gameModule.setup(4, { mandatorySolo: 'true', rounds: '8' }, 'pflicht-2');
    s = { ...s, mandatoryDone: [2] };
    for (const seat of s.activeSeats) {
      s = gameModule.applyMove(s, seat, seat === 2 ? { type: 'reservation' } : { type: 'healthy' }).state;
    }
    s = gameModule.applyMove(s, 2, { type: 'chooseContract', contract: { type: 'bubensolo', soloist: 2 } }).state;
    expect(s.contract.mandatory).toBeUndefined();
    expect(s.leaderSeat).toBe(s.activeSeats[0]);
  });

  it('fälliges Pflichtsolo hat Vorrang vor einem früheren Vorbehalt', () => {
    let s = gameModule.setup(4, { mandatorySolo: 'true', rounds: '8' }, 'pflicht-3');
    s = { ...s, mandatoryDone: [s.activeSeats[0]!] };
    for (const seat of s.activeSeats) {
      s = gameModule.applyMove(s, seat, seat === s.activeSeats[0] || seat === s.activeSeats[2] ? { type: 'reservation' } : { type: 'healthy' }).state;
    }
    expect(gameModule.currentPlayers(s)).toEqual([s.activeSeats[2]]);
  });

  it('Vorführung: reichen die Spiele nicht mehr, muss ein Schuldner sofort ein Solo wählen', () => {
    const s = gameModule.setup(4, { mandatorySolo: 'true', rounds: '4' }, 'pflicht-4');
    expect(s.phase).toBe('chooseSolo');
    expect(s.forcedSeat).toBe(s.activeSeats[0]);
    const moves = gameModule.legalMoves(s, s.forcedSeat!);
    expect(moves.every((m) => m.type === 'chooseContract' && m.contract.type !== 'hochzeit')).toBe(true);
  });

  it('ohne Option bleibt alles beim Alten', () => {
    const s = gameModule.setup(4, { rounds: '4' }, 'pflicht-5');
    expect(s.phase).toBe('reservations');
    expect(s.mandatoryDone).toBeUndefined();
  });

  for (const seats of [4, 5]) {
    it(`Bots spielen eine Serie am ${seats}er-Tisch, bis jeder sein Pflichtsolo hatte`, async () => {
      const s = await play({ mandatorySolo: 'true', rounds: '8', table: String(seats) }, `pflicht-serie-${seats}`, seats);
      expect(gameModule.result(s)).not.toBeNull();
      expect([...(s.mandatoryDone ?? [])].sort()).toEqual(Array.from({ length: seats }, (_, i) => i));
      expect(s.history.filter((h) => h.mandatory)).toHaveLength(seats);
      expect(s.history.filter((h) => !h.mandatory)).toHaveLength(8);
    }, 60_000);
  }
});
