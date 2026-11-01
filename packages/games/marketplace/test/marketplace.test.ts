import { computeBotMove, type BotLevel } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it, test } from 'vitest';
import { gameModule } from '../src';
import { CARDS, FIELD_COUNT, GUILDS, NEWS, guildOf, priceOf } from '../src/board';
import { applyMove, buildableFields, currentPlayers, isLegal, legalMoves, playerView, redeemCost, rentOf, result, sampleHidden, setup, worth, type MarketMove, type MarketState } from '../src/rules';
import { Rng } from '@brett-und-blatt/engine';

describe('marketplace: allgemeine Prüfungen', () => {
  for (const check of gameContractChecks(gameModule, { randomGames: 12, botMoveLimit: 400 })) test(check.name, check.run, 180_000);
});

function table(patch: Partial<MarketState> = {}, seats = 3, options: Record<string, string> = { news: 'off' }): MarketState {
  return { ...setup(seats, options, 'test'), ...patch };
}
const own = (state: MarketState, seat: number, ...fields: number[]) => {
  for (const f of fields) state.owner[f] = seat;
  return state;
};
const at = (state: MarketState, seat: number, pos: number) => {
  state.players[seat]!.pos = pos;
  return state;
};
/** Würfelt mit festem Ergebnis: Sucht einen Zufallszustand, der die Augen liefert. */
function rollTo(state: MarketState, a: number, b: number): MarketState {
  for (let i = 0; i < 5000; i++) {
    const rng = Rng.fromSeed(`w${i}`).state;
    const r = new Rng(rng);
    if (1 + Math.floor(r.next() * 6) === a && 1 + Math.floor(r.next() * 6) === b) return { ...state, rng };
  }
  throw new Error('kein Zufallszustand gefunden');
}
const roll = (state: MarketState, a: number, b: number) => applyMove(rollTo(state, a, b), state.turn, { type: 'roll' }).state;

describe('marketplace: Brett und Start', () => {
  it('hat 18 Betriebe in 6 Zünften, 4 Gemeinschaftsbetriebe, 13 Nachrichten, 12 Karten', () => {
    const fields = Array.from({ length: FIELD_COUNT }, (_, f) => guildOf(f));
    expect(fields.filter((g) => g !== null && g >= 0)).toHaveLength(18);
    expect(fields.filter((g) => g === -1)).toHaveLength(4);
    expect(NEWS).toHaveLength(13);
    expect(CARDS).toHaveLength(12);
  });

  it('gibt Startkapital 40 und +1 je späterem Platz', () => {
    expect(setup(3, {}, 's').players.map((p) => p.cash)).toEqual([40, 41, 42]);
  });

  it('dauert 3 Jahre, ab 5 Spielern 2', () => {
    expect(setup(4, {}, 's').rounds).toBe(24);
    expect(setup(5, {}, 's').rounds).toBe(16);
    expect(setup(5, { years: '4' }, 's').rounds).toBe(32);
  });
});

describe('marketplace: Zug', () => {
  it('kauft einen freien Betrieb und endet ohne Pasch', () => {
    let s = at(table(), 0, 0);
    s = roll(s, 1, 2); // Backhaus, Preis 4
    expect(s.phase).toBe('buy');
    s = applyMove(s, 0, { type: 'buy' }).state;
    expect(s.owner[3]).toBe(0);
    expect(s.players[0]!.cash).toBe(36);
    expect(s.phase).toBe('end');
    s = applyMove(s, 0, { type: 'endTurn' }).state;
    expect(s.turn).toBe(1);
  });

  it('gibt Marktgeld am Stadttor und nach einem Pasch einen weiteren Wurf', () => {
    let s = at(table(), 0, 34);
    s = roll(s, 2, 2); // über das Tor auf Feld 2 (Ausrufer)
    expect(s.players[0]!.pos).toBe(2);
    expect(s.players[0]!.cash).toBeGreaterThanOrEqual(40 + 5 - 4);
    expect(s.mustRoll).toBe(true);
  });

  it('führt beim dritten Pasch in den Kerker', () => {
    let s = table({ doubles: 2 });
    s = roll(s, 3, 3);
    expect(s.players[0]!.pos).toBe(9);
    expect(s.players[0]!.jailTurns).toBe(0);
    expect(s.phase).toBe('end');
  });

  it('Kerker: Pasch befreit, drei Fehlversuche kosten die Kaution', () => {
    let s = at(table(), 0, 9);
    s.players[0]!.jailTurns = 0;
    s = roll(s, 1, 2);
    expect(s.players[0]!.jailTurns).toBe(1);
    expect(s.players[0]!.pos).toBe(9);

    let t = at(table(), 0, 9);
    t.players[0]!.jailTurns = 2;
    t = roll(t, 1, 2); // Feld 12: Bienenhaus frei
    expect(t.players[0]!.jailTurns).toBe(-1);
    expect(t.players[0]!.pos).toBe(12);
    expect(t.players[0]!.cash).toBe(35);

    let u = at(table(), 0, 9);
    u.players[0]!.jailTurns = 0;
    u = roll(u, 1, 1);
    expect(u.players[0]!.pos).toBe(11);
    expect(u.players[0]!.jailTurns).toBe(-1);
    expect(u.mustRoll).toBe(false);
  });
});

