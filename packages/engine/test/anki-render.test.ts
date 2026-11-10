import { describe, expect, it } from 'vitest';
import {
  CARD_SCOPE,
  DEFAULT_DECK_ID,
  STOCK_BASIC_ID,
  STOCK_CLOZE_ID,
  STOCK_TYPING_ID,
  addNote,
  cardOrds,
  clozeField,
  emptyCollection,
  notetypeOf,
  previewCards,
  renderCard,
  sanitizeHtml,
  scopeCss,
  typeAnswerHtml,
  type AnkiCollection,
  type AnkiNote,
} from '../src';

const media = (name: string) => (name === 'katze.jpg' || name === 'miau.mp3' ? `blob:${name}` : null);
const note = (col: AnkiCollection, notetypeId: number, fields: string[], tags: string[] = []): { col: AnkiCollection; note: AnkiNote } => addNote(col, { notetypeId, deckId: DEFAULT_DECK_ID, fields, tags }, 1_700_000_000_000);
const plainText = (html: string) => html.replace(/<[^>]+>/g, '');

describe('Anki-Renderer: Vorlagen', () => {
  const withTemplate = (qfmt: string, afmt: string, fields = ['Vorderseite', 'Rückseite']) => {
    const col = emptyCollection();
    const nt = notetypeOf(col, STOCK_BASIC_ID)!;
    const custom = { ...nt, flds: fields.map((name, ord) => ({ ...nt.flds[0]!, name, ord })), tmpls: [{ ...nt.tmpls[0]!, qfmt, afmt }], req: [[0, 'any', [0]] as [number, 'any', number[]]] };
    return { ...col, notetypes: col.notetypes.map((t) => (t.id === STOCK_BASIC_ID ? custom : t)) };
  };
  it('Standardvorlage: Vorderseite, Trennlinie, Rückseite; FrontSide nur hinten', () => {
    const base = emptyCollection();
    const { col, note: n } = note(base, STOCK_BASIC_ID, ['Haus', '<b>house</b>']);
    const card = renderCard(col, n, 0);
    expect(card.question).toBe('Haus');
    expect(card.answer).toContain('Haus');
    expect(card.answer).toContain('<hr id="bub-answer">');
    expect(card.answer).toContain('<b>house</b>');
    expect(card.errors).toEqual([]);
  });
  it('bedingte Abschnitte: {{#Feld}} nur mit Inhalt, {{^Feld}} nur ohne', () => {
    const col = withTemplate('{{Vorderseite}}{{#Rückseite}} (mit: {{Rückseite}}){{/Rückseite}}{{^Rückseite}} (ohne){{/Rückseite}}', '{{FrontSide}}');
    expect(renderCard(col, note(col, STOCK_BASIC_ID, ['a', 'b']).note, 0).question).toBe('a (mit: b)');
    expect(renderCard(col, note(col, STOCK_BASIC_ID, ['a', '<br>']).note, 0).question).toBe('a (ohne)');
  });
  it('verschachtelte Abschnitte und Kommentare', () => {
    const col = withTemplate('{{#Vorderseite}}[{{#Rückseite}}beide{{/Rückseite}}]{{/Vorderseite}}{{! Kommentar }}', '');
    expect(renderCard(col, note(col, STOCK_BASIC_ID, ['x', 'y']).note, 0).question).toBe('[beide]');
    expect(renderCard(col, note(col, STOCK_BASIC_ID, ['x', '']).note, 0).question).toBe('[]');
  });
  it('unbekannte Felder und nicht geschlossene Abschnitte werden gemeldet', () => {
    const col = withTemplate('{{Gibtesnicht}} {{#Vorderseite}}offen', '');
    const card = renderCard(col, note(col, STOCK_BASIC_ID, ['x', 'y']).note, 0);
    expect(card.errors).toEqual(expect.arrayContaining([expect.stringContaining('Gibtesnicht'), expect.stringContaining('nicht geschlossen')]));
  });
  it('besondere Felder: Tags, Type, Deck, Subdeck, Card', () => {
    const col = withTemplate('{{Tags}}|{{Type}}|{{Deck}}|{{Subdeck}}|{{Card}}', '');
    const n = { ...note(col, STOCK_BASIC_ID, ['x', 'y'], ['a', 'b']).note };
    const card = renderCard(col, n, 0, { deckName: 'Latein::Nomen' });
    expect(card.question).toBe('a b|Einfach|Latein::Nomen|Nomen|Karte 1');
  });
  it('Filter: text entfernt HTML, hint klappt auf, furigana/kanji/kana', () => {
    const col = withTemplate('{{text:Vorderseite}}|{{hint:Rückseite}}|{{furigana:Vorderseite}}|{{kanji:Vorderseite}}|{{kana:Vorderseite}}', '');
    const n = note(col, STOCK_BASIC_ID, ['<b>漢字[かんじ]</b> &amp; Co', 'Tipp']).note;
    const q = renderCard(col, n, 0).question;
    expect(q).toContain('漢字[かんじ] &amp; Co|');
    expect(q).toContain('<details class="hint"><summary>Hinweis</summary>Tipp</details>');
    expect(q).toContain('<ruby><rb>漢字</rb><rt>かんじ</rt></ruby>');
    expect(plainText(renderCard(col, note(col, STOCK_BASIC_ID, ['x', '']).note, 0).question)).not.toContain('Hinweis');
  });
  it('Filter wirken von rechts: {{text:hint:Feld}}', () => {
    const col = withTemplate('{{text:hint:Rückseite}}', '');
    expect(plainText(renderCard(col, note(col, STOCK_BASIC_ID, ['x', '<b>y</b>']).note, 0).question)).toContain('Hinweis');
  });
  it('Antwort eintippen: Eingabefeld vorn, Vergleich hinten', () => {
    const col = emptyCollection();
    const n = note(col, STOCK_TYPING_ID, ['Hauptstadt von Italien?', 'Rom']).note;
    const card = renderCard(col, n, 0);
    expect(card.question).toContain('<input type="text" class="bub-typeans"');
    expect(renderCard(col, n, 0, { typed: 'Rom' }).answer).toContain('<span class="typeGood">Rom</span>');
    expect(renderCard(col, n, 0, { typed: 'Rim' }).answer).toContain('typeBad');
    expect(typeAnswerHtml('Rom', undefined)).toBe('<code id="typeans">Rom</code>');
  });
  it('Medien aus dem Paket werden mit der Adresse zum Anzeigen versehen, Netz-Adressen fallen weg', () => {
    const col = emptyCollection();
    const n = note(col, STOCK_BASIC_ID, ['<img src="katze.jpg"><img src="https://bose.example/x.png">', 'Miau [sound:miau.mp3] [sound:fehlt.mp3]']).note;
    const card = renderCard(col, n, 0, { media });
    expect(card.question).toBe('<img src="blob:katze.jpg">');
    expect(card.answer).toContain('<audio src="blob:miau.mp3" controls preload="none"></audio>');
    expect(card.answer).not.toContain('fehlt.mp3');
  });
  it('das CSS des Notiztyps wird auf die Karte beschränkt', () => {
    const col = emptyCollection();
    const n = note(col, STOCK_BASIC_ID, ['a', 'b']).note;
    expect(renderCard(col, n, 0).css).toContain(`${CARD_SCOPE} { font-family: arial`);
  });
});

