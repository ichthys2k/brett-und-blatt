import { idFromSeed } from './ids';
import { defaultDeck } from './stock';
import type { AnkiCollection, AnkiDeck, AnkiNotetype, AnkiNote } from './types';

/*
 * Das offizielle Kartenschema „Brett & Blatt: Spielblatt“ (Vorhaben #270, Schritt K3).
 * Definiert den Standard-Anki-Notiztyp für klassische französische und bayerische
 * Spielkarten mit Unterstützung für dynamische Laufzeit-Hinweise, alternative Rahmen
 * und 100 % Kompatibilität mit dem Anki-Export (.apkg).
 */

export const BUB_PLAYING_CARD_NOTETYPE_ID = 1_600_000_002_001;
export const BUB_PLAYING_CARD_NOTETYPE_NAME = 'Brett & Blatt: Spielblatt';

export const BUB_PLAYING_CARD_FIELDS = [
  'Kennung',
  'Blatt',
  'Farbe',
  'Rang',
  'Name',
  'Eckzeichen',
  'FarbSymbol',
  'Bild',
  'Rahmen',
  'PunkteStandard',
  'BeschreibungStandard',
] as const;

export type BubPlayingCardFieldName = (typeof BUB_PLAYING_CARD_FIELDS)[number];

const PLAYING_CARD_QFMT = `<div class="bub-playing-card bub-sheet-{{Blatt}} bub-suit-{{Farbe}}">
  <div class="bub-card-inner">
    <div class="bub-card-corner bub-card-corner-top">
      <span class="bub-card-rank">{{Eckzeichen}}</span>
      <span class="bub-card-suit-icon">{{FarbSymbol}}</span>
    </div>

    <div class="bub-card-center">
      {{#Bild}}
      <div class="bub-card-image">{{Bild}}</div>
      {{/Bild}}
      {{^Bild}}
      <div class="bub-card-center-symbol">{{FarbSymbol}}</div>
      {{/Bild}}
      <div class="bub-card-title">{{Name}}</div>
    </div>

    <div class="bub-card-corner bub-card-corner-bottom">
      <span class="bub-card-rank">{{Eckzeichen}}</span>
      <span class="bub-card-suit-icon">{{FarbSymbol}}</span>
    </div>
  </div>

  <div class="bub-card-desc">
    {{#SpielHinweis}}{{SpielHinweis}}{{/SpielHinweis}}{{^SpielHinweis}}{{BeschreibungStandard}}{{/SpielHinweis}}
  </div>
</div>`;

const PLAYING_CARD_AFMT = `{{FrontSide}}

<hr id=answer>

<div class="bub-card-answer-info">
  <div class="bub-card-answer-title">{{Name}}</div>
  <div class="bub-card-answer-badges">
    <span class="bub-card-badge">Blatt: {{Blatt}}</span>
    <span class="bub-card-badge">Farbe: {{Farbe}}</span>
    <span class="bub-card-badge">Rang: {{Rang}}</span>
    <span class="bub-card-badge">Punkte: {{PunkteStandard}} Augen</span>
  </div>
  <div class="bub-card-answer-desc">{{BeschreibungStandard}}</div>
  {{#SpielHinweis}}
  <div class="bub-card-answer-runtime">Hinweis: {{SpielHinweis}}</div>
  {{/SpielHinweis}}
</div>`;

