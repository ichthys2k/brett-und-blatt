import { describe, expect, it } from 'vitest';
import { bearerKey, isOperator, sameKey } from '../src/operator';

const KEY = 'ein-langer-geheimer-schluessel-123';
const req = (auth?: string) => new Request('https://x.test/betreiber/turnier/ABC', { method: 'DELETE', headers: auth ? { Authorization: auth } : {} });

describe('Betreiber-Schlüssel', () => {
  it('erkennt den richtigen Schlüssel', async () => {
    expect(await isOperator(req(`Bearer ${KEY}`), KEY)).toBe(true);
  });
  it('lehnt falsche, fehlende und zu kurze Schlüssel ab', async () => {
    expect(await isOperator(req(`Bearer ${KEY}x`), KEY)).toBe(false);
    expect(await isOperator(req(), KEY)).toBe(false);
    expect(await isOperator(req('Bearer kurz'), 'kurz')).toBe(false);
    expect(await isOperator(req(`Bearer ${KEY}`), undefined)).toBe(false);
    expect(await isOperator(req(`Basic ${KEY}`), KEY)).toBe(false);
  });
  it('liest nur einen Bearer-Schlüssel plausibler Länge', () => {
    expect(bearerKey(req(`Bearer ${KEY}`))).toBe(KEY);
    expect(bearerKey(req('Bearer a'))).toBeNull();
  });
  it('vergleicht ohne Rücksicht auf Länge', async () => {
    expect(await sameKey('a', 'ab')).toBe(false);
    expect(await sameKey('ab', 'ab')).toBe(true);
  });
});
