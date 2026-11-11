import { describe, expect, it } from 'vitest';
import { skatCardDescription } from '../src/cardDescription';

describe('Skat Card Description Provider', () => {
  it('describes jacks as potential top trumps before game declaration', () => {
    const desc = skatCardDescription('C11.1', { phase: 'bidding' });
    expect(desc).toContain('Kreuz-Bube');
    expect(desc).toContain('2 Augen');
  });

  it('describes grand game trumps and off-suit cards correctly', () => {
    const state = { phase: 'play', declaration: { gameType: 'grand' as const } };
    expect(skatCardDescription('C11.1', state)).toContain('Höchster Trumpf');
    expect(skatCardDescription('C11.1', state)).toContain('2 Augen');

    expect(skatCardDescription('S11.1', state)).toContain('Zweithöchster Trumpf');
    expect(skatCardDescription('H11.1', state)).toContain('Dritthöchster Trumpf');
    expect(skatCardDescription('D11.1', state)).toContain('Vierthöchster Trumpf');

    expect(skatCardDescription('H1.1', state)).toContain('Fehlfarbe (Herz) · 11 Augen');
    expect(skatCardDescription('H7.1', state)).toContain('Fehlfarbe (Herz) · 0 Augen (Lusche)');
  });

  it('describes suit game trumps and off-suit correctly', () => {
    const state = { phase: 'play', declaration: { gameType: 'H' as const } };
    expect(skatCardDescription('C11.1', state)).toContain('Höchster Trumpf (Der Alte)');
    expect(skatCardDescription('H1.1', state)).toContain('Höchste Farbkarte im Trumpf (Ass) · 11 Augen');
    expect(skatCardDescription('H10.1', state)).toContain('Zweithöchste Farbkarte im Trumpf (10) · 10 Augen');
    expect(skatCardDescription('H7.1', state)).toContain('Trumpffarbe (Herz) · 0 Augen (Lusche)');
    expect(skatCardDescription('C1.1', state)).toContain('Fehlfarbe (Kreuz) · 11 Augen');
  });

  it('describes null game correctly', () => {
    const state = { phase: 'play', declaration: { gameType: 'null' as const } };
    expect(skatCardDescription('C11.1', state)).toContain('Nullspiel: Kein Trumpf');
    expect(skatCardDescription('H1.1', state)).toContain('Nullspiel: Kein Trumpf');
  });
});