describe('Anki-Renderer: Lückentext', () => {
  it('eine Lücke: vorn [...], hinten das Wort hervorgehoben', () => {
    expect(clozeField('Canberra was founded in {{c1::1913}}.', 1, false)).toBe('Canberra was founded in <span class="cloze" data-ordinal="1">[...]</span>.');
    expect(clozeField('Canberra was founded in {{c1::1913}}.', 1, true)).toBe('Canberra was founded in <span class="cloze" data-ordinal="1">1913</span>.');
  });
  it('mehrere Nummern: je Karte nur die eigene Lücke verdeckt', () => {
    const text = '{{c2::Canberra}} was founded in {{c1::1913}}';
    expect(plainText(clozeField(text, 1, false))).toBe('Canberra was founded in [...]');
    expect(plainText(clozeField(text, 2, false))).toBe('[...] was founded in 1913');
  });
  it('Hinweis nach den zwei Doppelpunkten', () => {
    expect(plainText(clozeField('{{c1::Canberra::city}} was founded', 1, false))).toBe('[city] was founded');
  });
  it('verschachtelt: die äußere Lücke verdeckt alles, die innere nur ihr Stück', () => {
    const text = '{{c1::Canberra was {{c2::founded}}}} in 1913';
    expect(plainText(clozeField(text, 1, false))).toBe('[...] in 1913');
    expect(plainText(clozeField(text, 2, false))).toBe('Canberra was [...] in 1913');
    expect(plainText(clozeField(text, 2, true))).toBe('Canberra was founded in 1913');
  });
  it('eine Lücke für mehrere Karten: {{c1,2::…}}', () => {
    const text = '{{c1::-té}}, {{c2::-sion}} sind {{c1,2::feminine}}';
    expect(plainText(clozeField(text, 1, false))).toBe('[...], -sion sind [...]');
    expect(plainText(clozeField(text, 2, false))).toBe('-té, [...] sind [...]');
    const col = emptyCollection();
    expect(cardOrds(notetypeOf(col, STOCK_CLOZE_ID)!, [text, ''])).toEqual([0, 1]);
  });
  it('Lückentext-Karte: vorn und hinten, mit Zusatzinfo', () => {
    const col = emptyCollection();
    const n = note(col, STOCK_CLOZE_ID, ['{{c1::Paris}} ist die Hauptstadt', 'Frankreich']).note;
    const card = renderCard(col, n, 0);
    expect(plainText(card.question)).toBe('[...] ist die Hauptstadt');
    expect(plainText(card.answer)).toBe('Paris ist die Hauptstadt\nFrankreich');
    expect(previewCards(col, n).map((p) => p.name)).toEqual(['Lücke 1']);
  });
  it('unvollständige Lücke bleibt stehen, nichts bricht', () => {
    expect(clozeField('{{c1::offen', 1, false)).toBe('{{c1::offen');
  });
});

