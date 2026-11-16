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
    expect(tableLayout({ width: 0, height: 0, seats: 2 })).toMatchObject({ mode: 'bar', collapsed: true, landscape: false, crowded: false, sideWidth: 288 });
    expect(tableLayout({ width: 390, height: 844, seats: 2 })).toMatchObject({ mode: 'bar', collapsed: true, landscape: false });
    expect(tableLayout({ width: 844, height: 390, seats: 2 })).toMatchObject({ mode: 'rail', collapsed: true, landscape: true });
    expect(tableLayout({ width: 844, height: 390, seats: 4 })).toMatchObject({ mode: 'rail', collapsed: true, landscape: true, crowded: true });
    expect(tableLayout({ width: 390, height: 844, seats: 2, fullBleed: true })).toMatchObject({ mode: 'bar', collapsed: true, landscape: false });
    expect(tableLayout({ width: 844, height: 390, seats: 2, fullBleed: true })).toMatchObject({ mode: 'rail', collapsed: true, landscape: true });
    expect(tableLayout({ width: 1024, height: 768, seats: 4, seatsAround: true })).toMatchObject({ mode: 'ring', collapsed: false, landscape: true });
    expect(tableLayout({ width: 1440, height: 900, seats: 2 })).toMatchObject({ mode: 'side', sideWidth: 352 });
  });
});

describe('tableLayout: Tabelle der Fälle (#484)', () => {
  type Input = Parameters<typeof tableLayout>[0];
  const cases: [string, Input, 'ring' | 'side' | 'rail' | 'bar'][] = [
    ['Handy quer', { width: 844, height: 390, seats: 2 }, 'rail'],
    ['Handy hoch', { width: 390, height: 844, seats: 2 }, 'bar'],
    ['Querformat 540 px', { width: 1024, height: 540, seats: 2 }, 'rail'],
    ['Querformat 599 px', { width: 1024, height: 599, seats: 2 }, 'rail'],
    ['Querformat 600 px', { width: 1024, height: 600, seats: 2 }, 'side'],
    ['Tablet quer, 2 Plätze, seatsAround', { width: 1024, height: 768, seats: 2, seatsAround: true }, 'side'],
    ['Tablet quer, 3 Plätze, seatsAround', { width: 1024, height: 768, seats: 3, seatsAround: true }, 'ring'],
    ['Tablet quer, 8 Plätze, seatsAround', { width: 1024, height: 768, seats: 8, seatsAround: true }, 'ring'],
    ['Tablet quer, 9 Plätze, seatsAround', { width: 1024, height: 768, seats: 9, seatsAround: true }, 'side'],
    ['Tablet hoch, 3 Plätze, seatsAround', { width: 768, height: 1024, seats: 3, seatsAround: true }, 'ring'],
    ['Tablet hoch, 9 Plätze, seatsAround', { width: 768, height: 1024, seats: 9, seatsAround: true }, 'bar'],
    ['Ring schlägt fullBleed', { width: 1024, height: 768, seats: 4, seatsAround: true, fullBleed: true }, 'ring'],
    ['Kopfzeile zählt zur Ringhöhe: 600 zu niedrig', { width: 1024, height: 600, seats: 4, seatsAround: true }, 'side'],
    ['Kopfzeile zählt zur Ringhöhe: 616 genug', { width: 1024, height: 616, seats: 4, seatsAround: true }, 'ring'],
    ['Ungemessen mit fullBleed: Leiste', { width: 0, height: 0, seats: 2, fullBleed: true }, 'bar'],
    ['Ungemessen mit seatsAround: Leiste', { width: 0, height: 0, seats: 4, seatsAround: true }, 'bar'],
  ];
  it.each(cases)('%s', (_name, input, mode) => {
    const layout = tableLayout(input);
    expect(layout.mode).toBe(mode);
    expect(layout.collapsed).toBe(mode === 'rail' || mode === 'bar');
  });
});

describe('tableLayout: Hochformat ist immer die Leiste (#485)', () => {
  it.each([
    [390, 844],
    [360, 640],
    [768, 1024],
    [820, 1180],
    [900, 1200],
  ])('%i × %i ohne Sitzring', (width, height) => {
    expect(tableLayout({ width, height, seats: 2 })).toMatchObject({ mode: 'bar', collapsed: true, landscape: false });
    expect(tableLayout({ width, height, seats: 6 }).mode).toBe('bar');
  });

  it('der Sitzring behält Vorrang (768 × 1024, 3–8 Plätze)', () => {
    for (const seats of [3, 8]) expect(tableLayout({ width: 768, height: 1024, seats, seatsAround: true }).mode).toBe('ring');
  });
});

describe('tableLayout: Handy-Querformat ist immer die Schiene (#486)', () => {
  it.each([
    [844, 390],
    [667, 375],
    [740, 360],
    [932, 430],
    [800, 500],
  ])('%i × %i für jedes Spiel', (width, height) => {
    expect(tableLayout({ width, height, seats: 2 })).toMatchObject({ mode: 'rail', collapsed: true, landscape: true });
    expect(tableLayout({ width, height, seats: 8 }).mode).toBe('rail');
  });

  it('ab 600 px Höhe bleibt es wie bisher', () => {
    expect(tableLayout({ width: 1024, height: 600, seats: 2 }).mode).toBe('side');
    expect(tableLayout({ width: 1024, height: 768, seats: 2 }).mode).toBe('side');
    expect(tableLayout({ width: 1024, height: 768, seats: 4, seatsAround: true }).mode).toBe('ring');
  });
});
