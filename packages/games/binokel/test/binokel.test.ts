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
