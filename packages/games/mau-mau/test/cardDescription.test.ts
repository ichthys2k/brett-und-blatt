import { describe, expect, it } from 'vitest';
import { mauMauCardDescription } from '../src/cardDescription';

describe('Mau-Mau Card Description Provider', () => {
  it('describes 7 correctly with stacking enabled and pending draw', () => {
    // Normal 7
    expect(mauMauCardDescription('H7.1', { options: { sevenStack: 'on' }, pendingDraw: 0 })).toContain(
      '7: Nächster Spieler zieht 2 Karten (kann mit 7 weitergeben)',
    );

    // Stacking 7 when pending draw > 0
    expect(mauMauCardDescription('S7.1', { options: { sevenStack: 'on' }, pendingDraw: 2 })).toContain(
      '+4 ziehen (oder mit 7 weitergeben)',
    );

    // Stacking off
    expect(mauMauCardDescription('H7.1', { options: { sevenStack: 'off' }, pendingDraw: 0 })).toBe(
      '7: Nächster Spieler zieht 2 Karten',
    );
  });

  it('describes 8, 9, Ass, and Bube correctly', () => {
    // 8: aussetzen
    expect(mauMauCardDescription('H8.1')).toBe('8: Nächster Spieler setzt aus');

    // 9: Richtungswechsel wenn nineReverse an
    expect(mauMauCardDescription('H9.1', { options: { nineReverse: 'on' } })).toContain('9: Richtungswechsel');
    expect(mauMauCardDescription('H9.1', { options: { nineReverse: 'off' } })).toContain('Farbe (Herz) oder Rang bedienen');

    // Ass: noch einmal wenn aceExtraTurn an
    expect(mauMauCardDescription('H1.1', { options: { aceExtraTurn: 'on' } })).toContain('Ass: Nochmal am Zug');
    expect(mauMauCardDescription('H1.1', { options: { aceExtraTurn: 'off' } })).toContain('Farbe (Herz) oder Rang bedienen');

    // Bube: Farbe wünschen
    expect(mauMauCardDescription('C11.1', { options: { jackOnEverything: 'on' } })).toContain(
      'Bube: Farbe wünschen (auf jede Karte legbar)',
    );
  });

  it('describes standard cards correctly', () => {
    expect(mauMauCardDescription('H10.1')).toBe('Farbe (Herz) oder Rang bedienen');
    expect(mauMauCardDescription('S13.1')).toBe('Farbe (Pik) oder Rang bedienen');
  });
});
