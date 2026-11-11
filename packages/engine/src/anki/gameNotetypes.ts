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

// ---------------------------------------------------------------- Kampfkarte (Drachenspiel)

export const BUB_COMBAT_CARD_NOTETYPE_ID = 1_600_000_002_002;
export const BUB_COMBAT_CARD_NOTETYPE_NAME = 'Brett & Blatt: Kampfkarte';

export const BUB_COMBAT_CARD_FIELDS = [
  'Kennung',
  'Name',
  'Kartenart',
  'Klasse',
  'Seltenheit',
  'Kosten',
  'Angriff',
  'Leben',
  'Stamm',
  'Schluesselwoerter',
  'Regeltext',
  'Spruch',
  'Bild',
  'Rahmen',
  'EffektDatenJSON',
] as const;

export type BubCombatCardFieldName = (typeof BUB_COMBAT_CARD_FIELDS)[number];

const COMBAT_CARD_QFMT = `<div class="bub-card-root bub-combat-card bub-rarity-{{Seltenheit}} bub-class-{{Klasse}} bub-kind-{{Kartenart}}">
  <div class="bub-combat-header">
    <div class="bub-combat-cost" title="Kosten: {{Kosten}} Mana">
      <span class="bub-combat-cost-gem">💎</span>
      <span class="bub-combat-cost-val">{{Kosten}}</span>
    </div>
    <div class="bub-combat-title-bar">
      <div class="bub-combat-name">{{Name}}</div>
      {{#Stamm}}<div class="bub-combat-tribe">{{Stamm}}</div>{{/Stamm}}
    </div>
  </div>

  <div class="bub-combat-media">
    {{#Bild}}
    <div class="bub-combat-image">{{Bild}}</div>
    {{/Bild}}
  </div>

  <div class="bub-combat-body">
    <div class="bub-combat-badges">
      <span class="bub-combat-badge">{{Kartenart}}</span>
      {{#Klasse}}<span class="bub-combat-badge">{{Klasse}}</span>{{/Klasse}}
      {{#Seltenheit}}<span class="bub-combat-badge bub-badge-rarity">{{Seltenheit}}</span>{{/Seltenheit}}
    </div>
    {{#Schluesselwoerter}}
    <div class="bub-combat-keywords">{{Schluesselwoerter}}</div>
    {{/Schluesselwoerter}}
    <div class="bub-combat-rules">{{Regeltext}}</div>
    {{#Spruch}}
    <div class="bub-combat-quote"><em>{{Spruch}}</em></div>
    {{/Spruch}}
  </div>

  <div class="bub-combat-footer">
    {{#Angriff}}
    <div class="bub-combat-stat bub-combat-attack" title="Angriff: {{Angriff}}">
      <span class="bub-combat-stat-icon">⚔️</span>
      <span class="bub-combat-stat-val">{{Angriff}}</span>
    </div>
    {{/Angriff}}
    {{#Leben}}
    <div class="bub-combat-stat bub-combat-health" title="Leben: {{Leben}}">
      <span class="bub-combat-stat-icon">🛡️</span>
      <span class="bub-combat-stat-val">{{Leben}}</span>
    </div>
    {{/Leben}}
  </div>

  {{#SpielHinweis}}
  <div class="bub-card-runtime-hint">{{SpielHinweis}}</div>
  {{/SpielHinweis}}
</div>`;

