import { describe, expect, it } from 'vitest';
import { calculateRanks } from '../src/RoundSummary';

describe('RoundSummary calculateRanks', () => {
  it('ranks players in descending order by default (higher score is better)', () => {
    const players = [
      { seat: 0, score: 50 },
      { seat: 1, score: 120 },
      { seat: 2, score: 80 },
    ];
    const ranks = calculateRanks(players, 'desc');
    expect(ranks.get(1)).toBe(1); // 120 -> 1st
    expect(ranks.get(2)).toBe(2); // 80 -> 2nd
    expect(ranks.get(0)).toBe(3); // 50 -> 3rd
  });

  it('handles ties correctly in descending order', () => {
    const players = [
      { seat: 0, score: 100 },
      { seat: 1, score: 100 },
      { seat: 2, score: 40 },
      { seat: 3, score: 10 },
    ];
    const ranks = calculateRanks(players, 'desc');
    expect(ranks.get(0)).toBe(1);
    expect(ranks.get(1)).toBe(1);
    expect(ranks.get(2)).toBe(3); // skips 2
    expect(ranks.get(3)).toBe(4);
  });

  it('ranks players in ascending order when requested (lower score is better, e.g. Tiefflug)', () => {
    const players = [
      { seat: 0, score: 45 },
      { seat: 1, score: 12 },
      { seat: 2, score: 28 },
    ];
    const ranks = calculateRanks(players, 'asc');
    expect(ranks.get(1)).toBe(1); // 12 -> 1st
    expect(ranks.get(2)).toBe(2); // 28 -> 2nd
    expect(ranks.get(0)).toBe(3); // 45 -> 3rd
  });

  it('handles ties in ascending order', () => {
    const players = [
      { seat: 0, score: 10 },
      { seat: 1, score: 10 },
      { seat: 2, score: 25 },
    ];
    const ranks = calculateRanks(players, 'asc');
    expect(ranks.get(0)).toBe(1);
    expect(ranks.get(1)).toBe(1);
    expect(ranks.get(2)).toBe(3);
  });
});
