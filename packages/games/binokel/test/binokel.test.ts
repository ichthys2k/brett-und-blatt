import { cardId, computeBotMove, isLegalMove, type CardId } from '@brett-und-blatt/engine';
import { gameContractChecks } from '@brett-und-blatt/engine/testing';
import { describe, expect, it } from 'vitest';
import { binokelContract, findMelds, gameModule, meldPoints } from '../src';
import { legalCardsFor, type BinokelMove, type BinokelState } from '../src/rules';

describe('Vertrag für Spielmodule', () => {
  for (const check of gameContractChecks(gameModule)) it(check.name, check.run);
});

const c = (suit: 'C' | 'S' | 'H' | 'D', rank: number, copy = 1): CardId => cardId(suit, rank, copy);
const labels = (hand: CardId[], trump: 'C' | 'S' | 'H' | 'D' | null) => findMelds(hand, trump).map((m) => `${m.label}:${m.points}`).sort();

describe('Binokel – Meldungen', () => {
  it('Familie, Paar und Binokel', () => {
    const hand = [c('H', 1), c('H', 10), c('H', 13), c('H', 12), c('H', 11), c('C', 13), c('C', 12), c('S', 12), c('D', 11)];
    expect(labels(hand, 'H')).toEqual(['Binokel:40', 'Paar Eichel:20', 'Trumpf-Familie Herz:150'].sort());
    expect(meldPoints(findMelds(hand, 'C'))).toBe(100 + 40 + 40);
  });

  it('vier Gleiche, Rundgang und doppelter Binokel', () => {
    const pairs = ['C', 'S', 'H', 'D'].flatMap((s) => [c(s as 'C', 13), c(s as 'C', 12)]);
    const hand = [...pairs, c('S', 12, 2), c('D', 11), c('D', 11, 2)];
    const names = labels(hand, 'C');
    expect(names).toContain('Rundgang:100');
    expect(names).toContain('Vier Könige:80');
    expect(names).toContain('Vier Ober:60');
    expect(names).toContain('Doppelter Binokel:300');
    expect(names).toContain('Trumpf-Paar Eichel:40');
  });
});

describe('Binokel – Stichregeln', () => {
  const state = (hand: CardId[], trick: { player: number; card: CardId }[], trump: 'C' | 'S' | 'H' | 'D' = 'C'): BinokelState => {
    const base = gameModule.setup(3, {}, 'regeln');
    return { ...base, phase: 'play', trump, leader: 0, currentTrick: trick, hands: [[], hand, []] } as BinokelState;
  };

  it('Farbe bedienen und überstechen, wenn möglich', () => {
    const s = state([c('H', 1), c('H', 11), c('C', 1)], [{ player: 0, card: c('H', 13) }]);
    expect(legalCardsFor(s, 1)).toEqual([c('H', 1)]);
  });

  it('wer nicht bedienen kann, muss trumpfen', () => {
    const s = state([c('S', 1), c('C', 11), c('C', 10)], [{ player: 0, card: c('H', 13) }]);
    expect(legalCardsFor(s, 1).sort()).toEqual([c('C', 10), c('C', 11)].sort());
  });

  it('bei gleichen Karten sticht die zuerst gespielte', () => {
    const contract = binokelContract('C');
    expect(contract.cardPower(c('H', 1))).toBe(contract.cardPower(c('H', 1, 2)));
  });
});

describe('Binokel – Partie', () => {
  it('Bots spielen eine ganze Partie ohne Fehler', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      let s = gameModule.setup(3, { targetScore: '1000' }, `partie-${level}`);
      let steps = 0;
      while (!gameModule.result(s) && steps < 5000) {
        const seat = gameModule.currentPlayers(s)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'binokel', botId: 'binokel', level, seat, view: gameModule.playerView(s, seat), seed: `${steps}`, timeBudgetMs: 50 }) as BinokelMove;
        expect(isLegalMove(gameModule, s, seat, move)).toBe(true);
        s = gameModule.applyMove(s, seat, move).state;
        steps++;
      }
      expect(gameModule.result(s)).not.toBeNull();
    }
  }, 60_000);

  it('Spielmacher gewinnen einen guten Teil ihrer Spiele', () => {
    let played = 0;
    let won = 0;
    let folded = 0;
    for (let g = 0; g < 6; g++) {
      let s = gameModule.setup(3, { targetScore: '1500' }, `quote-${g}`);
      for (let steps = 0; !gameModule.result(s) && steps < 5000; steps++) {
        const seat = gameModule.currentPlayers(s)[0] as number;
        const move = computeBotMove(gameModule, { gameId: 'binokel', botId: 'binokel', level: 'medium', seat, view: gameModule.playerView(s, seat), seed: `${g}/${steps}`, timeBudgetMs: 50 }) as BinokelMove;
        if (move.type === 'nextGame' && s.lastRound && s.lastRound.kind !== 'passedOut') {
          played++;
          if (s.lastRound.won) won++;
          if (s.lastRound.kind === 'fold') folded++;
        }
        s = gameModule.applyMove(s, seat, move).state;
      }
    }
    expect(played).toBeGreaterThan(10);
    expect(won / played).toBeGreaterThan(0.4);
    expect(folded / played).toBeLessThan(0.4);
  }, 60_000);
});

