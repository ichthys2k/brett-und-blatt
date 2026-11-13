import { describe, expect, it } from 'vitest';
import { CLIENT_BURST, CLIENT_PER_SECOND, MessageBudget, accessFor, parseClientId } from '../src/access';

const allowed = ['https://spiele.lipponer.de', 'http://localhost:5173'];

describe('Zugang für fremde Clients (#334)', () => {
  it('lässt eingetragene Webseiten herein', () => {
    expect(accessFor('https://spiele.lipponer.de', null, allowed)).toEqual({ kind: 'web', origin: 'https://spiele.lipponer.de' });
  });

  it('lehnt fremde Webseiten ab, auch mit Kennung', () => {
    expect(accessFor('https://fremde-seite.example', null, allowed)).toBeNull();
    expect(accessFor('https://fremde-seite.example', 'mein-client', allowed)).toBeNull();
  });

  it('lässt Programme ohne Origin mit gültiger Kennung herein', () => {
    expect(accessFor(null, 'quest-xr', allowed)).toEqual({ kind: 'client', client: 'quest-xr' });
  });

  it('verlangt ohne Origin eine gültige Kennung', () => {
    expect(accessFor(null, null, allowed)).toBeNull();
    expect(accessFor(null, '', allowed)).toBeNull();
  });

  it('prüft das Muster der Kennung', () => {
    expect(parseClientId('cli')).toBe('cli');
    expect(parseClientId('mein-quest-client-2')).toBe('mein-quest-client-2');
    expect(parseClientId('ab')).toBeNull();
    expect(parseClientId('Gross')).toBeNull();
    expect(parseClientId('-vorne')).toBeNull();
    expect(parseClientId('hinten-')).toBeNull();
    expect(parseClientId('mit leerzeichen')).toBeNull();
    expect(parseClientId('a'.repeat(41))).toBeNull();
    expect(parseClientId('a'.repeat(40))).toBe('a'.repeat(40));
  });
});

describe('Ratenbegrenzung je Verbindung', () => {
  it('erlaubt einen Stoß und bremst danach', () => {
    const budget = new MessageBudget(0);
    for (let i = 0; i < CLIENT_BURST; i++) expect(budget.take(0)).toBe(true);
    expect(budget.take(0)).toBe(false);
  });

  it('füllt gleichmäßig nach, aber nicht über den Stoß hinaus', () => {
    const budget = new MessageBudget(0);
    for (let i = 0; i < CLIENT_BURST; i++) budget.take(0);
    // Nach einer Sekunde sind CLIENT_PER_SECOND Marken nachgewachsen.
    let allowedCount = 0;
    while (budget.take(1000)) allowedCount++;
    expect(allowedCount).toBe(CLIENT_PER_SECOND);
    // Nach langer Pause höchstens wieder der volle Stoß.
    allowedCount = 0;
    while (budget.take(1_000_000)) allowedCount++;
    expect(allowedCount).toBe(CLIENT_BURST);
  });

  it('übersteht eine rückwärts laufende Uhr', () => {
    const budget = new MessageBudget(5000, 2, 1);
    expect(budget.take(4000)).toBe(true);
    expect(budget.take(4000)).toBe(true);
    expect(budget.take(4000)).toBe(false);
  });
});