const PLAYING_CARD_CSS = `.card {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #1f2328;
  background-color: #ffffff;
  text-align: center;
  box-sizing: border-box;
}

.bub-playing-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 6px;
  border-radius: 6px;
  background: #ffffff;
}

.bub-card-inner {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  position: relative;
}

.bub-card-corner {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
  font-weight: 800;
  font-size: 0.95rem;
  width: 1.4rem;
  user-select: none;
}

.bub-card-corner-top {
  align-self: flex-start;
}

.bub-card-corner-bottom {
  align-self: flex-end;
  transform: rotate(180deg);
}

.bub-card-suit-icon {
  font-size: 0.85rem;
  margin-top: 1px;
}

.bub-card-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
  padding: 2px 4px;
}

.bub-card-center-symbol {
  font-size: 2.2rem;
  line-height: 1;
}

.bub-card-image {
  max-width: 100%;
  max-height: 80%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bub-card-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.bub-card-title {
  font-size: 0.72rem;
  font-weight: 700;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.bub-card-desc {
  font-size: 0.65rem;
  line-height: 1.2;
  text-align: center;
  padding: 2px 4px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.04);
  max-height: 30%;
  overflow-y: auto;
  margin-top: 4px;
}

/* Farben nach Blatt und Symbol */
.bub-suit-hearts, .bub-suit-diamonds, .bub-suit-herz { color: #c62828; }
.bub-suit-spades, .bub-suit-clubs, .bub-suit-pik, .bub-suit-kreuz { color: #1f2328; }
.bub-suit-schellen { color: #d97706; }
.bub-suit-gras, .bub-suit-gruen { color: #2e7d32; }
.bub-suit-eichel { color: #5d4037; }

/* Antwort-Bereich (Anki-Rückseite) */
.bub-card-answer-info {
  text-align: left;
  padding: 8px 4px;
  font-size: 0.85rem;
  line-height: 1.4;
}
.bub-card-answer-title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 6px;
}
.bub-card-answer-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.bub-card-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  font-size: 0.72rem;
  font-weight: 600;
}
.bub-card-answer-desc {
  color: #475569;
  margin-top: 4px;
}
.bub-card-answer-runtime {
  margin-top: 6px;
  padding: 4px 8px;
  background: #eff6ff;
  border-left: 3px solid #2563eb;
  color: #1e40af;
  font-weight: 600;
  border-radius: 2px;
}
`;

const field = (name: string, ord: number) => ({
  name,
  ord,
  sticky: false,
  rtl: false,
  font: 'Arial',
  size: 20,
  description: '',
  plainText: false,
  collapsed: false,
  excludeFromSearch: false,
});

const template = (name: string, ord: number, qfmt: string, afmt: string) => ({
  name,
  ord,
  qfmt,
  afmt,
  bqfmt: '',
  bafmt: '',
  did: null,
  bfont: '',
  bsize: 0,
});

export const BUB_PLAYING_CARD_NOTETYPE: AnkiNotetype = {
  id: BUB_PLAYING_CARD_NOTETYPE_ID,
  name: BUB_PLAYING_CARD_NOTETYPE_NAME,
  type: 0,
  mod: 0,
  usn: 0,
  sortf: 0,
  did: null,
  flds: BUB_PLAYING_CARD_FIELDS.map((n, i) => field(n, i)),
  tmpls: [template('Spielkarte', 0, PLAYING_CARD_QFMT, PLAYING_CARD_AFMT)],
  css: PLAYING_CARD_CSS,
  latexPre:
    '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
  latexPost: '\\end{document}',
  req: [[0, 'all', [0]]],
  vers: [],
  tags: ['spielblatt', 'brett-und-blatt'],
};

// ---------------------------------------------------------------- Spielblatt-Generator

export interface CreatePlayingCardCollectionOptions {
  /**
   * Welches Blatt erzeugt werden soll:
   * - 'all': Französisches Blatt (52 Karten) und Bayerisches Blatt (32 Karten) in Unterstapeln (Standard)
   * - 'french-52': Nur Französisches Blatt (52 Karten)
   * - 'french-32': Nur Französisches Blatt (32 Karten: 7–Ass)
   * - 'bavarian-32': Nur Bayerisches Blatt (32 Karten: 7–Sau)
   */
  deck?: 'all' | 'french-52' | 'french-32' | 'bavarian-32';
  /** Basis-Zeitstempel (Standard: 1_700_000_000_000). */
  now?: number;
}