describe('Binokel – Bot und Durch', () => {
  it('drückt die schwachen Karten und spielt Durch, wenn jeder Stich sicher ist', () => {
    const masters = ['C', 'S', 'H', 'D'].flatMap((s) => [c(s as 'C', 1), c(s as 'C', 1, 2)]).concat([c('C', 10), c('C', 10, 2), c('S', 10), c('S', 10, 2)]);
    const weak = [c('H', 13), c('D', 12), c('D', 11), c('S', 11)];
    let state = gameModule.setup(3, { deckSize: '40', allowDurch: 'true' }, 'durch') as BinokelState;
    state = { ...state, phase: 'discard', declarer: 0, bid: 300, dabb: [], hands: state.hands.map((h, s) => (s === 0 ? [...masters, ...weak] : h)) };
    const ask = (s: BinokelState) => computeBotMove(gameModule, { gameId: 'binokel', botId: 'binokel', level: 'hard', seat: 0, view: gameModule.playerView(s, 0), seed: 'd', timeBudgetMs: 50 }) as BinokelMove;
    const discard = ask({ ...state, dabb: weak });
    expect(discard.type).toBe('discard');
    expect([...(discard as { cards: CardId[] }).cards].sort()).toEqual([...weak].sort());
    const declare = { ...state, phase: 'declare' as const, hands: state.hands.map((h, s) => (s === 0 ? masters : h)), pressed: weak };
    expect(ask(declare)).toEqual({ type: 'declareDurch' });
  });
});

describe('Binokel – Vierertisch und Kreuzbinokel', () => {
  const runSeries = (options: Record<string, string>, seed: string, level: 'medium' | 'hard' = 'medium') => {
    let s = gameModule.setup(4, { targetScore: '1000', ...options }, seed);
    const rounds: NonNullable<BinokelState['lastRound']>[] = [];
    for (let steps = 0; !gameModule.result(s) && steps < 8000; steps++) {
      const seat = gameModule.currentPlayers(s)[0] as number;
      const move = computeBotMove(gameModule, { gameId: 'binokel', botId: 'binokel', level, seat, view: gameModule.playerView(s, seat), seed: `${seed}/${steps}`, timeBudgetMs: 50 }) as BinokelMove;
      expect(isLegalMove(gameModule, s, seat, move)).toBe(true);
      const before = s;
      s = gameModule.applyMove(s, seat, move).state;
      if (s.lastRound && s.lastRound !== before.lastRound) rounds.push(s.lastRound);
    }
    return { s, rounds };
  };

  it('am Vierertisch setzt der Geber aus und bekommt keine Karten', () => {
    const s = gameModule.setup(4, {}, 'vier');
    expect(s.active).toEqual([1, 2, 3]);
    expect(s.hands[0]).toEqual([]);
    expect(s.hands.slice(1).map((h) => h.length)).toEqual([12, 12, 12]);
    expect(s.dabb).toHaveLength(4);
    expect(gameModule.currentPlayers(s)).toEqual([1]);
  });

  it('Kreuzbinokel: vier spielen mit 9 Karten (mit Siebenern 11) und Dabb 4', () => {
    const s = gameModule.setup(4, { fourTable: 'kreuz' }, 'kreuz');
    expect(s.active).toEqual([1, 2, 3, 0]);
    expect(s.hands.map((h) => h.length)).toEqual([9, 9, 9, 9]);
    expect(s.dabb).toHaveLength(4);
    const s48 = gameModule.setup(4, { fourTable: 'kreuz', deckSize: '48' }, 'kreuz48');
    expect(s48.hands.map((h) => h.length)).toEqual([11, 11, 11, 11]);
    expect(s48.dabb).toHaveLength(4);
  });

  it('Kreuzbinokel: Partner bekommen dieselben Punkte', () => {
    const { s, rounds } = runSeries({ fourTable: 'kreuz' }, 'kreuz-serie');
    expect(gameModule.result(s)).not.toBeNull();
    for (const r of rounds) {
      expect(r.points[0]).toBe(r.points[2]);
      expect(r.points[1]).toBe(r.points[3]);
    }
    expect(s.scores[0]).toBe(s.scores[2]);
    expect(s.scores[1]).toBe(s.scores[3]);
    const res = gameModule.result(s)!;
    if (res.kind === 'win') expect([[0, 2], [1, 3]]).toContainEqual([...res.winners].sort());
  }, 60_000);

  it('Kreuzbinokel: Meldungen zählen nur mit eigenem Stich', () => {
    let s = gameModule.setup(4, { fourTable: 'kreuz' }, 'kreuz-meld');
    // Platz 1 reizt, die anderen passen.
    s = gameModule.applyMove(s, 1, { type: 'bid', value: 150 }).state;
    for (const seat of [2, 3, 0]) s = gameModule.applyMove(s, seat, { type: 'pass' }).state;
    expect(s.declarer).toBe(1);
    s = gameModule.applyMove(s, 1, { type: 'discard', cards: s.hands[1]!.slice(0, 4) as CardId[] }).state;
    s = gameModule.applyMove(s, 1, { type: 'declareTrump', suit: 'C' }).state;
    while (s.phase === 'play') {
      const seat = gameModule.currentPlayers(s)[0] as number;
      s = gameModule.applyMove(s, seat, gameModule.legalMoves(s, seat)[0]!).state;
    }
    const r = s.lastRound!;
    const tricks = (seat: number) => r.madeTrick[seat] ? r.eyes[seat]! + r.melds[seat]! : r.eyes[seat]!;
    const declarerTeam = tricks(1) + tricks(3);
    expect(r.points[1]).toBe(r.won ? declarerTeam : -300);
    expect(r.points[0]).toBe(tricks(0) + tricks(2));
  });

  it('Bots spielen am Vierertisch (Geber setzt aus) eine ganze Partie', () => {
    const { s, rounds } = runSeries({}, 'vier-serie', 'hard');
    expect(gameModule.result(s)).not.toBeNull();
    for (const r of rounds) if (r.declarer !== null) expect(r.points.filter((p, seat) => seat !== r.declarer && p !== 0).length).toBeLessThanOrEqual(2);
  }, 60_000);
});
