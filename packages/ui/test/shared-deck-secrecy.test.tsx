import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CrestSpec } from '@brett-und-blatt/engine';
import {
  CardBack,
  CardCosmeticsProvider,
  CardFan,
  PlayingCard,
  resolveSharedCardBack,
  type CardBackProps,
} from '../src';

describe('Shared Deck Secrecy Rule (K5)', () => {
  it('resolveSharedCardBack produces neutral back properties without player crest or custom image', () => {
    const frenchBack = resolveSharedCardBack({ deckStyle: 'four-color' });
    expect(frenchBack.design).toBe('classic-red');
    expect(frenchBack.crest).toBeUndefined();
    expect(frenchBack.customImageUrl).toBeUndefined();

    const bavarianBack = resolveSharedCardBack({ deckStyle: 'bavarian' });
    expect(bavarianBack.design).toBe('bavarian-gold');
    expect(bavarianBack.crest).toBeUndefined();
    expect(bavarianBack.customImageUrl).toBeUndefined();

    const customTableBack = resolveSharedCardBack({ tableDesign: 'tavern-oak' });
    expect(customTableBack.design).toBe('tavern-oak');
    expect(customTableBack.crest).toBeUndefined();
    expect(customTableBack.customImageUrl).toBeUndefined();
  });

  it('guarantees identical backs for all opponent cards even when players have custom pass cosmetics', () => {
    // Ein Spieler hat ein eigenes Wappen und einen eigenen Rücken gewählt (z. B. royal-crest)
    const crest: CrestSpec = {
      animal: '🦅',
      colors: 'blau-silber',
      division: 'geteilt',
      shield: 'rund',
      ornaments: ['lorbeer'],
      inRoom: true,
    };
    const playerCosmetics = {
      cardBack: 'royal-crest' as const,
      crest,
      customImageUrl: 'https://example.com/secret-card-marking.png',
    };

    const sharedProps = resolveSharedCardBack({ deckStyle: 'four-color' });

    // Gegnerischer Fächer am Tisch mit sharedProps
    const opponentHandHtml = renderToStaticMarkup(
      <CardCosmeticsProvider value={playerCosmetics}>
        <CardFan
          count={5}
          cardWidth={16}
          label="Gegnerische Hand"
          renderCard={() => <PlayingCard card={null} cardBackProps={sharedProps} />}
        />
      </CardCosmeticsProvider>,
    );

    // Darf niemals das Spieler-Wappen oder das Custom-Bild auf den verdeckten Karten des Gegners zeigen!
    expect(opponentHandHtml).not.toContain('bub-card-back-crest');
    expect(opponentHandHtml).not.toContain('secret-card-marking.png');
    expect(opponentHandHtml).not.toContain('bub-card-back--royal-crest');
    // Stattdessen den einheitlichen Tisch-Kartenrücken:
    expect(opponentHandHtml).toContain('bub-card-back--classic-red');
  });

  it('guarantees identical backs between draw pile (talon/skat) and opponent hands', () => {
    const sharedProps = resolveSharedCardBack({ deckStyle: 'bavarian' });

    const drawPileHtml = renderToStaticMarkup(
      <PlayingCard card={null} deckStyle="bavarian" cardBackProps={sharedProps} />,
    );

    const opponentCardHtml = renderToStaticMarkup(
      <PlayingCard card={null} deckStyle="bavarian" cardBackProps={sharedProps} />,
    );

    // Beide verdeckten Karten haben exakt die gleiche visuelle Repräsentation
    expect(drawPileHtml).toBe(opponentCardHtml);
    expect(drawPileHtml).toContain('bub-card-back--bavarian-gold');
    expect(drawPileHtml).not.toContain('bub-card-back-crest');
  });
});
