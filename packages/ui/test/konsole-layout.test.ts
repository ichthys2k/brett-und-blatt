import { describe, expect, it } from 'vitest';
import { knsColumns, knsLayout } from '../src/konsole/layout';

describe('Hochformat der Konsole (#637)', () => {
  it('knsLayout: Hochformat bei hohem oder schmalem Fenster', () => {
    expect(knsLayout(390, 844)).toBe('portrait');
    expect(knsLayout(360, 640)).toBe('portrait');
    expect(knsLayout(768, 1024)).toBe('portrait');
    expect(knsLayout(650, 500)).toBe('portrait');
    expect(knsLayout(844, 390)).toBe('landscape');
    expect(knsLayout(1280, 800)).toBe('landscape');
    expect(knsLayout(1920, 1080)).toBe('landscape');
  });

  it('knsColumns: zwei bzw. drei Spalten im Hochformat, mehr im Querformat', () => {
    expect(knsColumns(390, 844)).toBe(2);
    expect(knsColumns(360, 640)).toBe(2);
    expect(knsColumns(768, 1024)).toBe(3);
    expect(knsColumns(1280, 800)).toBe(4);
    expect(knsColumns(1920, 1080)).toBe(4);
    expect(knsColumns(844, 390)).toBeGreaterThanOrEqual(3);
  });
});