interface CardSpec {
  kennung: string;
  guid: string;
  blatt: 'franzoesisch' | 'bayerisch';
  farbe: string;
  rang: string;
  name: string;
  eckzeichen: string;
  farbSymbol: string;
  punkte: string;
  beschreibung: string;
}

const FRENCH_SUITS = [
  { key: 'hearts', name: 'Herz', symbol: '♥' },
  { key: 'diamonds', name: 'Karo', symbol: '♦' },
  { key: 'clubs', name: 'Kreuz', symbol: '♣' },
  { key: 'spades', name: 'Pik', symbol: '♠' },
] as const;

const FRENCH_RANKS_52 = [
  { key: 'A', label: 'A', name: 'Ass', points: '11', desc: 'Höchste Farbkarte, zählt 11 Augen.' },
  { key: 'K', label: 'K', name: 'König', points: '4', desc: 'Hofkarte, zählt 4 Augen.' },
  { key: 'D', label: 'D', name: 'Dame', points: '3', desc: 'Hofkarte, zählt 3 Augen.' },
  { key: 'B', label: 'B', name: 'Bube', points: '2', desc: 'Hofkarte, zählt 2 Augen.' },
  { key: '10', label: '10', name: '10', points: '10', desc: 'Zählt 10 Augen.' },
  { key: '9', label: '9', name: '9', points: '0', desc: 'Zählt 0 Augen (Lusche).' },
  { key: '8', label: '8', name: '8', points: '0', desc: 'Zählt 0 Augen (Lusche).' },
  { key: '7', label: '7', name: '7', points: '0', desc: 'Zählt 0 Augen (Lusche).' },
  { key: '6', label: '6', name: '6', points: '0', desc: 'Zählt 0 Augen.' },
  { key: '5', label: '5', name: '5', points: '0', desc: 'Zählt 0 Augen.' },
  { key: '4', label: '4', name: '4', points: '0', desc: 'Zählt 0 Augen.' },
  { key: '3', label: '3', name: '3', points: '0', desc: 'Zählt 0 Augen.' },
  { key: '2', label: '2', name: '2', points: '0', desc: 'Zählt 0 Augen.' },
] as const;

const BAVARIAN_SUITS = [
  { key: 'eichel', name: 'Eichel', symbol: '🌰' },
  { key: 'gras', name: 'Gras', symbol: '🍃' },
  { key: 'herz', name: 'Herz', symbol: '♥' },
  { key: 'schellen', name: 'Schellen', symbol: '🔔' },
] as const;

const BAVARIAN_RANKS = [
  { key: 'A', label: 'A', name: 'Sau', points: '11', desc: 'Höchste Farbkarte (Sau/Daus), zählt 11 Augen.' },
  { key: 'K', label: 'K', name: 'König', points: '4', desc: 'Hofkarte, zählt 4 Augen.' },
  { key: 'O', label: 'O', name: 'Ober', points: '3', desc: 'Hofkarte (Ober), zählt 3 Augen.' },
  { key: 'U', label: 'U', name: 'Unter', points: '2', desc: 'Hofkarte (Unter), zählt 2 Augen.' },
  { key: '10', label: '10', name: '10', points: '10', desc: 'Zählt 10 Augen.' },
  { key: '9', label: '9', name: '9', points: '0', desc: 'Zählt 0 Augen (Spatz/Lusche).' },
  { key: '8', label: '8', name: '8', points: '0', desc: 'Zählt 0 Augen (Spatz/Lusche).' },
  { key: '7', label: '7', name: '7', points: '0', desc: 'Zählt 0 Augen (Spatz/Lusche).' },
] as const;