describe('marketplace: Ware', () => {
  it('verdoppelt sie bei ganzer Zunft ohne Bau und zählt Bauten', () => {
    const s = own(table(), 1, 12);
    expect(rentOf(s, 12)).toBe(2);
    own(s, 1, 13, 15);
    expect(rentOf(s, 12)).toBe(4);
    s.level[12] = 1;
    expect(rentOf(s, 12)).toBe(4);
    s.level[12] = 2;
    expect(rentOf(s, 12)).toBe(6);
  });

  it('verpfändete Betriebe bringen nichts, Gemeinschaftsbetriebe zählen je Besitz', () => {
    const s = own(table(), 1, 6, 14, 22);
    expect(rentOf(s, 6)).toBe(6);
    s.mortgaged[22] = true;
    expect(rentOf(s, 6)).toBe(4);
    expect(rentOf(s, 22)).toBe(0);
  });

  it('Hofnachrichten verändern die Ware', () => {
    const s = own(table({ news: 'wool' }), 1, 7);
    expect(rentOf(s, 7)).toBe(2);
    expect(rentOf(own(table({ news: 'badHarvest' }), 1, 5), 5)).toBe(1);
    expect(rentOf(own(table({ news: 'flood' }), 1, 6), 6)).toBe(0);
    expect(rentOf(own(table({ news: 'flood' }), 1, 22), 22)).toBe(2);
  });

  it('der Segen halbiert die nächste Ware', () => {
    let s = at(own(table(), 1, 12), 0, 9);
    s.players[0]!.blessed = true;
    s.players[0]!.jailTurns = -1;
    s = roll(s, 1, 2);
    expect(s.players[0]!.cash).toBe(39);
    expect(s.players[1]!.cash).toBe(42);
    expect(s.players[0]!.blessed).toBe(false);
  });
});

describe('marketplace: Bauen und Pfand', () => {
  it('baut nur gleichmäßig und nur mit ganzer Zunft', () => {
    const s = own(table(), 0, 7, 8);
    expect(buildableFields(s, 0)).toEqual([]);
    own(s, 0, 10);
    expect(buildableFields(s, 0)).toEqual([7, 8, 10]);
    const after = applyMove({ ...s, phase: 'end', mustRoll: false }, 0, { type: 'build', field: 7 }).state;
    expect(buildableFields(after, 0)).toEqual([8, 10]);
    expect(after.players[0]!.cash).toBe(37);
  });

  it('verpfändet zum halben Preis und löst mit Aufschlag aus', () => {
    let s = own(table({ phase: 'end', mustRoll: false }), 0, 10);
    s = applyMove(s, 0, { type: 'mortgage', field: 10 }).state;
    expect(s.players[0]!.cash).toBe(44);
    expect(worth(s, 0)).toBe(44 + 4);
    expect(redeemCost(10)).toBe(5);
    s = applyMove(s, 0, { type: 'redeem', field: 10 }).state;
    expect(s.players[0]!.cash).toBe(39);
    expect(s.mortgaged[10]).toBe(false);
  });

  it('wer nicht zahlen kann, verkauft, verpfändet und schreibt den Rest an', () => {
    let s = at(own(table(), 1, 12, 13, 15), 0, 9);
    s.players[0]!.jailTurns = -1;
    s.players[0]!.cash = 1;
    s.level[12] = 2;
    s.level[13] = 2;
    s.level[15] = 2;
    own(s, 0, 7);
    s = roll(s, 1, 2);
    // Ware 6: 1 Kasse + 3 Pfand (Spinnstube) = 4, Rest 2 als Schuldschein
    expect(s.mortgaged[7]).toBe(true);
    expect(s.players[0]!.cash).toBe(0);
    expect(s.debts).toEqual([{ from: 0, to: 1, amount: 2 }]);
    expect(s.phase).not.toBe('finished');
  });
});

