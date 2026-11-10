import { hasOcclusion, occlusionSvg, parseOcclusion } from './occlusion';
import { clozeOrds } from './collection';
import { fieldIsEmpty, stripHtml } from './text';
import { sanitizeHtml, scopeCss } from './sanitize';
import type { AnkiCollection, AnkiNote, AnkiNotetype } from './types';

/*
 * Der Vorlagen-Renderer (Vorhaben #101, L4): macht aus einer Notiz, ihrem Notiztyp und der Nummer einer Karte die Vorder- und Rückseite wie
 * Anki (Handbuch „Card Generation“, „Field Replacements“, „Cloze Deletion“): `{{Feld}}`, `{{#Feld}}…{{/Feld}}`, `{{^Feld}}…{{/Feld}}`, Filter
 * (`text:`, `cloze:`, `hint:`, `type:`, `furigana:`, `kanji:`, `kana:`, `tts …:`), besondere Felder (`FrontSide`, `Tags`, `Deck`, `Subdeck`,
 * `Card`, `CardFlag`, `Type`) und Lückentext mit Verschachtelung und mehreren Nummern (`{{c1,2::…}}`). Das Ergebnis läuft durch den Bereiniger
 * (`sanitize.ts`); Skripte aus Vorlagen werden nie ausgeführt. Der Hinweis (`hint:`) ist ein aufklappbarer Abschnitt statt eines Skriptlinks.
 */

export const CARD_SCOPE = '.bub-card';

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------- Lückentext

type ClozeNode = { text: string } | { cloze: { ords: number[]; hint: string; children: ClozeNode[] } };

