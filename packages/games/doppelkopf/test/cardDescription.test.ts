import { describe, expect, it } from 'vitest';
import { doppelkopfCardDescription } from '../src/cardDescription';

describe('Doppelkopf Card Description Provider', () => {
  it('describes normal game trumps correctly', () => {
    const state = { phase: 'play', contract: { type: 'normal' as const } };

    // Dulle
    expect(doppelkopfCardDescription('H10.1', state)).toContain('Höchster Trumpf (Dulle / Herz 10) · 10 Augen');

    // Alte (Kreuz-Dame)
    expect(doppelkopfCardDescription('C12.1', state)).toContain('Spitzentrumpf (Die Alte / Re-Partei) · 3 Augen');

    // Andere Damen
    expect(doppelkopfCardDescription('S12.1', state)).toContain('Die Blaue / Pik-Dame');
    expect(doppelkopfCardDescription('H12.1', state)).toContain('Herz-Dame');
    expect(doppelkopfCardDescription('D12.1', state)).toContain('Karo-Dame');

    // Buben
    expect(doppelkopfCardDescription('C11.1', state)).toContain('Karlchen / Kreuz-Bube');
    expect(doppelkopfCardDescription('S11.1', state)).toContain('Pik-Bube');

    // Karo-Farbtrümpfe
    expect(doppelkopfCardDescription('D1.1', state)).toContain('Höchster Farbtrumpf (Karo-Ass) · 11 Augen');
    expect(doppelkopfCardDescription('D10.1', state)).toContain('Farbtrumpf (Karo 10) · 10 Augen');
    expect(doppelkopfCardDescription('D9.1', state)).toContain('Trumpf (Karo) · 0 Augen');

    // Fehlfarbe
    expect(doppelkopfCardDescription('C1.1', state)).toContain('Fehlfarbe (Kreuz) · 11 Augen');
    expect(doppelkopfCardDescription('S1.1', state)).toContain('Fehlfarbe (Pik) · 11 Augen');
  });

  it('describes damensolo correctly', () => {
    const state = { phase: 'play', contract: { type: 'damensolo' as const } };

    expect(doppelkopfCardDescription('C12.1', state)).toContain('Trumpf (Kreuz-Dame) · 3 Augen');
    expect(doppelkopfCardDescription('H10.1', state)).toContain('Fehlfarbe (Herz) · 10 Augen');
    expect(doppelkopfCardDescription('C11.1', state)).toContain('Fehlfarbe (Kreuz) · 2 Augen');
  });

  it('describes fleischlos correctly', () => {
    const state = { phase: 'play', contract: { type: 'fleischlos' as const } };

    expect(doppelkopfCardDescription('C12.1', state)).toContain('Fleischlos: Kein Trumpf · 3 Augen');
    expect(doppelkopfCardDescription('H10.1', state)).toContain('Fleischlos: Kein Trumpf · 10 Augen');
  });
});
