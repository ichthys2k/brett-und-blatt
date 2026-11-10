import type { AnkiDeck, AnkiNotetype } from './types';

/*
 * Die eingebauten Notiztypen, wie Anki sie anlegt (deutsche Namen, „Einfach“ = Basic). Die Kennungen sind fest, damit dieselben
 * Typen auf allen Geräten und in allen Sammlungen dieselbe Kennung tragen.
 */

export const STOCK_BASIC_ID = 1_600_000_000_001;
export const STOCK_REVERSED_ID = 1_600_000_000_002;
export const STOCK_OPTIONAL_REVERSED_ID = 1_600_000_000_003;
export const STOCK_TYPING_ID = 1_600_000_000_004;
export const STOCK_CLOZE_ID = 1_600_000_000_005;
export const DEFAULT_DECK_ID = 1;

const CSS = `.card {
  font-family: arial;
  font-size: 20px;
  text-align: center;
  color: black;
  background-color: white;
}
`;
const CLOZE_CSS = `${CSS}
.cloze {
  font-weight: bold;
  color: blue;
}
.nightMode .cloze {
  color: lightblue;
}
`;
const HR = '{{FrontSide}}\n\n<hr id=answer>\n\n';

const field = (name: string, ord: number) => ({ name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, description: '', plainText: false, collapsed: false, excludeFromSearch: false });
const template = (name: string, ord: number, qfmt: string, afmt: string) => ({ name, ord, qfmt, afmt, bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 });
const type = (id: number, name: string, kind: 0 | 1, fields: string[], templates: ReturnType<typeof template>[], req: AnkiNotetype['req'], css = CSS): AnkiNotetype => ({
  id,
  name,
  type: kind,
  mod: 0,
  usn: 0,
  sortf: 0,
  did: null,
  flds: fields.map((n, i) => field(n, i)),
  tmpls: templates,
  css,
  latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
  latexPost: '\\end{document}',
  req,
  vers: [],
  tags: [],
});

/** Alle eingebauten Notiztypen. */
export function stockNotetypes(): AnkiNotetype[] {
  return [
    type(STOCK_BASIC_ID, 'Einfach', 0, ['Vorderseite', 'Rückseite'], [template('Karte 1', 0, '{{Vorderseite}}', `${HR}{{Rückseite}}`)], [[0, 'any', [0]]]),
    type(
      STOCK_REVERSED_ID,
      'Einfach (und umgekehrte Karte)',
      0,
      ['Vorderseite', 'Rückseite'],
      [template('Karte 1', 0, '{{Vorderseite}}', `${HR}{{Rückseite}}`), template('Karte 2', 1, '{{Rückseite}}', `${HR}{{Vorderseite}}`)],
      [
        [0, 'any', [0]],
        [1, 'any', [1]],
      ],
    ),
    type(
      STOCK_OPTIONAL_REVERSED_ID,
      'Einfach (optionale umgekehrte Karte)',
      0,
      ['Vorderseite', 'Rückseite', 'Umgekehrte Karte hinzufügen'],
      [template('Karte 1', 0, '{{Vorderseite}}', `${HR}{{Rückseite}}`), template('Karte 2', 1, '{{#Umgekehrte Karte hinzufügen}}{{Rückseite}}{{/Umgekehrte Karte hinzufügen}}', `${HR}{{Vorderseite}}`)],
      [
        [0, 'any', [0]],
        [1, 'all', [1, 2]],
      ],
    ),
    type(STOCK_TYPING_ID, 'Einfach (Antwort eintippen)', 0, ['Vorderseite', 'Rückseite'], [template('Karte 1', 0, '{{Vorderseite}}\n\n{{type:Rückseite}}', `{{Vorderseite}}\n\n<hr id=answer>\n\n{{type:Rückseite}}`)], [[0, 'any', [0]]]),
    type(STOCK_CLOZE_ID, 'Lückentext', 1, ['Text', 'Zusatzinfo'], [template('Lückentext', 0, '{{cloze:Text}}', '{{cloze:Text}}<br>\n{{Zusatzinfo}}')], [], CLOZE_CSS),
  ];
}

export const defaultDeck = (): AnkiDeck => ({ id: DEFAULT_DECK_ID, name: 'Standard', mod: 0, usn: 0, desc: '', collapsed: false, dyn: 0, conf: 1 });
