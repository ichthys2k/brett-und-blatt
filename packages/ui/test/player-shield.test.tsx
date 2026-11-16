import { CREST_SHIELDS, DEFAULT_CREST } from '@brett-und-blatt/engine';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { PlayerChip, PlayerCrest, PlayerShield, SHIELD_MAX_PORTRAIT, clockTone, setAvatarImageResolver, shieldWidth } from '../src';
import { PORTRAIT_MEDALLION } from '../src/crest/PlayerCrest';

afterEach(() => setAvatarImageResolver(null));

describe('PlayerCrest mit Porträt', () => {
  for (const shield of CREST_SHIELDS) {
    it(`${shield}: Bild und Emoji im Markup, Medaillon innerhalb der viewBox`, () => {
      const html = renderToStaticMarkup(<PlayerCrest spec={{ ...DEFAULT_CREST, shield }} size={96} portrait="/p.webp" portraitEmoji="🦊" />);
      expect(html).toContain('class="bub-crest-portrait"');
      expect(html).toContain('href="/p.webp"');
      expect(html).toContain('class="bub-crest-emoji"');
      expect(html).toContain('🦊');
      expect(html).toContain('clip-path="url(#portrait-');
      const { y, r } = PORTRAIT_MEDALLION[shield];
      expect(50 - r).toBeGreaterThanOrEqual(10);
      expect(50 + r).toBeLessThanOrEqual(90);
      expect(y - r).toBeGreaterThanOrEqual(30);
      expect(y + r).toBeLessThanOrEqual(132);
    });
  }
  it('Emoji-Vorgabe ist das Wappentier', () => {
    expect(renderToStaticMarkup(<PlayerCrest spec={DEFAULT_CREST} portrait="/p.webp" />)).toContain(DEFAULT_CREST.animal);
  });
  it('mit ring: Zeitbalken mit Ton', () => {
    const html = renderToStaticMarkup(<PlayerCrest spec={DEFAULT_CREST} portrait="/p.webp" ring={{ fraction: 0.5, tone: 'warning' }} />);
    expect(html).toContain('bub-crest-ring');
    expect(html).toContain('var(--color-warning)');
    expect(html).toContain('stroke-dashoffset');
  });
  it('ohne ring kein Zeitbalken', () => {
    expect(renderToStaticMarkup(<PlayerCrest spec={DEFAULT_CREST} portrait="/p.webp" />)).not.toContain('bub-crest-ring');
  });
});

describe('PlayerShield', () => {
  it('Bild nie größer als 192 px Medaillon', () => {
    expect(shieldWidth(100)).toBe(100);
    expect(shieldWidth(1000) * 0.68).toBeLessThanOrEqual(SHIELD_MAX_PORTRAIT);
  });
  it('löst das Avatarbild auf, Bot ohne Bild zeigt 🤖, Plakette trägt das Platzzeichen', () => {
    setAvatarImageResolver((a) => (a === '🦊' ? '/fuchs.webp' : undefined));
    const html = renderToStaticMarkup(<PlayerShield avatar="🦊" size={72} symbol={<b>X</b>} />);
    expect(html).toContain('/fuchs.webp');
    expect(html).toContain('bub-shield-badge');
    expect(html).toContain('<b>X</b>');
    expect(renderToStaticMarkup(<PlayerShield avatar="bot:x" size={72} />)).toContain('🤖');
  });
  it('ungültiges Wappen → Standardschild', () => {
    expect(renderToStaticMarkup(<PlayerShield avatar="🦊" crest="quatsch" size={72} />)).toBe(renderToStaticMarkup(<PlayerShield avatar="🦊" size={72} />));
  });
});

describe('clockTone', () => {
  it('Töne', () => {
    expect(clockTone(null)).toBe('idle');
    const base = { kind: 'perMove', running: true, usingBank: false, leftMs: 1, bankLeftMs: null, expired: false } as const;
    expect(clockTone({ ...base, fraction: 0.9 })).toBe('ok');
    expect(clockTone({ ...base, fraction: 0.3 })).toBe('warning');
    expect(clockTone({ ...base, fraction: 0.1 })).toBe('danger');
  });
});

describe('PlayerChip size="card"', () => {
  const props = { name: 'Mia', symbol: '●', avatar: '🦊', active: true, clock: null } as const;
  it('zeigt das Schild statt Ring und Avatar im Namen', () => {
    const html = renderToStaticMarkup(<PlayerChip {...props} size="card" crest="schild:spitz;teilung:quer;farben:rot-gold;tier:🦊;raum:1" />);
    expect(html).toContain('data-size="card"');
    expect(html).toContain('bub-shield');
    expect(html).not.toContain('bub-ring');
    expect(html).toContain('Wappen von Mia');
  });
  it('ohne und mit ungültigem Wappen: Standardschild', () => {
    const a = renderToStaticMarkup(<PlayerChip {...props} size="card" />);
    const b = renderToStaticMarkup(<PlayerChip {...props} size="card" crest="kaputt" />);
    expect(a).toBe(b);
    expect(a).toContain('bub-shield');
  });
  it('kompakt bleibt kompakt', () => {
    const html = renderToStaticMarkup(<PlayerChip {...props} />);
    expect(html).toContain('bub-ring');
    expect(html).not.toContain('bub-shield');
    expect(html).not.toContain('data-size');
  });
});