describe('marketplace: Versteigerung', () => {
  it('läuft reihum, der Höchstbietende bekommt den Betrieb', () => {
    let s = at(table(), 0, 0);
    s = roll(s, 1, 2);
    s = applyMove(s, 0, { type: 'decline' }).state;
    expect(s.phase).toBe('auction');
    expect(currentPlayers(s)).toEqual([0]);
    s = applyMove(s, 0, { type: 'bid' }).state;
    s = applyMove(s, 1, { type: 'bid' }).state;
    s = applyMove(s, 2, { type: 'fold' }).state;
    expect(currentPlayers(s)).toEqual([0]);
    s = applyMove(s, 0, { type: 'fold' }).state;
    expect(s.owner[3]).toBe(1);
    expect(s.players[1]!.cash).toBe(39);
    expect(s.phase).toBe('end');
  });

  it('bleibt frei, wenn niemand bietet', () => {
    let s = roll(at(table(), 0, 0), 1, 2);
    s = applyMove(s, 0, { type: 'decline' }).state;
    for (const seat of [0, 1, 2]) s = applyMove(s, seat, { type: 'fold' }).state;
    expect(s.owner[3]).toBe(-1);
  });

  it('verdecktes Einmalgebot: geheim, bei Gleichstand gewinnt, wer zuerst dran ist', () => {
    let s = roll(at(table({}, 3, { news: 'off', auction: 'sealed' }), 0, 0), 1, 2);
    s = applyMove(s, 0, { type: 'decline' }).state;
    expect(s.phase).toBe('sealed');
    s = applyMove(s, 1, { type: 'sealedBid', amount: 5 }).state;
    expect(playerView(s, 0).sealed!.bids[1]).toBeNull();
    expect(playerView(s, 1).sealed!.bids[1]).toBe(5);
    s = applyMove(s, 0, { type: 'sealedBid', amount: 5 }).state;
    s = applyMove(s, 2, { type: 'sealedBid', amount: 2 }).state;
    expect(s.owner[3]).toBe(0);
    expect(s.players[0]!.cash).toBe(35);
  });
});

describe('marketplace: Handel und Partnerschaft', () => {
  it('tauscht Betriebe und Brezeln nach Zustimmung', () => {
    let s = own(own(table({ phase: 'end', mustRoll: false }), 0, 7), 1, 8);
    const offer: MarketMove = { type: 'offer', to: 1, give: [7], take: [8], pay: 2 };
    expect(isLegal(s, 0, offer)).toBe(true);
    s = applyMove(s, 0, offer).state;
    expect(currentPlayers(s)).toEqual([1]);
    s = applyMove(s, 1, { type: 'accept' }).state;
    expect(s.owner[7]).toBe(1);
    expect(s.owner[8]).toBe(0);
    expect(s.players[0]!.cash).toBe(38);
    expect(s.phase).toBe('end');
    expect(isLegal(s, 0, { type: 'offer', to: 1, give: [], take: [7], pay: 1 })).toBe(false);
  });

  it('gebaute und fremde Betriebe sind nicht handelbar', () => {
    const s = own(own(table({ phase: 'end', mustRoll: false }), 0, 7), 1, 8);
    s.level[8] = 1;
    expect(isLegal(s, 0, { type: 'offer', to: 1, give: [], take: [8], pay: 1 })).toBe(false);
    expect(isLegal(s, 0, { type: 'offer', to: 1, give: [8], take: [], pay: 0 })).toBe(false);
    expect(isLegal(s, 0, { type: 'offer', to: 1, give: [], take: [], pay: 1 })).toBe(false);
  });

  it('Partnerschaft: nur wer zwei Betriebe hat, bietet sie an; gilt dann für beide', () => {
    let s = own(own(table({ phase: 'end', mustRoll: false }), 0, 12, 13), 1, 15);
    expect(legalMoves(s, 0).some((m) => m.type === 'askPartner')).toBe(true);
    const other = { ...s, turn: 1 };
    expect(legalMoves(other, 1).some((m) => m.type === 'askPartner')).toBe(false);
    const before = worth(s, 1);
    s = applyMove(s, 0, { type: 'askPartner', guild: 2 }).state;
    s = applyMove(s, 1, { type: 'accept' }).state;
    expect(rentOf(s, 15)).toBe(4);
    expect(worth(s, 1)).toBe(before + 5);
    expect(buildableFields(s, 1)).toEqual([15]);
    expect(isLegal(s, 0, { type: 'offer', to: 1, give: [], take: [15], pay: 20 })).toBe(false);
  });

  it('der Jahrmarkt gibt jedem ein Angebot', () => {
    let s = roll(at(table(), 0, 15), 1, 2);
    expect(s.phase).toBe('fair');
    expect(s.players[0]!.cash).toBe(42);
    for (const seat of [0, 1, 2]) {
      expect(currentPlayers(s)).toEqual([seat]);
      s = applyMove(s, seat, { type: 'pass' }).state;
    }
    expect(s.phase).toBe('end');
  });

  it('ohne Handel gibt es keinen Jahrmarkt-Handel und keine Angebote', () => {
    const s = roll(at(table({}, 3, { news: 'off', trade: 'off' }), 0, 15), 1, 2);
    expect(s.phase).toBe('end');
    expect(legalMoves(s, 0).some((m) => m.type === 'offer')).toBe(false);
  });
});