function generateFrenchCardSpecs(count: 32 | 52): CardSpec[] {
  const ranks = count === 32 ? FRENCH_RANKS_52.slice(0, 8) : FRENCH_RANKS_52;
  const cards: CardSpec[] = [];
  for (const suit of FRENCH_SUITS) {
    for (const rank of ranks) {
      cards.push({
        kennung: `fr:${suit.key}-${rank.key}`,
        guid: `bub-card-fr-${suit.key}-${rank.key}`,
        blatt: 'franzoesisch',
        farbe: suit.key,
        rang: rank.key,
        name: `${suit.name}-${rank.name}`,
        eckzeichen: rank.label,
        farbSymbol: suit.symbol,
        punkte: rank.points,
        beschreibung: rank.desc,
      });
    }
  }
  return cards;
}

function generateBavarianCardSpecs(): CardSpec[] {
  const cards: CardSpec[] = [];
  for (const suit of BAVARIAN_SUITS) {
    for (const rank of BAVARIAN_RANKS) {
      cards.push({
        kennung: `by:${suit.key}-${rank.key}`,
        guid: `bub-card-by-${suit.key}-${rank.key}`,
        blatt: 'bayerisch',
        farbe: suit.key,
        rang: rank.key,
        name: `${suit.name}-${rank.name}`,
        eckzeichen: rank.label,
        farbSymbol: suit.symbol,
        punkte: rank.points,
        beschreibung: rank.desc,
      });
    }
  }
  return cards;
}

/**
 * Erzeugt eine vollständige AnkiCollection für das klassische Spielblatt mit
 * deterministischen guids (bub-card-fr-hearts-A usw.), die sich direkt mit
 * exportApkg als .apkg für Anki exportieren lässt.
 */
export function createPlayingCardCollection(options: CreatePlayingCardCollectionOptions = {}): AnkiCollection {
  const mode = options.deck ?? 'all';
  const now = options.now ?? 1_700_000_000_000;
  const sec = Math.floor(now / 1000);

  const rootDeck: AnkiDeck = {
    id: idFromSeed('deck:bub:spielblatt:root'),
    name: 'Brett & Blatt::Klassisches Spielblatt',
    mod: sec,
  };

  const frenchDeck: AnkiDeck = {
    id: idFromSeed('deck:bub:spielblatt:french'),
    name: 'Brett & Blatt::Klassisches Spielblatt::Französisches Blatt',
    mod: sec,
  };

  const bavarianDeck: AnkiDeck = {
    id: idFromSeed('deck:bub:spielblatt:bavarian'),
    name: 'Brett & Blatt::Klassisches Spielblatt::Bayerisches Blatt',
    mod: sec,
  };

  const decks: AnkiDeck[] = [defaultDeck(), rootDeck];
  const notes: AnkiNote[] = [];

  const addCards = (specs: CardSpec[], deckId: number) => {
    for (const spec of specs) {
      notes.push({
        id: idFromSeed(spec.guid),
        guid: spec.guid,
        mid: BUB_PLAYING_CARD_NOTETYPE_ID,
        did: deckId,
        mod: sec,
        tags: ['spielblatt', spec.blatt, spec.farbe],
        fields: [
          spec.kennung,
          spec.blatt,
          spec.farbe,
          spec.rang,
          spec.name,
          spec.eckzeichen,
          spec.farbSymbol,
          '', // Bild
          '', // Rahmen
          spec.punkte,
          spec.beschreibung,
        ],
      });
    }
  };

  if (mode === 'all' || mode === 'french-52') {
    decks.push(frenchDeck);
    addCards(generateFrenchCardSpecs(52), frenchDeck.id);
  } else if (mode === 'french-32') {
    decks.push(frenchDeck);
    addCards(generateFrenchCardSpecs(32), frenchDeck.id);
  }

  if (mode === 'all' || mode === 'bavarian-32') {
    decks.push(bavarianDeck);
    addCards(generateBavarianCardSpecs(), bavarianDeck.id);
  }

  return {
    v: 2,
    notetypes: [BUB_PLAYING_CARD_NOTETYPE],
    decks,
    notes,
    graves: [],
  };
}