describe('Anki-Bereiniger: HTML', () => {
  it('entfernt Skripte, Ereignis-Attribute, Frames und Formulare', () => {
    const html = sanitizeHtml('<b onclick="x()">fett</b><script>alert(1)</script><iframe src="https://x"></iframe><form><input name=a></form><style>*{}</style>Ende');
    expect(html).toBe('<b>fett</b>Ende');
  });
  it('lässt gängige Formatierung und Tabellen zu, entfernt unbekannte Tags und behält den Text', () => {
    expect(sanitizeHtml('<div class="a b"><p>Text <u>u</u> <blink>blinkt</blink></p><table><tr><td colspan=2>x</td></tr></table></div>')).toBe('<div class="a b"><p>Text <u>u</u> blinkt</p><table><tr><td colspan="2">x</td></tr></table></div>');
  });
  it('Verweise nur auf http, https und mailto, sicher geöffnet', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">a</a>')).toBe('<a>a</a>');
    expect(sanitizeHtml('<a href="https://example.org/x?a=1&b=2">b</a>')).toBe('<a href="https://example.org/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">b</a>');
    expect(sanitizeHtml('<a href="data:text/html,x">c</a>')).toBe('<a>c</a>');
  });
  it('Stil: nur bekannte Eigenschaften, keine Adressen oder Ausdrücke', () => {
    expect(sanitizeHtml('<span style="color: red; background: url(x.png); position: fixed; font-size: 20px; width: expression(alert(1))">x</span>')).toBe('<span style="color: red; font-size: 20px">x</span>');
  });
  it('Medien: nur aus dem Paket, mit Pfad oder Netz nie', () => {
    const options = { media };
    expect(sanitizeHtml('<img src="katze.jpg">', options)).toBe('<img src="blob:katze.jpg">');
    expect(sanitizeHtml('<img src="../geheim.png">', options)).toBe('');
    expect(sanitizeHtml('<img src="//x.example/a.png">', options)).toBe('');
    expect(sanitizeHtml('<img src="data:image/png;base64,AAAA">', options)).toBe('');
    expect(sanitizeHtml('<img src="katze.jpg">')).toBe('');
    expect(sanitizeHtml('<video src="katze.jpg"></video>', options)).toBe('<video src="blob:katze.jpg" controls preload="metadata"></video>');
  });
  it('schließt offene Tags, ignoriert überzählige Endtags, schützt Text', () => {
    expect(sanitizeHtml('<b><i>x</b> y </i> a < b > c')).toBe('<b><i>x</i></b> y  a &lt; b &gt; c');
  });
  it('die Ids bekommen ein Präfix, damit sie die Seite nicht stören; ein Eingabefeld gibt es nur von uns', () => {
    expect(sanitizeHtml('<hr id=answer><div id="root"></div>')).toBe('<hr id="bub-answer"><div id="bub-root"></div>');
    expect(sanitizeHtml('<input type=text name=pw>')).toBe('');
  });
  it('Kommentare fallen weg', () => {
    expect(sanitizeHtml('a<!-- <script> -->b')).toBe('ab');
  });
});

describe('Anki-Bereiniger: CSS', () => {
  it('.card und body sind die Karte selbst, alles andere liegt darunter', () => {
    const css = '.card { color: red; }\n.cloze { font-weight: bold; }\nbody { margin: 0 }\n.card.nightMode .cloze, h1 { color: lightblue }';
    expect(scopeCss(css, '.k')).toBe('.k { color: red }\n.k .cloze { font-weight: bold }\n.k { margin: 0 }\n.k.nightMode .cloze, .k h1 { color: lightblue }');
  });
  it('wirft @import, Schriften, Netz-Adressen und gefährliche Werte weg', () => {
    const css = '@import url("https://x/a.css");\n@font-face { font-family: F; src: url(https://x/f.woff) }\n.card { background: url(https://x/b.png); color: blue; position: fixed; behavior: url(x.htc); width: expression(1) }';
    expect(scopeCss(css, '.k')).toBe('.k { color: blue }');
  });
  it('Dateien aus dem Paket dürfen im CSS vorkommen', () => {
    expect(scopeCss('.card { background-image: url("katze.jpg") }', '.k', media)).toBe('.k { background-image: url("blob:katze.jpg") }');
  });
  it('Medienabfragen werden mitgenommen, Auswahlen darin beschränkt', () => {
    expect(scopeCss('@media (max-width: 600px) { .card { font-size: 16px } }', '.k')).toBe('@media (max-width: 600px) { .k { font-size: 16px } }');
  });
});