const COMBAT_CARD_AFMT = `{{FrontSide}}

<hr id=answer>

<div class="bub-card-answer-info">
  <div class="bub-card-answer-title">{{Name}}</div>
  <div class="bub-card-answer-badges">
    <span class="bub-card-badge">Art: {{Kartenart}}</span>
    {{#Klasse}}<span class="bub-card-badge">Klasse: {{Klasse}}</span>{{/Klasse}}
    {{#Seltenheit}}<span class="bub-card-badge">Seltenheit: {{Seltenheit}}</span>{{/Seltenheit}}
    {{#Kosten}}<span class="bub-card-badge">Kosten: {{Kosten}} 💎</span>{{/Kosten}}
    {{#Angriff}}<span class="bub-card-badge">Angriff: {{Angriff}} ⚔️</span>{{/Angriff}}
    {{#Leben}}<span class="bub-card-badge">Leben: {{Leben}} 🛡️</span>{{/Leben}}
    {{#Stamm}}<span class="bub-card-badge">Stamm: {{Stamm}}</span>{{/Stamm}}
  </div>
  {{#Schluesselwoerter}}
  <div class="bub-card-answer-keywords"><strong>Fähigkeiten:</strong> {{Schluesselwoerter}}</div>
  {{/Schluesselwoerter}}
  <div class="bub-card-answer-desc">{{Regeltext}}</div>
  {{#Spruch}}
  <div class="bub-card-answer-quote"><em>{{Spruch}}</em></div>
  {{/Spruch}}
  {{#SpielHinweis}}
  <div class="bub-card-answer-runtime">Hinweis: {{SpielHinweis}}</div>
  {{/SpielHinweis}}
</div>`;

const COMBAT_CARD_CSS = `.card {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #1f2328;
  background-color: #ffffff;
  text-align: center;
  box-sizing: border-box;
}

.bub-combat-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 8px;
  border-radius: 8px;
  background: #fdfefe;
  border: 2px solid #cbd5e1;
  position: relative;
}

.bub-combat-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.bub-combat-cost {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  background: #2563eb;
  color: #ffffff;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.95rem;
  line-height: 1;
}

.bub-combat-cost-gem {
  font-size: 0.85rem;
}

.bub-combat-title-bar {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.bub-combat-name {
  font-size: 0.9rem;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #0f172a;
}

.bub-combat-tribe {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bub-combat-media {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  margin: 4px 0;
  border-radius: 6px;
  background: #f8fafc;
  overflow: hidden;
}

.bub-combat-image {
  font-size: 2.8rem;
  line-height: 1;
}

.bub-combat-image img {
  max-width: 100%;
  max-height: 120px;
  object-fit: contain;
}

.bub-combat-body {
  margin-top: 4px;
  padding: 6px;
  border-radius: 6px;
  background: #f1f5f9;
  text-align: left;
  font-size: 0.78rem;
  line-height: 1.35;
}

.bub-combat-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.bub-combat-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  background: #e2e8f0;
  font-size: 0.68rem;
  font-weight: 700;
}

.bub-combat-keywords {
  font-weight: 700;
  color: #1e3a8a;
  margin-bottom: 3px;
}

.bub-combat-rules {
  color: #1e293b;
  margin-bottom: 4px;
}

.bub-combat-quote {
  color: #64748b;
  font-size: 0.7rem;
  border-top: 1px dashed #cbd5e1;
  padding-top: 3px;
  margin-top: 3px;
}

.bub-combat-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  padding: 0 4px;
}

.bub-combat-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 1rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 6px;
  line-height: 1;
}

.bub-combat-attack {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.bub-combat-health {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
  margin-left: auto;
}

.bub-card-runtime-hint {
  margin-top: 6px;
  padding: 4px 6px;
  background: #eff6ff;
  border-left: 3px solid #2563eb;
  color: #1e40af;
  font-size: 0.72rem;
  font-weight: 600;
  text-align: left;
  border-radius: 2px;
}

.bub-rarity-rare { border-color: #3b82f6; }
.bub-rarity-mythic { border-color: #a855f7; }
.bub-badge-rarity { text-transform: capitalize; }
`;

