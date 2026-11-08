import { describe, expect, it } from 'vitest';
import { HAPTIC_PATTERNS, hapticFor } from '../apps/web/src/lib/haptics';
import { soundCatalog } from '../packages/ui/src';

describe('Vibration (#89)', () => {
  it('ordnet Treffer, Fehler und Sieg zu', () => {
    expect(hapticFor('treffer')).toBe('hit');
    expect(hapticFor('quiz-falsch')).toBe('error');
    expect(hapticFor('sieg')).toBe('win');
    expect(hapticFor('wuerfeln')).toBe('tick');
    expect(hapticFor('mischen')).toBeNull();
  });

  it('kennt nur Klangnamen, die es im Katalog gibt', () => {
    for (const name of ['wuerfeln', 'treffer', 'kein-paar', 'quiz-falsch', 'galgen-falsch', 'nh-buh', 'sieg', 'niederlage', 'zeit-um', 'schach-matt']) {
      expect(name in soundCatalog).toBe(true);
      expect(hapticFor(name)).not.toBeNull();
    }
  });

  it('hält die Impulse kurz', () => {
    for (const pattern of Object.values(HAPTIC_PATTERNS)) expect(pattern.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(300);
  });
});
