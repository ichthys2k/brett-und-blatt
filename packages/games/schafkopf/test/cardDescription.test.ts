import { describe, expect, it } from 'vitest';
import { schafkopfCardDescription } from '../src/cardDescription';

describe('Schafkopf Card Description Provider', () => {
  it('describes Sauspiel trumps correctly', () => {
    const state = { phase: 'play', contract: { gameType: 'sauspiel' as const, calledSuit: 'C' as const } };

    // 4 Ober
    expect(schafkopfCardDescription('C12.1', state)).toContain('Höchster Trumpf (Der Alte / Eichel-Ober)');
    expect(schafkopfCardDescription('S12.1', state)).toContain('Der Blaue / Gras-Ober');
    expect(schafkopfCardDescription('H12.1', state)).toContain('Der Rote / Herz-Ober');
    expect(schafkopfCardDescription('D12.1', state)).toContain('Der Runde / Schellen-Ober');

    // Unter
    expect(schafkopfCardDescription('C11.1', state)).toContain('Trumpf (Eichel-Unter) · 2 Augen');

    // Herz-Karten
    expect(schafkopfCardDescription('H1.1', state)).toContain('Höchster Farbtrumpf (Herz-Sau) · 11 Augen');
    expect(schafkopfCardDescription('H10.1', state)).toContain('Zweithöchster Farbtrumpf (Herz 10) · 10 Augen');
    expect(schafkopfCardDescription('H7.1', state)).toContain('Trumpf (Herz) · 0 Augen');

    // Gerufene Sau
    expect(schafkopfCardDescription('C1.1', state)).toContain('Gerufene Sau (Partnerkarte / Eichel-Sau) · 11 Augen');

    // Fehlfarbe
    expect(schafkopfCardDescription('S1.1', state)).toContain('Fehlfarbe (Gras) · 11 Augen');
  });

  it('describes Wenz correctly (only Unter are trump)', () => {
    const state = { phase: 'play', contract: { gameType: 'wenz' as const } };

    expect(schafkopfCardDescription('C11.1', state)).toContain('Höchster Trumpf (Eichel-Unter) · 2 Augen');
    expect(schafkopfCardDescription('S11.1', state)).toContain('Zweithöchster Trumpf (Gras-Unter) · 2 Augen');

    // Ober und Herz-Karten sind Fehlfarbe im Wenz!
    expect(schafkopfCardDescription('C12.1', state)).toContain('Fehlfarbe (Eichel) · 3 Augen');
    expect(schafkopfCardDescription('H1.1', state)).toContain('Fehlfarbe (Herz) · 11 Augen');
  });

  it('describes Solo correctly', () => {
    const state = { phase: 'play', contract: { gameType: 'solo' as const, trumpSuit: 'C' as const } };

    expect(schafkopfCardDescription('C12.1', state)).toContain('Höchster Trumpf (Der Alte / Eichel-Ober)');
    expect(schafkopfCardDescription('C1.1', state)).toContain('Höchster Farbtrumpf (Eichel-Sau) · 11 Augen');
    expect(schafkopfCardDescription('H1.1', state)).toContain('Fehlfarbe (Herz) · 11 Augen');
  });
});