export const BUB_COMBAT_CARD_NOTETYPE: AnkiNotetype = {
  id: BUB_COMBAT_CARD_NOTETYPE_ID,
  name: BUB_COMBAT_CARD_NOTETYPE_NAME,
  type: 0,
  mod: 0,
  usn: 0,
  sortf: 0,
  did: null,
  flds: BUB_COMBAT_CARD_FIELDS.map((n, i) => field(n, i)),
  tmpls: [template('Kampfkarte', 0, COMBAT_CARD_QFMT, COMBAT_CARD_AFMT)],
  css: COMBAT_CARD_CSS,
  latexPre:
    '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
  latexPost: '\\end{document}',
  req: [[0, 'all', [0]]],
  vers: [],
  tags: ['kampfkarte', 'drachenspiel', 'brett-und-blatt'],
};

// ---------------------------------------------------------------- Hof- & Rollenkarte (Narrenhof, Wölfe im Schafspelz)

export const BUB_COURT_CARD_NOTETYPE_ID = 1_600_000_002_003;
export const BUB_COURT_CARD_NOTETYPE_NAME = 'Brett & Blatt: Hof- & Rollenkarte';

export const BUB_COURT_CARD_FIELDS = [
  'Kennung',
  'Spiel',
  'Kategorie',
  'Name',
  'Seltenheit',
  'Kaufpreis',
  'Basiswert',
  'Multiplikator',
  'Ausloeser',
  'Regeltext',
  'Spruch',
  'Bild',
  'Rahmen',
  'EffektDatenJSON',
] as const;

export type BubCourtCardFieldName = (typeof BUB_COURT_CARD_FIELDS)[number];

const COURT_CARD_QFMT = `<div class="bub-card-root bub-court-card bub-game-{{Spiel}} bub-cat-{{Kategorie}} bub-rarity-{{Seltenheit}}">
  <div class="bub-court-header">
    <div class="bub-court-badges">
      <span class="bub-court-badge bub-court-game">{{Spiel}}</span>
      <span class="bub-court-badge bub-court-cat">{{Kategorie}}</span>
      {{#Seltenheit}}<span class="bub-court-badge bub-court-rarity">{{Seltenheit}}</span>{{/Seltenheit}}
    </div>
    {{#Kaufpreis}}
    <div class="bub-court-price" title="Kaufpreis: {{Kaufpreis}} Brezeln">
      <span>{{Kaufpreis}}</span> <span class="bub-court-currency">🥨</span>
    </div>
    {{/Kaufpreis}}
  </div>

  <div class="bub-court-media">
    {{#Bild}}
    <div class="bub-court-image">{{Bild}}</div>
    {{/Bild}}
  </div>

  <div class="bub-court-title-area">
    <div class="bub-court-name">{{Name}}</div>
  </div>

  <div class="bub-court-body">
    {{#Ausloeser}}
    <div class="bub-court-trigger">[{{Ausloeser}}]</div>
    {{/Ausloeser}}
    <div class="bub-court-rules">{{Regeltext}}</div>
    {{#Spruch}}
    <div class="bub-court-quote"><em>{{Spruch}}</em></div>
    {{/Spruch}}
  </div>

  {{#Basiswert}}
  <div class="bub-court-stats">
    <span class="bub-court-stat-item">Basis: +{{Basiswert}}</span>
    {{#Multiplikator}}<span class="bub-court-stat-item">Mult: ×{{Multiplikator}}</span>{{/Multiplikator}}
  </div>
  {{/Basiswert}}
  {{^Basiswert}}
  {{#Multiplikator}}
  <div class="bub-court-stats">
    <span class="bub-court-stat-item">Mult: ×{{Multiplikator}}</span>
  </div>
  {{/Multiplikator}}
  {{/Basiswert}}

  {{#SpielHinweis}}
  <div class="bub-card-runtime-hint">{{SpielHinweis}}</div>
  {{/SpielHinweis}}
</div>`;

