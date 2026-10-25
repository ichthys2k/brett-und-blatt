import { describe, expect, it } from 'vitest';
import { Rng, canonicalJson, randomSeed, sameValue } from '../src';

describe('Rng', () => {
  it('liefert bei gleichem Seed dieselbe Folge', () => {
    const a = Rng.fromSeed('abc');
    const b = Rng.fromSeed('abc');
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  it('trennt Zufallsströme je Zweck', () => {
    expect(Rng.fromSeed('abc', 'mischen').next()).not.toBe(Rng.fromSeed('abc', 'würfel').next());
  });

  it('lässt sich über den gespeicherten Zustand fortsetzen', () => {
    const a = Rng.fromSeed('fortsetzen');
    a.next();
    const copy = new Rng(a.state);
    expect(copy.next()).toBe(a.next());
  });

  it('bleibt im Wertebereich und verteilt Würfe grob gleichmäßig', () => {
    const rng = Rng.fromSeed('würfel');
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60_000; i++) {
      const value = rng.int(6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
      counts[value]!++;
    }
    for (const count of counts) expect(Math.abs(count - 10_000)).toBeLessThan(500);
  });

  it('mischt ohne Karten zu verlieren und ohne das Original zu verändern', () => {
    const cards = Array.from({ length: 32 }, (_, i) => i);
    const shuffled = Rng.fromSeed('mischen').shuffle(cards);
    expect(shuffled).not.toEqual(cards);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(cards);
    expect(cards[0]).toBe(0);
  });

  it('erzeugt verschiedene Startwerte für neue Partien', () => {
    expect(randomSeed()).not.toBe(randomSeed());
  });
});

describe('canonicalJson', () => {
  it('ist unabhängig von der Reihenfolge der Schlüssel', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
    expect(sameValue({ cell: 3, type: 'place' }, { type: 'place', cell: 3 })).toBe(true);
    expect(sameValue({ cell: 3 }, { cell: 4 })).toBe(false);
  });
});