const OPEN = /\{\{c(\d+(?:,\d+)*)::/;

function parseCloze(src: string, depth = 0): ClozeNode[] {
  const nodes: ClozeNode[] = [];
  let rest = src;
  while (rest.length > 0) {
    const m = OPEN.exec(rest);
    if (!m || depth > 8) {
      nodes.push({ text: rest });
      break;
    }
    if (m.index > 0) nodes.push({ text: rest.slice(0, m.index) });
    // Das passende „}}“ suchen (verschachtelte Lücken mitzählen).
    let at = m.index + m[0].length;
    let level = 1;
    let end = -1;
    while (at < rest.length) {
      if (rest.startsWith('{{', at) && /^\{\{c\d/.test(rest.slice(at, at + 4))) {
        level++;
        at += 2;
      } else if (rest.startsWith('}}', at)) {
        level--;
        if (level === 0) {
          end = at;
          break;
        }
        at += 2;
      } else at++;
    }
    if (end < 0) {
      nodes.push({ text: rest.slice(m.index) });
      break;
    }
    const inner = rest.slice(m.index + m[0].length, end);
    // Hinweis: nach dem letzten „::“ außerhalb verschachtelter Lücken.
    let split = -1;
    let d = 0;
    for (let k = 0; k < inner.length; k++) {
      if (inner.startsWith('{{', k) && /^\{\{c\d/.test(inner.slice(k, k + 4))) d++;
      else if (inner.startsWith('}}', k) && d > 0) d--;
      else if (d === 0 && inner.startsWith('::', k)) split = k;
    }
    const content = split >= 0 ? inner.slice(0, split) : inner;
    const hint = split >= 0 ? inner.slice(split + 2) : '';
    nodes.push({ cloze: { ords: m[1]!.split(',').map(Number), hint, children: parseCloze(content, depth + 1) } });
    rest = rest.slice(end + 2);
  }
  return nodes;
}

function renderCloze(nodes: ClozeNode[], active: number, answer: boolean): string {
  return nodes
    .map((node) => {
      if ('text' in node) return node.text;
      const { ords, hint, children } = node.cloze;
      const inner = renderCloze(children, active, answer);
      if (!ords.includes(active)) return inner;
      if (answer) return `<span class="cloze" data-ordinal="${active}">${inner}</span>`;
      return `<span class="cloze" data-ordinal="${active}">[${hint ? escapeHtml(stripHtml(hint)) : '...'}]</span>`;
    })
    .join('');
}

/** Der Text eines Lückentext-Feldes für Karte `active` (ab 1). */
export const clozeField = (value: string, active: number, answer: boolean): string => renderCloze(parseCloze(value), active, answer);

// ---------------------------------------------------------------- Filter

/**
 * `{{tts en_US voices=… speed=…:Feld}}` (L8): wie in Anki steht nur das Vorlesen auf der Karte, nicht der Text. Der Renderer setzt ein Zeichen 🔊 mit dem Text und der
 * Sprache; die Web-App liest beim Antippen mit der Stimme des Browsers vor. Stimmen und Tempo aus der Vorlage bleiben im Paket, werden aber nicht ausgewertet.
 */
function ttsElement(filter: string, value: string): string {
  const lang = filter.split(/\s+/).slice(1).find((part) => !part.includes('=')) ?? '';
  const text = stripHtml(value).replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!text) return '';
  const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<span class="bub-tts" data-bub-tts="${attr(text)}" data-bub-lang="${/^[A-Za-z]{2,3}(?:[_-][A-Za-z0-9]{2,4})?$/.test(lang) ? lang : ''}">🔊</span>`;
}

const RUBY = / ?([^ >]+?)\[(.+?)\]/g;

function applyFilter(filter: string, value: string, ctx: Context): string {
  const name = filter.split(' ')[0]!.toLowerCase();
  switch (name) {
    case 'text':
      return escapeHtml(stripHtml(value));
    case 'cloze':
      return ctx.cloze ? clozeField(value, ctx.cloze, ctx.answer) : value;
    case 'hint':
      return fieldIsEmpty(value) ? '' : `<details class="hint"><summary>Hinweis</summary>${value}</details>`;
    case 'furigana':
      return value.replace(RUBY, (_m, base: string, reading: string) => `<ruby><rb>${base}</rb><rt>${reading}</rt></ruby>`);
    case 'kanji':
      return value.replace(RUBY, (_m, base: string) => base);
    case 'kana':
      return value.replace(RUBY, (_m, _base: string, reading: string) => reading);
    case 'tts':
      return ttsElement(filter, value);
    default:
      // `type` (hier gesondert) und unbekannte Filter lassen den Wert unverändert.
      return value;
  }
}

// ---------------------------------------------------------------- Vorlage

type Token = { kind: 'text'; text: string } | { kind: 'tag'; tag: string };

function tokenize(template: string): Token[] {
  const out: Token[] = [];
  let at = 0;
  for (const m of template.matchAll(/\{\{([^{}]+?)\}\}/g)) {
    if (m.index! > at) out.push({ kind: 'text', text: template.slice(at, m.index) });
    out.push({ kind: 'tag', tag: m[1]!.trim() });
    at = m.index! + m[0].length;
  }
  if (at < template.length) out.push({ kind: 'text', text: template.slice(at) });
  return out;
}

interface Context {
  values: Map<string, string>;
  /** Nummer der Lücke (ab 1), sonst 0. */
  cloze: number;
  answer: boolean;
  front: string;
  errors: string[];
  /** Was für `{{type:Feld}}` erwartet wird und was getippt wurde. */
  typeExpected: string | null;
  typed: string | undefined;
}

const TYPE_INPUT = '<input type="text" class="bub-typeans" data-bub-type="1">';

function isEmptyValue(name: string, ctx: Context): boolean {
  const value = ctx.values.get(name);
  if (value === undefined) return true;
  return fieldIsEmpty(value);
}

function renderTokens(tokens: Token[], ctx: Context): string {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind === 'text') {
      out += token.text;
      continue;
    }
    const tag = token.tag;
    if (tag.startsWith('!')) continue;
    if (tag.startsWith('#') || tag.startsWith('^')) {
      const name = tag.slice(1).trim();
      // passendes Ende suchen
      let depth = 1;
      let end = -1;
      for (let j = i + 1; j < tokens.length; j++) {
        const t = tokens[j]!;
        if (t.kind !== 'tag') continue;
        if ((t.tag.startsWith('#') || t.tag.startsWith('^')) && t.tag.slice(1).trim() === name) depth++;
        else if (t.tag.startsWith('/') && t.tag.slice(1).trim() === name && --depth === 0) {
          end = j;
          break;
        }
      }
      if (end < 0) {
        ctx.errors.push(`„{{${tag}}}“ wird nicht geschlossen.`);
        continue;
      }
      if (!ctx.values.has(name)) ctx.errors.push(`Es gibt kein Feld „${name}“.`);
      const show = tag.startsWith('#') ? !isEmptyValue(name, ctx) : isEmptyValue(name, ctx);
      if (show) out += renderTokens(tokens.slice(i + 1, end), ctx);
      i = end;
      continue;
    }
    if (tag.startsWith('/')) {
      ctx.errors.push(`„{{${tag}}}“ hat keinen Anfang.`);
      continue;
    }
    const parts = tag.split(':').map((p) => p.trim());
    const field = parts.pop()!;
    const filters = parts;
    if (field === 'FrontSide') {
      out += ctx.front;
      continue;
    }
    if (!ctx.values.has(field)) {
      ctx.errors.push(`Es gibt kein Feld „${field}“.`);
      out += `<span class="bub-error">{{${tag}}}</span>`;
      continue;
    }
    let value = ctx.values.get(field)!;
    if (filters.some((f) => f.toLowerCase() === 'type')) {
      ctx.typeExpected = stripHtml(value).trim();
      out += ctx.answer ? typeAnswerHtml(ctx.typeExpected, ctx.typed) : TYPE_INPUT;
      continue;
    }
    // Filter wirken von rechts (nah am Feld) nach links.
    for (const filter of [...filters].reverse()) value = applyFilter(filter, value, ctx);
    out += value;
  }
  return out;
}

/** Vergleich der getippten mit der erwarteten Antwort: Übereinstimmung grün, Abweichung rot, Fehlendes gelb (Klassen `typeGood`, `typeBad`, `typeMissed`). */
export function typeAnswerHtml(expected: string, typed: string | undefined): string {
  const span = (cls: string, text: string) => (text ? `<span class="${cls}">${escapeHtml(text)}</span>` : '');
  if (typed === undefined) return `<code id="typeans">${escapeHtml(expected)}</code>`;
  if (typed === expected) return `<code id="typeans">${span('typeGood', expected)}</code>`;
  // einfacher Vergleich: gemeinsamer Anfang und Ende gut, Mitte abweichend
  let a = 0;
  while (a < typed.length && a < expected.length && typed[a] === expected[a]) a++;
  let b = 0;
  while (b < typed.length - a && b < expected.length - a && typed[typed.length - 1 - b] === expected[expected.length - 1 - b]) b++;
  const typedMid = typed.slice(a, typed.length - b);
  const expectedMid = expected.slice(a, expected.length - b);
  return `<code id="typeans">${span('typeGood', typed.slice(0, a))}${span('typeBad', typedMid)}${span('typeGood', typed.slice(typed.length - b))}<br><span id="typearrow">&darr;</span><br>${span('typeGood', expected.slice(0, a))}${span('typeMissed', expectedMid)}${span('typeGood', expected.slice(expected.length - b))}</code>`;
}

export interface RenderOptions {
  /** Macht aus einem Dateinamen eine Adresse zum Anzeigen. */
  media?: (name: string) => string | null;
  /** Was auf der Rückseite getippt wurde (für `{{type:Feld}}`). */
  typed?: string;
  deckName?: string;
  flag?: number;
}

export interface RenderedCard {
  question: string;
  answer: string;
  /** CSS des Notiztyps, auf die Karte (`.bub-card`) beschränkt. */
  css: string;
  errors: string[];
}

/** Zeichnet Vorder- und Rückseite der Karte `ord` (ab 0) einer Notiz. */
export function renderCard(col: AnkiCollection, note: AnkiNote, ord: number, options: RenderOptions = {}): RenderedCard {
  const nt = col.notetypes.find((t) => t.id === note.mid);
  if (!nt) return { question: '', answer: '', css: '', errors: ['Der Notiztyp fehlt.'] };
  const template = nt.type === 1 ? nt.tmpls[0] : nt.tmpls[ord];
  if (!template) return { question: '', answer: '', css: '', errors: [`Der Notiztyp „${nt.name}“ hat keine Vorlage Nummer ${ord + 1}.`] };
  const deck = options.deckName ?? col.decks.find((d) => d.id === note.did)?.name ?? '';
  const values = new Map<string, string>();
  nt.flds.forEach((f, i) => values.set(f.name, note.fields[i] ?? ''));
  const specials: Record<string, string> = {
    Tags: note.tags.join(' '),
    Type: nt.name,
    Deck: deck,
    Subdeck: deck.split('::').pop() ?? deck,
    Card: template.name,
    CardFlag: options.flag ? `flag${options.flag}` : '',
  };
  for (const [key, value] of Object.entries(specials)) if (!values.has(key)) values.set(key, escapeHtml(value));
  const errors: string[] = [];
  const cloze = nt.type === 1 ? ord + 1 : 0;
  const frontCtx: Context = { values, cloze, errors, answer: false, front: '', typeExpected: null, typed: options.typed };
  const front = renderTokens(tokenize(template.qfmt), frontCtx);
  // Auf der Rückseite steht an der Stelle des Eingabefelds der Vergleich (Anki: „FrontSide“ zeigt das Eingabefeld der Vorderseite).
  const frontForAnswer = frontCtx.typeExpected === null ? front : front.split(TYPE_INPUT).join(typeAnswerHtml(frontCtx.typeExpected, options.typed));
  const answer = renderTokens(tokenize(template.afmt), { values, cloze, errors, answer: true, front: frontForAnswer, typeExpected: frontCtx.typeExpected, typed: options.typed });
  const safe = (html: string) => sanitizeHtml(html, options.media ? { media: options.media } : {});
  // Bilder verdecken (L8): Die Vorlage von Anki zeichnet die Masken mit einem Programm; hier zeichnen wir sie selbst.
  const occluded = nt.type === 1 ? occlusionCard(nt, note, cloze, safe) : null;
  if (occluded) return { question: occluded.question, answer: occluded.answer, css: scopeCss(nt.css, CARD_SCOPE, options.media), errors: [...new Set(errors)] };
  return { question: safe(front), answer: safe(answer), css: scopeCss(nt.css, CARD_SCOPE, options.media), errors: [...new Set(errors)] };
}

/**
 * Die Karte einer Notiz mit Bildmasken: Kopfzeile, Bild mit Masken, auf der Rückseite „Zusatz“ und Kommentare. Felder nach der Anki-Vorlage:
 * Occlusion, Image, Header, Back Extra, Comments; die Masken-Lücken stehen im ersten Feld, das welche enthält.
 */
function occlusionCard(nt: AnkiNotetype, note: AnkiNote, active: number, safe: (html: string) => string): { question: string; answer: string } | null {
  const at = note.fields.findIndex((v) => hasOcclusion(v));
  if (at < 0) return null;
  const shapes = parseOcclusion(note.fields[at]!);
  const rest = nt.flds.map((_, i) => (i === at ? '' : (note.fields[i] ?? '')));
  const imageAt = rest.findIndex((v) => /<img\b/i.test(v));
  if (imageAt < 0) return null;
  const [header, extra, comments] = [rest[imageAt + 1] ?? '', rest[imageAt + 2] ?? '', rest[imageAt + 3] ?? ''];
  const box = (answer: boolean) => `<div class="bub-io" style="position:relative;display:inline-block;max-width:100%;line-height:0">${safe(rest[imageAt]!)}${occlusionSvg(shapes, active, answer)}</div>`;
  const text = (html: string) => (html.trim() ? `<div class="bub-io-text">${safe(html)}</div>` : '');
  return {
    question: `${text(header)}${box(false)}`,
    answer: `${text(header)}${box(true)}${text(extra)}${text(comments)}`,
  };
}

/** Vorschau für Notiztyp-Editor und Notizen: die Karten (Vorlagen bzw. Lücken), die diese Notiz ergibt, mit Vorder- und Rückseite. */
export function previewCards(col: AnkiCollection, note: AnkiNote, options: RenderOptions = {}): { ord: number; name: string; card: RenderedCard }[] {
  const nt = col.notetypes.find((t) => t.id === note.mid) as AnkiNotetype | undefined;
  if (!nt) return [];
  const ords = nt.type === 1 ? clozeOrds(nt, note.fields) : nt.req.filter(([, kind]) => kind !== 'none').map(([ord]) => ord);
  return ords.map((ord) => ({ ord, name: nt.type === 1 ? `Lücke ${ord + 1}` : (nt.tmpls[ord]?.name ?? `Karte ${ord + 1}`), card: renderCard(col, note, ord, options) }));
}