const COURT_CARD_AFMT = `{{FrontSide}}

<hr id=answer>

<div class="bub-card-answer-info">
  <div class="bub-card-answer-title">{{Name}}</div>
  <div class="bub-card-answer-badges">
    <span class="bub-card-badge">Spiel: {{Spiel}}</span>
    <span class="bub-card-badge">Kategorie: {{Kategorie}}</span>
    {{#Seltenheit}}<span class="bub-card-badge">Seltenheit: {{Seltenheit}}</span>{{/Seltenheit}}
    {{#Kaufpreis}}<span class="bub-card-badge">Preis: {{Kaufpreis}} 🥨</span>{{/Kaufpreis}}
    {{#Basiswert}}<span class="bub-card-badge">Basis: +{{Basiswert}}</span>{{/Basiswert}}
    {{#Multiplikator}}<span class="bub-card-badge">Mult: ×{{Multiplikator}}</span>{{/Multiplikator}}
    {{#Ausloeser}}<span class="bub-card-badge">Auslöser: {{Ausloeser}}</span>{{/Ausloeser}}
  </div>
  <div class="bub-card-answer-desc">{{Regeltext}}</div>
  {{#Spruch}}
  <div class="bub-card-answer-quote"><em>{{Spruch}}</em></div>
  {{/Spruch}}
  {{#SpielHinweis}}
  <div class="bub-card-answer-runtime">Hinweis: {{SpielHinweis}}</div>
  {{/SpielHinweis}}
</div>`;

const COURT_CARD_CSS = `.card {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #1f2328;
  background-color: #ffffff;
  text-align: center;
  box-sizing: border-box;
}

.bub-court-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 8px;
  border-radius: 8px;
  background: #fffdfa;
  border: 2px solid #e2e8f0;
  position: relative;
}

.bub-court-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.bub-court-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.bub-court-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: capitalize;
}

.bub-court-game { background: #e0e7ff; color: #3730a3; }
.bub-court-cat { background: #fef3c7; color: #92400e; }
.bub-court-rarity { background: #fae8ff; color: #86198f; }

.bub-court-price {
  font-weight: 800;
  font-size: 0.9rem;
  color: #b45309;
}

.bub-court-media {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70px;
  margin: 4px 0;
}

.bub-court-image {
  font-size: 2.8rem;
  line-height: 1;
}

.bub-court-image img {
  max-width: 100%;
  max-height: 110px;
  object-fit: contain;
}

.bub-court-title-area {
  margin: 4px 0;
}

.bub-court-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
}

.bub-court-body {
  padding: 6px;
  border-radius: 6px;
  background: #f8fafc;
  text-align: left;
  font-size: 0.78rem;
  line-height: 1.35;
}

.bub-court-trigger {
  font-size: 0.68rem;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 2px;
}

.bub-court-rules {
  color: #1e293b;
}

.bub-court-quote {
  color: #64748b;
  font-size: 0.7rem;
  border-top: 1px dashed #cbd5e1;
  padding-top: 3px;
  margin-top: 4px;
}

.bub-court-stats {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background: #ecfdf5;
  color: #065f46;
  font-weight: 700;
  font-size: 0.82rem;
}
`;

export const BUB_COURT_CARD_NOTETYPE: AnkiNotetype = {
  id: BUB_COURT_CARD_NOTETYPE_ID,
  name: BUB_COURT_CARD_NOTETYPE_NAME,
  type: 0,
  mod: 0,
  usn: 0,
  sortf: 0,
  did: null,
  flds: BUB_COURT_CARD_FIELDS.map((n, i) => field(n, i)),
  tmpls: [template('Hof- & Rollenkarte', 0, COURT_CARD_QFMT, COURT_CARD_AFMT)],
  css: COURT_CARD_CSS,
  latexPre:
    '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
  latexPost: '\\end{document}',
  req: [[0, 'all', [0]]],
  vers: [],
  tags: ['hofkarte', 'narrenhof', 'woelfe', 'brett-und-blatt'],
};

// ---------------------------------------------------------------- Quartettkarte (Quartett-Sets)

export const BUB_QUARTETT_CARD_NOTETYPE_ID = 1_600_000_002_004;
export const BUB_QUARTETT_CARD_NOTETYPE_NAME = 'Brett & Blatt: Quartettkarte';

