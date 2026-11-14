import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardCosmeticsProvider } from '@brett-und-blatt/ui';
import {
  BUB_COMBAT_CARD_NOTETYPE,
  BUB_COURT_CARD_NOTETYPE,
  BUB_QUARTETT_CARD_NOTETYPE,
  type AnkiNote,
} from '@brett-und-blatt/engine';
import { CardFace } from '../../../packages/games/drachenspiel/src/ui/parts';
import { CARDS_DB } from '../../../packages/games/drachenspiel/src/cards';
import { Tile, CardView } from '../../../packages/games/color-sorter/src/ui/Card';
import { CARD_SETS } from '../../../packages/games/quartett/src/sets';
import { QCard, CardBack as QuartettCardBack } from '../../../packages/games/quartett/src/ui';
import { RoleCard } from '../../../packages/games/wolves-sheep/src/ui';
import { Card as LowFlightCard } from '../../../packages/games/low-flight/src/ui';

describe('Spezialkarten <GameCard> & Anki-Overrides (K6, #276)', () => {
  describe('Drachenspiel (Kampfkarten & CardBack)', () => {
    const fuchsDef = CARDS_DB.c53;

    it('rendert Standardkarte im <GameCard>-Container mit BUB_COMBAT_CARD_NOTETYPE', () => {
      const html = renderToStaticMarkup(<CardFace def={fuchsDef} />);
      expect(html).toContain('bub-game-card');
      expect(html).toContain('ds-combat-card-game');
      expect(html).toContain('Fuchs');
    });

    it('übernimmt Anki-Notiz-Übersteuerungen (Name, Bild, Werte) ohne Codeänderung', () => {
      const overrideNote: AnkiNote = {
        id: 1,
        guid: 'bub-combat-c53',
        mid: BUB_COMBAT_CARD_NOTETYPE.id,
        did: 1,
        mod: 0,
        usn: -1,
        tags: ['combat', 'drachenspiel'],
        fields: [
          'drachenspiel:c53', // Kennung
          'drachenspiel', // Spiel
          'Begleiter', // Typ
          'Silberfuchs des Nordens', // Name
          '2', // Kosten
          '5', // Angriff
          '4', // Leben
          '1', // Haltbarkeit
          'Kampfschrei: Verleiht Verbündeten Schnelligkeit.', // Text
          '🦊❄️', // Bild
          'gold-ornate', // Rahmen
          '{}', // EffektDatenJSON
        ],
        flags: 0,
        data: '',
      };

      const html = renderToStaticMarkup(
        <CardCosmeticsProvider
          value={{
            cardBack: 'dragon-scale',
            ankiOverrides: {
              c53: overrideNote,
            },
          }}
        >
          <CardFace def={fuchsDef} />
        </CardCosmeticsProvider>,
      );

      expect(html).toContain('Silberfuchs des Nordens');
      expect(html).toContain('🦊❄️');
      expect(html).toContain('bub-game-card');
    });

    it('unterstützt dynamische runtimeFields (AktuellerAngriff, AktuellesLeben)', () => {
      const html = renderToStaticMarkup(
        <CardFace def={fuchsDef} currentAttack={7} currentHealth={9} hint="Gebufft durch Zauber" />,
      );
      expect(html).toContain('7');
      expect(html).toContain('9');
    });
  });

  describe('Narrenhof (Hofkarten & Verdeckte Karten)', () => {
    it('Tile rendert über <GameCard> und übernimmt Hofkarten-Overrides', () => {
      const overrideNote: AnkiNote = {
        id: 2,
        guid: 'bub-court-narrenhof-mod-clown',
        mid: BUB_COURT_CARD_NOTETYPE.id,
        did: 1,
        mod: 0,
        usn: -1,
        tags: ['court', 'narrenhof'],
        fields: [
          'narrenhof:mod-clown', // Kennung
          'narrenhof', // Spiel
          'Narr', // Kategorie
          'Oberster Hofnarr', // Name
          'episch', // Seltenheit
          '8', // Kaufpreis
          '20', // Basiswert
          'x3', // Multiplikator
          'Bei jedem Stich', // Ausloeser
          'Verdreifacht alle Punkte des Narrenhofs.', // Regeltext
          'Ein Narr kommt selten allein!', // Spruch
          '🎭👑', // Bild
          'jester-gold', // Rahmen
          '{}', // EffektDatenJSON
        ],
        flags: 0,
        data: '',
      };

      const html = renderToStaticMarkup(
        <CardCosmeticsProvider
          value={{
            cardBack: 'jester-velvet',
            ankiOverrides: {
              'mod-clown': overrideNote,
            },
          }}
        >
          <Tile
            emoji="🃏"
            title="Narr"
            courtCard={{ id: 'mod-clown', name: 'Narr', category: 'Narr' }}
          />
        </CardCosmeticsProvider>,
      );

      expect(html).toContain('bub-game-card');
      expect(html).toContain('Oberster Hofnarr');
      expect(html).toContain('Verdreifacht alle Punkte des Narrenhofs.');
    });

    it('verdeckte CardView zeigt den persönlichen <CardBack> aus dem Spielerpass', () => {
      const html = renderToStaticMarkup(
        <CardCosmeticsProvider value={{ cardBack: 'jester-velvet' }}>
          <CardView card={{ hidden: true } as any} />
        </CardCosmeticsProvider>,
      );

      expect(html).toContain('bub-game-card--face-down');
      expect(html).toContain('bub-card-back--jester-velvet');
    });
  });

  describe('Quartett (Spezialkarten & Pass-Rücken)', () => {
    const bibelSet = CARD_SETS.bibel;

    it('rendert Standardkarte und übernimmt Anki-Overrides für Quartettkarten', () => {
      const overrideNote: AnkiNote = {
        id: 3,
        guid: 'bub-quartett-bibel-A1',
        mid: BUB_QUARTETT_CARD_NOTETYPE.id,
        did: 1,
        mod: 0,
        usn: -1,
        tags: ['quartett', 'bibel'],
        fields: [
          'bibel:A1', // Kennung
          'Biblische Geschichten', // SetName
          'A', // GruppeCode
          'Schöpfung', // GruppeName
          'Adam im Garten Eden', // Name (überschrieben)
          '🍎🌳', // Bild
          'Alter', '930', 'Jahre', 'true',
          'Söhne & Töchter', '3', '', 'true',
          '', '', '', '',
          '', '', '', '',
          '', '', '', '',
          '', '', '', '',
          '1. Mose 5', // InfoText
          'eden-frame', // Rahmen
          '{}', // EffektDatenJSON
        ],
        flags: 0,
        data: '',
      };

      const html = renderToStaticMarkup(
        <CardCosmeticsProvider
          value={{
            cardBack: 'royal-crest',
            ankiOverrides: {
              'bibel:A1': overrideNote,
            },
          }}
        >
          <QCard set={bibelSet} card="A1" />
        </CardCosmeticsProvider>,
      );

      expect(html).toContain('bub-game-card');
      expect(html).toContain('Adam im Garten Eden');
      expect(html).toContain('🍎🌳');
    });

    it('Quartett-CardBack rendert mit GameCard faceDown und Spielerpass-Rücken', () => {
      const html = renderToStaticMarkup(
        <CardCosmeticsProvider value={{ cardBack: 'tavern-oak' }}>
          <QuartettCardBack count={4} label="4 Karten" />
        </CardCosmeticsProvider>,
      );

      expect(html).toContain('bub-game-card--face-down');
      expect(html).toContain('bub-card-back--tavern-oak');
      expect(html).toContain('4');
    });
  });

  describe('Wölfe im Schafspelz (Rollenkarten & CardBack)', () => {
    it('RoleCard face-down zeigt den persönlichen <CardBack>', () => {
      const html = renderToStaticMarkup(
        <CardCosmeticsProvider value={{ cardBack: 'dragon-scale' }}>
          <RoleCard role="wolf" shown={false} onShow={() => {}} />
        </CardCosmeticsProvider>,
      );

      expect(html).toContain('bub-game-card--face-down');
      expect(html).toContain('bub-card-back--dragon-scale');
      expect(html).toContain('Gedrückt halten: deine Rolle ansehen');
    });

    it('RoleCard face-up übernimmt Rollen-Overrides aus Anki (BUB_COURT_CARD_NOTETYPE)', () => {
      const overrideNote: AnkiNote = {
        id: 4,
        guid: 'bub-court-woelfe-wolf',
        mid: BUB_COURT_CARD_NOTETYPE.id,
        did: 1,
        mod: 0,
        usn: -1,
        tags: ['court', 'woelfe'],
        fields: [
          'woelfe:wolf', // Kennung
          'woelfe', // Spiel
          'Rolle', // Kategorie
          'Schattenwolf der Wälder', // Name
          '', // Seltenheit
          '', // Kaufpreis
          '', // Basiswert
          '', // Multiplikator
          '', // Ausloeser
          'Schleicht lautlos durch die Nacht und wählt das Opfer.', // Regeltext
          '', // Spruch
          '🐺🌑', // Bild
          'dark-frame', // Rahmen
          '{}', // EffektDatenJSON
        ],
        flags: 0,
        data: '',
      };

      const html = renderToStaticMarkup(
        <CardCosmeticsProvider
          value={{
            cardBack: 'dragon-scale',
            ankiOverrides: {
              wolf: overrideNote,
            },
          }}
        >
          <RoleCard role="wolf" shown={true} onShow={() => {}} />
        </CardCosmeticsProvider>,
      );

      expect(html).toContain('bub-game-card');
      expect(html).not.toContain('bub-game-card--face-down');
      expect(html).toContain('Schattenwolf der Wälder');
      expect(html).toContain('Schleicht lautlos durch die Nacht');
    });
  });

  describe('Tiefflug (Zahlenkarten & CardBack)', () => {
    it('verdeckte Karte nutzt faceDown und Spielerpass-Rücken', () => {
      const html = renderToStaticMarkup(
        <CardCosmeticsProvider value={{ cardBack: 'bavarian-gold' }}>
          <LowFlightCard value={null} junior={false} hidden />
        </CardCosmeticsProvider>,
      );

      expect(html).toContain('bub-game-card--face-down');
      expect(html).toContain('bub-card-back--bavarian-gold');
    });

    it('offene Karte nutzt <GameCard> mit Zahlenwert', () => {
      const html = renderToStaticMarkup(
        <LowFlightCard value={7} junior={false} />
      );

      expect(html).toContain('bub-game-card');
      expect(html).not.toContain('bub-game-card--face-down');
      expect(html).toContain('7');
    });
  });
});
