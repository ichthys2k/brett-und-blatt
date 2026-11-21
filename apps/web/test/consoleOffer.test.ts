import { describe, expect, it } from 'vitest';
import { shouldOfferConsole } from '../src/lib/consoleOffer';

const base = { chosen: 'classic' as const, param: null, alreadyAsked: false, source: 'gamepad' as const, routeName: 'menu' };

describe('Hinweis „Controller erkannt“ (#624)', () => {
  it('erscheint unter allen Bedingungen', () => expect(shouldOfferConsole(base)).toBe(true));
  it('nicht, wenn die Konsole schon gewählt ist', () => expect(shouldOfferConsole({ ...base, chosen: 'console' })).toBe(false));
  it('nicht mit Startparameter', () => expect(shouldOfferConsole({ ...base, param: 'classic' })).toBe(false));
  it('nur einmal', () => expect(shouldOfferConsole({ ...base, alreadyAsked: true })).toBe(false));
  it('nur nach Controller-Eingabe', () => {
    expect(shouldOfferConsole({ ...base, source: 'keyboard' })).toBe(false);
    expect(shouldOfferConsole({ ...base, source: 'pointer' })).toBe(false);
  });
  it('nur auf Start, Bibliothek, Spielseite und Optionen', () => {
    for (const routeName of ['menu', 'home', 'setup', 'sound']) expect(shouldOfferConsole({ ...base, routeName })).toBe(true);
    for (const routeName of ['play', 'room', 'display', 'tournamentEmbed', 'online']) expect(shouldOfferConsole({ ...base, routeName })).toBe(false);
  });
});