export const BUB_QUARTETT_CARD_FIELDS = [
  'Kennung',
  'SetName',
  'GruppeCode',
  'GruppeName',
  'Name',
  'Bild',
  'Wert1_Name',
  'Wert1_Zahl',
  'Wert1_Einheit',
  'Wert1_HoeherGewinnt',
  'Wert2_Name',
  'Wert2_Zahl',
  'Wert2_Einheit',
  'Wert2_HoeherGewinnt',
  'Wert3_Name',
  'Wert3_Zahl',
  'Wert3_Einheit',
  'Wert3_HoeherGewinnt',
  'Wert4_Name',
  'Wert4_Zahl',
  'Wert4_Einheit',
  'Wert4_HoeherGewinnt',
  'Wert5_Name',
  'Wert5_Zahl',
  'Wert5_Einheit',
  'Wert5_HoeherGewinnt',
  'Wert6_Name',
  'Wert6_Zahl',
  'Wert6_Einheit',
  'Wert6_HoeherGewinnt',
  'InfoText',
  'Rahmen',
  'EffektDatenJSON',
] as const;

export type BubQuartettCardFieldName = (typeof BUB_QUARTETT_CARD_FIELDS)[number];

const QUARTETT_CARD_QFMT = `<div class="bub-card-root bub-quartett-card">
  <div class="bub-quartett-header">
    <div class="bub-quartett-code-badge">{{GruppeCode}}</div>
    <div class="bub-quartett-group-title">
      <div class="bub-quartett-group-name">{{GruppeName}}</div>
      <div class="bub-quartett-set-name">{{SetName}}</div>
    </div>
  </div>

  <div class="bub-quartett-media">
    {{#Bild}}
    <div class="bub-quartett-image">{{Bild}}</div>
    {{/Bild}}
    <div class="bub-quartett-title">{{Name}}</div>
  </div>

  <div class="bub-quartett-table">
    {{#Wert1_Name}}
    <div class="bub-quartett-row">
      <span class="bub-quartett-row-name">{{Wert1_Name}}</span>
      <span class="bub-quartett-row-val">{{Wert1_Zahl}} {{Wert1_Einheit}}</span>
    </div>
    {{/Wert1_Name}}
    {{#Wert2_Name}}
    <div class="bub-quartett-row">
      <span class="bub-quartett-row-name">{{Wert2_Name}}</span>
      <span class="bub-quartett-row-val">{{Wert2_Zahl}} {{Wert2_Einheit}}</span>
    </div>
    {{/Wert2_Name}}
    {{#Wert3_Name}}
    <div class="bub-quartett-row">
      <span class="bub-quartett-row-name">{{Wert3_Name}}</span>
      <span class="bub-quartett-row-val">{{Wert3_Zahl}} {{Wert3_Einheit}}</span>
    </div>
    {{/Wert3_Name}}
    {{#Wert4_Name}}
    <div class="bub-quartett-row">
      <span class="bub-quartett-row-name">{{Wert4_Name}}</span>
      <span class="bub-quartett-row-val">{{Wert4_Zahl}} {{Wert4_Einheit}}</span>
    </div>
    {{/Wert4_Name}}
    {{#Wert5_Name}}
    <div class="bub-quartett-row">
      <span class="bub-quartett-row-name">{{Wert5_Name}}</span>
      <span class="bub-quartett-row-val">{{Wert5_Zahl}} {{Wert5_Einheit}}</span>
    </div>
    {{/Wert5_Name}}
    {{#Wert6_Name}}
    <div class="bub-quartett-row">
      <span class="bub-quartett-row-name">{{Wert6_Name}}</span>
      <span class="bub-quartett-row-val">{{Wert6_Zahl}} {{Wert6_Einheit}}</span>
    </div>
    {{/Wert6_Name}}
  </div>

  {{#InfoText}}
  <div class="bub-quartett-info">{{InfoText}}</div>
  {{/InfoText}}

  {{#SpielHinweis}}
  <div class="bub-card-runtime-hint">{{SpielHinweis}}</div>
  {{/SpielHinweis}}
</div>`;

