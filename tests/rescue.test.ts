import { describe, expect, it } from 'vitest';
import { rescueState } from '../apps/web/src/lib/rescue';

describe('Hinweis „Rettungskarte sichern“', () => {
  it('ohne Ausweis gibt es nichts zu sagen', () => {
    expect(rescueState(false, false, null)).toBe('none');
  });

  it('mit Spielercode, aber ohne Rettungscode soll man ihn anlegen', () => {
    expect(rescueState(true, false, null)).toBe('create');
    expect(rescueState(true, false, 'gesichert')).toBe('create');
  });

  it('mit Rettungscode bleibt der Hinweis, bis die Karte als sicher weggelegt abgehakt ist (Drucken allein reicht nicht)', () => {
    expect(rescueState(true, true, null)).toBe('secure');
    expect(rescueState(true, true, 'gedruckt')).toBe('secure');
    expect(rescueState(true, true, 'gesichert')).toBe('ok');
    // auch ein Pass, der nur über den Rettungscode kam (ohne Spielercode)
    expect(rescueState(false, true, null)).toBe('secure');
  });
});