describe('marketplace: Karten und Sonderfelder', () => {
  const drawn = (card: (typeof CARDS)[number], patch: Partial<MarketState> = {}) => roll(at(table({ cardDeck: [card], ...patch }), 0, 0), 1, 1);

  it('wirken wie im Plan', () => {
    expect(drawn('praise').players[0]!.cash).toBe(44);
    expect(drawn('purse').players[0]!.cash).toBe(43);
    expect(drawn('crooked').players[0]!.cash).toBe(37);
    expect(drawn('birthday').players[0]!.cash).toBe(42);
    expect(drawn('festival').players[0]!.cash).toBe(38);
    expect(drawn('toJail').players[0]!.pos).toBe(9);
    expect(drawn('pardon').players[0]!.pardon).toBe(true);
    expect(drawn('toGate').players[0]!.cash).toBe(45);
    expect(drawn('pilgrimage').players[0]!.pos).toBe(11);
    expect(drawn('pilgrimage').players[0]!.cash).toBe(42);
    expect(drawn('errand').phase).toBe('errand');
  });

  it('der Freibrief befreit und kommt zurück in den Stapel', () => {
    let s = at(table(), 0, 9);
    s.players[0]!.jailTurns = 1;
    s.players[0]!.pardon = true;
    s = applyMove(s, 0, { type: 'usePardon' }).state;
    expect(s.players[0]!.jailTurns).toBe(-1);
    expect(s.cardDiscard).toContain('pardon');
  });

  it('Zehnt und Königszoll gehen an die Stadt', () => {
    expect(roll(at(table(), 0, 1), 1, 2).players[0]!.cash).toBe(36);
    expect(roll(at(table(), 0, 30), 1, 2).players[0]!.cash).toBe(36);
  });

  it('Königsbesuch verdoppelt das Marktgeld', () => {
    const s = roll(at(table({ news: 'kingVisit', cardDeck: ['purse'] }), 0, 35), 1, 2);
    expect(s.players[0]!.cash).toBe(40 + 10 + 3);
  });

  it('Thronsaal: Hofsold oder Bau zum halben Preis', () => {
    expect(roll(at(table(), 0, 17), 1, 2).players[0]!.cash).toBe(44);
    const s = roll(at(own(table(), 0, 7, 8, 10), 0, 17), 1, 2);
    expect(s.phase).toBe('audience');
    const t = applyMove(s, 0, { type: 'audience', build: 7 }).state;
    expect(t.level[7]).toBe(1);
    expect(t.players[0]!.cash).toBe(38);
  });

  it('Dorfbrunnen: einen freien Betrieb irgendwo kaufen', () => {
    let s = roll(at(table(), 0, 32), 1, 2);
    expect(s.phase).toBe('well');
    s = applyMove(s, 0, { type: 'well', field: 34 }).state;
    expect(s.owner[34]).toBe(0);
    expect(s.players[0]!.cash).toBe(24);
  });
});