const QUARTETT_CARD_AFMT = `{{FrontSide}}

<hr id=answer>

<div class="bub-card-answer-info">
  <div class="bub-card-answer-title">{{GruppeCode}}: {{Name}}</div>
  <div class="bub-card-answer-badges">
    <span class="bub-card-badge">Set: {{SetName}}</span>
    <span class="bub-card-badge">Gruppe: {{GruppeName}} ({{GruppeCode}})</span>
  </div>
  {{#InfoText}}
  <div class="bub-card-answer-desc">{{InfoText}}</div>
  {{/InfoText}}
  {{#SpielHinweis}}
  <div class="bub-card-answer-runtime">Hinweis: {{SpielHinweis}}</div>
  {{/SpielHinweis}}
</div>`;

const QUARTETT_CARD_CSS = `.card {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #1f2328;
  background-color: #ffffff;
  text-align: center;
  box-sizing: border-box;
}

.bub-quartett-card {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 8px;
  border-radius: 8px;
  background: #ffffff;
  border: 2px solid #cbd5e1;
  position: relative;
}

.bub-quartett-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.bub-quartett-code-badge {
  font-size: 1.1rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 6px;
  background: #0284c7;
  color: #ffffff;
  line-height: 1.1;
}

.bub-quartett-group-title {
  text-align: left;
  flex: 1;
  min-width: 0;
}

.bub-quartett-group-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bub-quartett-set-name {
  font-size: 0.68rem;
  color: #64748b;
}

.bub-quartett-media {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 4px 0 6px 0;
}

.bub-quartett-image {
  font-size: 2.6rem;
  line-height: 1;
}

.bub-quartett-image img {
  max-width: 100%;
  max-height: 100px;
  object-fit: contain;
}

.bub-quartett-title {
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
  margin-top: 2px;
}

.bub-quartett-table {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  font-size: 0.76rem;
  margin-bottom: 4px;
}

.bub-quartett-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 8px;
  border-bottom: 1px solid #f1f5f9;
}

.bub-quartett-row:last-child {
  border-bottom: none;
}

.bub-quartett-row:nth-child(even) {
  background: #f8fafc;
}

.bub-quartett-row-name {
  font-weight: 600;
  color: #475569;
  text-align: left;
}

.bub-quartett-row-val {
  font-weight: 700;
  color: #0f172a;
  text-align: right;
}

.bub-quartett-info {
  font-size: 0.7rem;
  color: #64748b;
  text-align: left;
  line-height: 1.3;
  margin-top: 4px;
  padding: 4px 6px;
  background: #f8fafc;
  border-radius: 4px;
}
`;

export const BUB_QUARTETT_CARD_NOTETYPE: AnkiNotetype = {
  id: BUB_QUARTETT_CARD_NOTETYPE_ID,
  name: BUB_QUARTETT_CARD_NOTETYPE_NAME,
  type: 0,
  mod: 0,
  usn: 0,
  sortf: 0,
  did: null,
  flds: BUB_QUARTETT_CARD_FIELDS.map((n, i) => field(n, i)),
  tmpls: [template('Quartettkarte', 0, QUARTETT_CARD_QFMT, QUARTETT_CARD_AFMT)],
  css: QUARTETT_CARD_CSS,
  latexPre:
    '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
  latexPost: '\\end{document}',
  req: [[0, 'all', [0]]],
  vers: [],
  tags: ['quartett', 'quartettkarte', 'brett-und-blatt'],
};

/** Alle offiziellen Kartenschemata von Brett & Blatt. */
export const ALL_BUB_NOTETYPES: readonly AnkiNotetype[] = [
  BUB_PLAYING_CARD_NOTETYPE,
  BUB_COMBAT_CARD_NOTETYPE,
  BUB_COURT_CARD_NOTETYPE,
  BUB_QUARTETT_CARD_NOTETYPE,
];


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
