import { describe, expect, it } from 'vitest';
import { sideBarWidth, sideShieldSize, tableLayout } from '../src/tableLayout';

describe('sideShieldSize', () => {
  it('berechnet die Schildgröße nach Platzzahl und Leistenhöhe (#493)', () => {
    // 900 px Höhe -> 614 px verfügbar
    expect(sideShieldSize(2, 900)).toBe(96); // 307 >= 170
    expect(sideShieldSize(4, 900)).toBe(72); // 153.5 >= 124
    expect(sideShieldSize(6, 900)).toBe(52); // 102.33 >= 88
    expect(sideShieldSize(10, 900)).toBe(0); // 61.4 < 88
    expect(sideShieldSize(30, 900)).toBe(0); // 20.47 < 88

    // 768 px Höhe -> 482 px verfügbar
    expect(sideShieldSize(2, 768)).toBe(96); // 241 >= 170
    expect(sideShieldSize(4, 768)).toBe(52); // 120.5 >= 88
    expect(sideShieldSize(6, 768)).toBe(0); // 80.33 < 88

    // Randfälle
    expect(sideShieldSize(0, 900)).toBe(0);
    expect(sideShieldSize(2, 200)).toBe(0);
    expect(sideShieldSize(2, 0)).toBe(0);
  });
});

describe('sideBarWidth', () => {
  it('liefert die Leistenbreite je Fensterbreite und Platzzahl (#493)', () => {
    expect(sideBarWidth(1024, 2)).toBe(288);
    expect(sideBarWidth(1024, 3)).toBe(320);
    expect(sideBarWidth(1099, 2)).toBe(288);
    expect(sideBarWidth(1100, 2)).toBe(320);
    expect(sideBarWidth(1399, 2)).toBe(320);
    expect(sideBarWidth(1400, 2)).toBe(352);
    expect(sideBarWidth(1920, 6)).toBe(352);
  });
});

describe('tableLayout', () => {
  it('entscheidet den Tischmodus für typische Größen', () => {
    expect(tableLayout({ width: 0, height: 0, seats: 2 })).toMatchObject({ mode: 'stack', collapsed: false, landscape: false, crowded: false, sideWidth: 288 });
    expect(tableLayout({ width: 390, height: 844, seats: 2 })).toMatchObject({ mode: 'stack', collapsed: false, landscape: false });
    expect(tableLayout({ width: 844, height: 390, seats: 2 })).toMatchObject({ mode: 'side', collapsed: false, landscape: true });
    expect(tableLayout({ width: 844, height: 390, seats: 4, seatsOnBoard: true })).toMatchObject({ mode: 'rail', collapsed: true, landscape: true, crowded: true });
    expect(tableLayout({ width: 390, height: 844, seats: 2, fullBleed: true })).toMatchObject({ mode: 'bar', collapsed: true, landscape: false });
    expect(tableLayout({ width: 844, height: 390, seats: 2, fullBleed: true })).toMatchObject({ mode: 'rail', collapsed: true, landscape: true });
    expect(tableLayout({ width: 1024, height: 768, seats: 4, seatsAround: true })).toMatchObject({ mode: 'ring', collapsed: false, landscape: true });
    expect(tableLayout({ width: 1440, height: 900, seats: 2 })).toMatchObject({ mode: 'side', sideWidth: 352 });
  });
});

describe('tableLayout: Tabelle der Fälle (#484)', () => {
  type Input = Parameters<typeof tableLayout>[0];
  const cases: [string, Input, 'ring' | 'side' | 'stack' | 'rail' | 'bar'][] = [
    ['Handy quer, seatsOnBoard', { width: 844, height: 390, seats: 2, seatsOnBoard: true }, 'rail'],
    ['Handy hoch, seatsOnBoard', { width: 390, height: 844, seats: 2, seatsOnBoard: true }, 'stack'],
    ['Querformat genau 540 px, seatsOnBoard', { width: 1024, height: 540, seats: 2, seatsOnBoard: true }, 'rail'],
    ['Querformat 600 px, seatsOnBoard', { width: 1024, height: 600, seats: 2, seatsOnBoard: true }, 'side'],
    ['Tablet quer, 2 Plätze, seatsAround', { width: 1024, height: 768, seats: 2, seatsAround: true }, 'side'],
    ['Tablet quer, 3 Plätze, seatsAround', { width: 1024, height: 768, seats: 3, seatsAround: true }, 'ring'],
    ['Tablet quer, 8 Plätze, seatsAround', { width: 1024, height: 768, seats: 8, seatsAround: true }, 'ring'],
    ['Tablet quer, 9 Plätze, seatsAround', { width: 1024, height: 768, seats: 9, seatsAround: true }, 'side'],
    ['Tablet hoch, 3 Plätze, seatsAround', { width: 768, height: 1024, seats: 3, seatsAround: true }, 'ring'],
    ['Tablet hoch, 9 Plätze, seatsAround', { width: 768, height: 1024, seats: 9, seatsAround: true }, 'stack'],
    ['Ring schlägt fullBleed', { width: 1024, height: 768, seats: 4, seatsAround: true, fullBleed: true }, 'ring'],
    ['Kopfzeile zählt zur Ringhöhe: 600 zu niedrig', { width: 1024, height: 600, seats: 4, seatsAround: true }, 'side'],
    ['Kopfzeile zählt zur Ringhöhe: 616 genug', { width: 1024, height: 616, seats: 4, seatsAround: true }, 'ring'],
    ['Ungemessen mit fullBleed bleibt offen', { width: 0, height: 0, seats: 2, fullBleed: true }, 'stack'],
    ['Ungemessen mit seatsAround bleibt offen', { width: 0, height: 0, seats: 4, seatsAround: true, seatsOnBoard: true }, 'stack'],
  ];
  it.each(cases)('%s', (_name, input, mode) => {
    const layout = tableLayout(input);
    expect(layout.mode).toBe(mode);
    expect(layout.collapsed).toBe(mode === 'rail' || mode === 'bar');
  });
});