describe('marketplace: Wertung und Geheimnisse', () => {
  it('zählt Kasse, Betriebe, Bauten, Boni und Schuldscheine', () => {
    const s = own(table(), 0, 7, 8, 10);
    s.level[7] = 1;
    s.debts = [{ from: 1, to: 0, amount: 3 }];
    expect(worth(s, 0)).toBe(40 + 19 + 3 + 10 + 3);
    expect(worth(s, 1)).toBe(41 - 3);
  });

  it('ersteigerte Betriebe zählen mit dem gezahlten Preis', () => {
    let s = roll(at(table(), 0, 0), 1, 2);
    s = applyMove(s, 0, { type: 'decline' }).state;
    s = applyMove(s, 0, { type: 'bid' }).state;
    s = applyMove(s, 1, { type: 'fold' }).state;
    s = applyMove(s, 2, { type: 'fold' }).state;
    expect(s.owner[3]).toBe(0);
    expect(worth(s, 0)).toBe(40);
    s = { ...s, phase: 'end', mustRoll: false };
    s = applyMove(s, 0, { type: 'mortgage', field: 3 }).state;
    expect(worth(s, 0)).toBe(39 + 2);
  });

  it('endet nach den Runden, bei Gleichstand gewinnen alle Gleichen', () => {
    let s = table({ round: 23, turn: 2, phase: 'end', mustRoll: false });
    s.players.forEach((p) => (p.cash = 7));
    s = applyMove(s, 2, { type: 'endTurn' }).state;
    expect(s.phase).toBe('finished');
    expect(result(s)).toEqual({ kind: 'win', winners: [0, 1, 2] });
  });

  it('verbirgt Stapel, Zufall und fremden Freibrief', () => {
    const s = table();
    s.players[1]!.pardon = true;
    const v = playerView(s, 0);
    expect(v.rng).toBeNull();
    expect(v.cardDeck.every((c) => c === null)).toBe(true);
    expect(v.players[1]!.pardon).toBe(false);
    expect(playerView(s, 1).players[1]!.pardon).toBe(true);
    expect(playerView(sampleHidden(v, 0, Rng.fromSeed('x')), 0)).toEqual(v);
  });

  it('Aufgeben gibt die Betriebe frei, die anderen spielen weiter', () => {
    let s = own(table(), 0, 7);
    s = applyMove(s, 0, { type: 'resign', seat: 0 }).state;
    expect(s.owner[7]).toBe(-1);
    expect(s.turn).toBe(1);
    s = applyMove(s, 2, { type: 'resign', seat: 2 }).state;
    expect(result(s)).toEqual({ kind: 'win', winners: [1] });
  });
});

describe('marketplace: Bot', () => {
  function match(levels: BotLevel[], seed: string): number[] {
    let s = setup(levels.length, {}, seed);
    for (let step = 0; !result(s) && step < 6000; step++) {
      const seat = currentPlayers(s)[0] as number;
      const move = computeBotMove(gameModule, { gameId: 'marketplace', botId: 'kraemer', level: levels[seat]!, seat, view: playerView(s, seat), seed: `${seed}/${step}`, timeBudgetMs: 20 }) as MarketMove;
      s = applyMove(s, seat, move).state;
    }
    const r = result(s);
    return r?.kind === 'win' ? r.winners : [];
  }

  it('mittel und schwer schlagen leicht zu viert deutlich', () => {
    const games = 120;
    for (const strong of ['medium', 'hard'] as BotLevel[]) {
      let wins = 0;
      for (let i = 0; i < games; i++) {
        const seat = i % 4;
        const levels = [0, 1, 2, 3].map((k) => (k === seat ? strong : 'easy')) as BotLevel[];
        if (match(levels, `${strong}${i}`).includes(seat)) wins++;
      }
      expect(wins / games).toBeGreaterThan(0.45);
    }
  }, 120_000);

  it('alle Zünfte haben stimmige Preise', () => {
    for (const guild of GUILDS) for (const f of guild.fields) expect(priceOf(f)).toBe(guild.prices[guild.fields.indexOf(f as never)]);
  });
});
