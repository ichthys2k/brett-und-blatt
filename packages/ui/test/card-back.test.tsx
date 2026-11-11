import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CardBack,
  CardCosmeticsProvider,
  DEFAULT_CREST_SPEC,
  type CardBackId,
  type CardSize,
} from '../src';

describe('CardBack', () => {
  it('renders default design (classic-red) with role="img" and aria-label', () => {
    const html = renderToStaticMarkup(<CardBack />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Kartenrücken"');
    expect(html).toContain('bub-card-back--classic-red');
    expect(html).toContain('pat-red-');
  });

  it('renders custom label when provided', () => {
    const html = renderToStaticMarkup(<CardBack label="Geheime Karte des Königs" />);
    expect(html).toContain('aria-label="Geheime Karte des Königs"');
  });

  it('renders all 6 built-in themes plus royal-crest and custom-media', () => {
    const designs: CardBackId[] = [
      'classic-red',
      'classic-blue',
      'tavern-oak',
      'bavarian-gold',
      'jester-velvet',
      'dragon-scale',
      'royal-crest',
      'custom-media',
    ];

    for (const design of designs) {
      const html = renderToStaticMarkup(
        <CardBack design={design} customImageUrl={design === 'custom-media' ? 'https://example.com/back.png' : undefined} />,
      );
      expect(html).toContain(`bub-card-back--${design}`);
    }
  });

  it('renders royal-crest with PlayerCrest and crest data', () => {
    const customCrest = {
      animal: '🦅',
      colors: 'blau-silber' as const,
      division: 'geteilt' as const,
      shield: 'spitz' as const,
      ornaments: ['krone' as const],
      inRoom: true,
    };

    const html = renderToStaticMarkup(<CardBack design="royal-crest" crest={customCrest} />);
    expect(html).toContain('bub-card-back--royal-crest');
    expect(html).toContain('bub-card-back-crest');
    expect(html).toContain('🦅');
  });

  it('renders royal-crest with default crest if none is specified', () => {
    const html = renderToStaticMarkup(<CardBack design="royal-crest" />);
    expect(html).toContain('bub-card-back--royal-crest');
    expect(html).toContain(DEFAULT_CREST_SPEC.animal);
  });

  it('renders custom-media with image when customImageUrl is given', () => {
    const html = renderToStaticMarkup(
      <CardBack design="custom-media" customImageUrl="https://example.com/art.webp" label="Spezial-Rücken" />,
    );
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/art.webp"');
    expect(html).toContain('alt="Spezial-Rücken"');
  });

  it('falls back to classic-red when custom-media has no imageUrl', () => {
    const html = renderToStaticMarkup(<CardBack design="custom-media" />);
    expect(html).toContain('bub-card-back--custom-media');
    expect(html).toContain('pat-red-');
  });

  it('applies card size classes correctly', () => {
    const sizes: CardSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    for (const size of sizes) {
      const html = renderToStaticMarkup(<CardBack size={size} />);
      expect(html).toContain(`bub-card-size-${size}`);
    }
  });

  it('inherits design and crest from CardCosmeticsProvider context', () => {
    const html = renderToStaticMarkup(
      <CardCosmeticsProvider value={{ cardBack: 'dragon-scale' }}>
        <CardBack />
      </CardCosmeticsProvider>,
    );
    expect(html).toContain('bub-card-back--dragon-scale');
    expect(html).toContain('pat-dragon-');
  });
});
