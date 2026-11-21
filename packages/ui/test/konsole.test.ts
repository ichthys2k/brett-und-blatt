import { describe, expect, it } from 'vitest';
import { choiceRowMode, splitMode, stepperValue } from '../src/konsole/logic';

describe('Konsolen-Bausteine (#636)', () => {
  it('choiceRowMode: bis vier Möglichkeiten in der Zeile, mehr im Fenster', () => {
    expect(choiceRowMode(2)).toBe('inline');
    expect(choiceRowMode(4)).toBe('inline');
    expect(choiceRowMode(5)).toBe('dialog');
  });

  it('splitMode: Kategorien links nur im breiten Querformat', () => {
    expect(splitMode(1280, 800)).toBe('side');
    expect(splitMode(900, 600)).toBe('side');
    expect(splitMode(899, 600)).toBe('top');
    expect(splitMode(844, 390)).toBe('top');
    expect(splitMode(1024, 1366)).toBe('top');
  });

  it('stepperValue bleibt in den Grenzen', () => {
    expect(stepperValue(3, 1, 5, 1)).toBe(4);
    expect(stepperValue(5, 1, 5, 1)).toBe(5);
    expect(stepperValue(1, 1, 5, -1)).toBe(1);
    expect(stepperValue(2, 0, 10, -5)).toBe(0);
  });
});
