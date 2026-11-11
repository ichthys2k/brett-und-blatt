import { describe, expect, it } from 'vitest';
import { unoCardDescription } from '../src/cardDescription';

describe('Uno Card Description Provider', () => {
  it('describes action cards correctly', () => {
    expect(unoCardDescription('skip')).toBe('Aussetzen: Nächster Spieler setzt aus');
    expect(unoCardDescription('reverse')).toBe('Richtungswechsel: Spielrichtung dreht sich um');
    expect(unoCardDescription('draw2')).toBe('Zieh 2: Nächster Spieler zieht 2 Karten');
    expect(unoCardDescription('wild')).toBe('Farbe frei wählen');
    expect(unoCardDescription('wildDraw4')).toContain('Farbwahl & Zieh 4');
  });

  it('describes 7 and 0 with sevenZero rule enabled and disabled', () => {
    // With sevenZero enabled
    expect(unoCardDescription('7', { options: { sevenZero: 'on' } })).toContain(
      '7: Handkarten mit einem beliebigen Mitspieler tauschen',
    );
    expect(unoCardDescription('0', { options: { sevenZero: 'on' } })).toContain(
      '0: Alle Spieler geben ihre Handkarten in Spielrichtung weiter',
    );

    // With sevenZero disabled
    expect(unoCardDescription('7', { options: { sevenZero: 'off' } })).toBe('Zahlenkarte 7');
    expect(unoCardDescription('0', { options: { sevenZero: 'off' } })).toBe('Zahlenkarte 0');
  });

  it('describes math mode cards with arithmetic expression when enabled', () => {
    const card = { id: 'card_5_red', front: { color: 'red' as const, type: '5' as const } };
    const descWithMath = unoCardDescription(card, { options: { mathLabels: 'on' } });
    expect(descWithMath).toContain('Zahlenkarte 5 (Aufgabe:');

    const descWithoutMath = unoCardDescription(card, { options: { mathLabels: 'off' } });
    expect(descWithoutMath).toBe('Zahlenkarte 5');
  });
});
