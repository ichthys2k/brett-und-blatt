import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  GameCard,
  PlayingCard,
  CardCosmeticsProvider,
  type GameCardRuntimeBadge,
} from '../src';

describe('GameCard', () => {
  it('renders children with default role="img" and label', () => {
    const html = renderToStaticMarkup(
      <GameCard label="Eigene Karte">
        <div className="my-content">Hallo Welt</div>
      </GameCard>,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Eigene Karte"');
    expect(html).toContain('my-content');
    expect(html).toContain('Hallo Welt');
    expect(html).toContain('bub-game-card');
  });

  it('renders Anki HTML and scopedCss when provided', () => {
    const html = renderToStaticMarkup(
      <GameCard
        ankiFront={{
          html: '<div class="anki-word">Haus</div>',
          scopedCss: '.anki-word { color: red; }',
        }}
        label="Vokabelkarte"
      />,
    );
    expect(html).toContain('<style>.anki-word { color: red; }</style>');
    expect(html).toContain('<div class="anki-word">Haus</div>');
    expect(html).toContain('aria-label="Vokabelkarte"');
  });

  it('renders structured frame with title, illustration, bodyText, and badges', () => {
    const html = renderToStaticMarkup(
      <GameCard
        title="Feuerdrache"
        illustration={<span className="illus">🔥🐉</span>}
        bodyText="Fügt beim Ausspielen allen Gegnern 2 Schaden zu."
        footer="Selten • Drachenspiel"
        badges={[
          { position: 'top-left', label: '5', tone: 'mana', icon: <span>💎</span> },
          { position: 'bottom-left', label: '6', tone: 'danger' },
          { position: 'bottom-right', label: '4', tone: 'success' },
        ]}
      />,
    );
    expect(html).toContain('Feuerdrache');
    expect(html).toContain('🔥🐉');
    expect(html).toContain('Fügt beim Ausspielen allen Gegnern 2 Schaden zu.');
    expect(html).toContain('Selten • Drachenspiel');
    expect(html).toContain('bub-card-pill--mana');
    expect(html).toContain('bub-card-pill--danger');
    expect(html).toContain('bub-card-pill--success');
    expect(html).toContain('aria-label="Feuerdrache"');
  });

  it('handles faceDown toggle with 3D-flipper and aria-label', () => {
    const openHtml = renderToStaticMarkup(<GameCard title="Offen" faceDown={false} />);
    expect(openHtml).not.toContain('bub-game-card-flipped');
    expect(openHtml).toContain('aria-label="Offen"');

    const closedHtml = renderToStaticMarkup(<GameCard title="Offen" faceDown={true} />);
    expect(closedHtml).toContain('bub-game-card-flipped');
    expect(closedHtml).toContain('aria-label="verdeckte Karte"');
    expect(closedHtml).toContain('bub-card-back--classic-red');
  });

  it('renders interactive button when onClick is provided', () => {
    const onClick = vi.fn();
    const html = renderToStaticMarkup(
      <GameCard title="Ausspielbar" onClick={onClick} selected={true} playable={true} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('bub-card-clickable');
    expect(html).toContain('bub-card-selected');
    expect(html).toContain('bub-card-playable');
    expect(html).toContain('aria-pressed="true"');
  });

  it('renders disabled state with disabled attribute', () => {
    const onClick = vi.fn();
    const html = renderToStaticMarkup(
      <GameCard title="Gesperrt" onClick={onClick} disabled={true} />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('bub-card-disabled');
  });

  it('renders foil effects (gold and holo)', () => {
    const goldHtml = renderToStaticMarkup(<GameCard title="Gold" foil="gold" />);
    expect(goldHtml).toContain('bub-game-card-foil--gold');

    const holoHtml = renderToStaticMarkup(<GameCard title="Holo" foil="holo" />);
    expect(holoHtml).toContain('bub-game-card-foil--holo');
  });

  it('renders runtime badges in corners', () => {
    const runtimeBadges: GameCardRuntimeBadge[] = [
      { position: 'top-left', label: '+2', tone: 'accent' },
      { position: 'bottom-right', label: 'Trumpf', tone: 'gold' },
    ];
    const html = renderToStaticMarkup(
      <GameCard title="Test" runtimeBadges={runtimeBadges} />,
    );
    expect(html).toContain('bub-game-card-runtime-badge--top-left');
    expect(html).toContain('bub-game-card-runtime-badge--accent');
    expect(html).toContain('+2');
    expect(html).toContain('bub-game-card-runtime-badge--bottom-right');
    expect(html).toContain('bub-game-card-runtime-badge--gold');
    expect(html).toContain('Trumpf');
  });

  it('applies sizes xs to xl', () => {
    const html = renderToStaticMarkup(<GameCard size="md" title="Mittel" />);
    expect(html).toContain('bub-card-size-md');
  });

  it('integrates with CardCosmeticsProvider for back side in GameCard', () => {
    const html = renderToStaticMarkup(
      <CardCosmeticsProvider value={{ cardBack: 'tavern-oak' }}>
        <GameCard faceDown={true} />
      </CardCosmeticsProvider>,
    );
    expect(html).toContain('bub-card-back--tavern-oak');
  });
});

describe('PlayingCard Integration with CardBack', () => {
  it('renders CardBack automatically when card is null', () => {
    const html = renderToStaticMarkup(<PlayingCard card={null} />);
    expect(html).toContain('bub-card-back');
    expect(html).toContain('bub-card-back--classic-red');
    expect(html).toContain('aria-label="verdeckte Karte"');
  });

  it('renders CardBack when faceDown={true} even if card is set', () => {
    // 0 is typically Ace of Hearts or similar valid card id
    const html = renderToStaticMarkup(<PlayingCard card="HA" faceDown={true} />);
    expect(html).toContain('bub-card-back');
    expect(html).toContain('bub-card-back--classic-red');
    expect(html).toContain('aria-label="verdeckte Karte"');
  });

  it('passes cardBackProps to CardBack when face down', () => {
    const html = renderToStaticMarkup(
      <PlayingCard card={null} cardBackProps={{ design: 'jester-velvet' }} />,
    );
    expect(html).toContain('bub-card-back--jester-velvet');
  });

  it('uses CardCosmeticsProvider when rendering faceDown PlayingCard', () => {
    const html = renderToStaticMarkup(
      <CardCosmeticsProvider value={{ cardBack: 'bavarian-gold' }}>
        <PlayingCard card={null} />
      </CardCosmeticsProvider>,
    );
    expect(html).toContain('bub-card-back--bavarian-gold');
  });
});

describe('PlayingCard with Anki Overrides and Dynamic Hints (K5)', () => {
  it('renders custom name, image, and frame from active Anki overrides', () => {
    const html = renderToStaticMarkup(
      <CardCosmeticsProvider
        value={{
          playingCardOverrides: {
            'fr:hearts-A': {
              kennung: 'fr:hearts-A',
              name: 'Die Rote Kaiserin',
              image: 'https://example.com/kaiserin.png',
              frame: 'gold',
            },
          },
        }}
      >
        <PlayingCard card="H1.1" deckStyle="four-color" />
      </CardCosmeticsProvider>,
    );

    expect(html).toContain('Die Rote Kaiserin');
    expect(html).toContain('href="https://example.com/kaiserin.png"');
    expect(html).toContain('bub-card-frame--gold');
  });

  it('renders dynamic description in title tooltip and aria-label', () => {
    const html = renderToStaticMarkup(
      <PlayingCard
        card="H11.1"
        deckStyle="four-color"
        description="Höchster Trumpf · 2 Augen"
      />,
    );

    expect(html).toContain('title="Höchster Trumpf · 2 Augen"');
    expect(html).toContain('aria-label="Herz Bube – Höchster Trumpf · 2 Augen"');
  });

  it('renders pre-rendered ankiFront via GameCard when available', () => {
    const html = renderToStaticMarkup(
      <CardCosmeticsProvider
        value={{
          playingCardOverrides: {
            'fr:hearts-A': {
              kennung: 'fr:hearts-A',
              name: 'Anki Kaiserin',
              ankiFront: {
                html: '<div class="anki-custom-front">Custom Anki Front</div>',
                scopedCss: '.anki-custom-front { color: red; }',
              },
            },
          },
        }}
      >
        <PlayingCard card="H1.1" deckStyle="four-color" />
      </CardCosmeticsProvider>,
    );

    expect(html).toContain('bub-game-card-anki');
    expect(html).toContain('Custom Anki Front');
  });

  it('falls back to fast standard template when no override matches', () => {
    const html = renderToStaticMarkup(<PlayingCard card="S13.1" deckStyle="four-color" />);
    expect(html).toContain('Pik König');
    expect(html).toContain('bub-card-face');
    expect(html).not.toContain('bub-card-frame--');
  });
});

