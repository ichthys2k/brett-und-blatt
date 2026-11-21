import { describe, expect, it } from 'vitest';
import { seatSummary } from '../src/console/setupSummary';

const words = {
  duel: (level: string) => `Du gegen Computer (${level})`,
  humans: (n: number) => (n === 1 ? '1 Mensch' : `${n} Menschen`),
  bots: (n: number, levels: string) => `${n} Computer (${levels})`,
};
const name = (level: string) => ({ easy: 'leicht', medium: 'mittel', hard: 'schwer' })[level] ?? level;

describe('Zusammenfassung der Besetzung (#617)', () => {
  it('Mensch gegen Computer', () => {
    expect(seatSummary([{ kind: 'human', level: 'medium' }, { kind: 'bot', level: 'medium' }], name, words)).toBe('Du gegen Computer (mittel)');
  });
  it('gemischt mit mehreren Stufen ohne Doppelte', () => {
    const seats = [
      { kind: 'human' as const, level: 'medium' },
      { kind: 'human' as const, level: 'medium' },
      { kind: 'bot' as const, level: 'hard' },
      { kind: 'bot' as const, level: 'easy' },
      { kind: 'bot' as const, level: 'hard' },
    ];
    expect(seatSummary(seats, name, words)).toBe('2 Menschen, 3 Computer (schwer/leicht)');
  });
  it('nur Menschen', () => {
    expect(seatSummary([{ kind: 'human', level: 'medium' }, { kind: 'human', level: 'medium' }, { kind: 'human', level: 'medium' }], name, words)).toBe('3 Menschen');
  });
});
