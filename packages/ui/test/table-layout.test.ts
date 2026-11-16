import { describe, expect, it } from 'vitest';
import { tableLayout, type TableLayoutInput, type TableMode } from '../src/tableLayout';

const cases: [string, TableLayoutInput, TableMode][] = [
  ['Handy hoch, ohne Angaben', { width: 390, height: 844, seats: 2 }, 'stack'],
  ['Handy quer, ohne Angaben', { width: 844, height: 390, seats: 2 }, 'side'],
  ['Handy hoch, seatsOnBoard', { width: 390, height: 844, seats: 2, seatsOnBoard: true }, 'stack'],
  ['Handy quer, seatsOnBoard', { width: 844, height: 390, seats: 2, seatsOnBoard: true }, 'rail'],
  ['Querformat über 540 px, seatsOnBoard', { width: 1024, height: 600, seats: 2, seatsOnBoard: true }, 'side'],
  ['Querformat genau 540 px, seatsOnBoard', { width: 1024, height: 540, seats: 2, seatsOnBoard: true }, 'rail'],
  ['Handy hoch, fullBleed', { width: 390, height: 844, seats: 2, fullBleed: true }, 'bar'],
  ['Handy quer, fullBleed', { width: 844, height: 390, seats: 2, fullBleed: true }, 'rail'],
  ['Tablet quer, 2 Plätze, seatsAround', { width: 1024, height: 768, seats: 2, seatsAround: true }, 'side'],
  ['Tablet quer, 3 Plätze, seatsAround', { width: 1024, height: 768, seats: 3, seatsAround: true }, 'ring'],
  ['Tablet quer, 8 Plätze, seatsAround', { width: 1024, height: 768, seats: 8, seatsAround: true }, 'ring'],
  ['Tablet quer, 9 Plätze, seatsAround', { width: 1024, height: 768, seats: 9, seatsAround: true }, 'side'],
  ['Tablet hoch, 2 Plätze, seatsAround', { width: 768, height: 1024, seats: 2, seatsAround: true }, 'stack'],
  ['Tablet hoch, 3 Plätze, seatsAround', { width: 768, height: 1024, seats: 3, seatsAround: true }, 'ring'],
  ['Tablet hoch, 8 Plätze, seatsAround', { width: 768, height: 1024, seats: 8, seatsAround: true }, 'ring'],
  ['Tablet hoch, 9 Plätze, seatsAround', { width: 768, height: 1024, seats: 9, seatsAround: true }, 'stack'],
  ['Tablet quer, 4 Plätze, ohne seatsAround', { width: 1024, height: 768, seats: 4 }, 'side'],
  ['Sitzring schlägt fullBleed', { width: 1024, height: 768, seats: 4, seatsAround: true, fullBleed: true }, 'ring'],
  ['Zu niedrig für den Ring (Kopfzeile zählt mit)', { width: 1024, height: 600, seats: 4, seatsAround: true }, 'side'],
  ['Genau so hoch wie der Ring braucht', { width: 1024, height: 616, seats: 4, seatsAround: true }, 'ring'],
  ['Desktop 1440 × 900, 2 Plätze', { width: 1440, height: 900, seats: 2 }, 'side'],
  ['Desktop 1440 × 900, 4 Plätze, seatsAround', { width: 1440, height: 900, seats: 4, seatsAround: true }, 'ring'],
  ['Noch nicht gemessen', { width: 0, height: 0, seats: 2 }, 'stack'],
  ['Noch nicht gemessen, fullBleed', { width: 0, height: 0, seats: 2, fullBleed: true }, 'stack'],
  ['Noch nicht gemessen, seatsOnBoard, seatsAround', { width: 0, height: 0, seats: 4, seatsOnBoard: true, seatsAround: true }, 'stack'],
];

describe('tableLayout', () => {
  it.each(cases)('%s', (_name, input, mode) => {
    expect(tableLayout(input).mode).toBe(mode);
  });

  it('klappt nur in rail und bar ein', () => {
    for (const [, input] of cases) {
      const layout = tableLayout(input);
      expect(layout.collapsed).toBe(layout.mode === 'rail' || layout.mode === 'bar');
    }
  });

  it('meldet Querformat nur gemessen und ab 3 Plätzen „crowded“', () => {
    expect(tableLayout({ width: 844, height: 390, seats: 2 })).toMatchObject({ landscape: true, crowded: false });
    expect(tableLayout({ width: 390, height: 844, seats: 3 })).toMatchObject({ landscape: false, crowded: true });
    expect(tableLayout({ width: 0, height: 0, seats: 2 }).landscape).toBe(false);
    expect(tableLayout({ width: 500, height: 0, seats: 2 }).landscape).toBe(false);
  });
});
