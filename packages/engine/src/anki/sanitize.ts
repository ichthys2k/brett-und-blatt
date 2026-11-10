/*
 * Bereinigt HTML und CSS aus fremden Karten (Vorhaben #101, L4; Bericht `anki-recherche.md`, Abschnitt 7). Brett & Blatt führt nie fremden
 * Code aus: Erlaubt sind nur bekannte Tags und Attribute, Medien nur aus dem Paket, Verweise nur auf http, https und mailto. Alles andere
 * wird entfernt. Ohne Browser (eigener Tokenizer), damit Server und Tests dasselbe prüfen.
 */

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'audio', 'b', 'bdi', 'bdo', 'big', 'blockquote', 'br', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
  'img', 'input', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 'rb', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'source', 'span', 'strike', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'tt', 'u', 'ul', 'var', 'video', 'wbr',
]);
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'source', 'wbr', 'col']);
/** Tags, deren Inhalt samt Tag wegfällt (Skripte, Stile, eingebettete Seiten, Formulare). */
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'textarea', 'select', 'option', 'svg', 'math', 'canvas', 'applet', 'frame', 'frameset', 'title', 'head', 'form', 'button']);
const MEDIA_TAGS = new Set(['img', 'audio', 'video', 'source']);

const STYLE_PROPS = new Set([
  'color', 'background', 'background-color', 'font', 'font-family', 'font-size', 'font-style', 'font-weight', 'font-variant', 'text-align', 'text-decoration', 'text-transform', 'text-indent', 'line-height', 'letter-spacing', 'word-spacing',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color',
  'border-style', 'border-width', 'border-radius', 'border-collapse', 'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height', 'display', 'vertical-align', 'white-space', 'list-style', 'list-style-type', 'direction', 'opacity',
]);
const BAD_VALUE = /url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|@import|behavior\s*:|-moz-binding|[\\<>]/i;

export interface SanitizeOptions {
  /** Macht aus dem Dateinamen eines Mediums eine Adresse zum Anzeigen (z. B. `blob:`); `null`: gibt es nicht, das Element entfällt. */
  media?: (name: string) => string | null;
}

const escapeText = (text: string): string => text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (value: string): string => value.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decodeAttr = (value: string): string => value.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** `[sound:datei.mp3]` wird zu einem Audio-Element mit Bedienung. */
export const soundTagsToHtml = (html: string): string => html.replace(/\[sound:([^\]]+)\]/g, (_m, name: string) => `<audio controls src="${escapeAttr(name)}"></audio>`);

function cleanStyle(value: string): string {
  const out: string[] = [];
  for (const part of decodeAttr(value).split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    const prop = part.slice(0, at).trim().toLowerCase();
    const val = part.slice(at + 1).trim();
    if (STYLE_PROPS.has(prop) && val && !BAD_VALUE.test(val) && !(prop === 'display' && !/^(?:block|inline|inline-block|none|flex|list-item|table|table-cell|table-row)$/i.test(val))) out.push(`${prop}: ${val}`);
  }
  return out.join('; ');
}

function mediaName(src: string): string | null {
  const raw = decodeAttr(src).trim();
  if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(raw) || raw.includes('..') || raw.includes('\\')) return null;
  try {
    return decodeURIComponent(raw).normalize('NFC');
  } catch {
    return raw.normalize('NFC');
  }
}

function cleanAttrs(tag: string, attrs: Map<string, string>, options: SanitizeOptions): string | null {
  // Das einzige Eingabefeld, das erlaubt ist: das der Antwort zum Eintippen (`{{type:Feld}}`), das der Renderer selbst erzeugt.
  if (tag === 'input') return attrs.get('class') === 'bub-typeans' && attrs.get('data-bub-type') === '1' ? ' type="text" class="bub-typeans" autocomplete="off" autocapitalize="off" spellcheck="false"' : null;
  // Das Vorlesezeichen, das der Renderer für `{{tts …}}` erzeugt: nur Text und Sprache, kein Programm.
  if (tag === 'span' && attrs.get('class') === 'bub-tts' && attrs.has('data-bub-tts')) {
    const lang = attrs.get('data-bub-lang') ?? '';
    return ` class="bub-tts" data-bub-tts="${escapeAttr(decodeAttr(attrs.get('data-bub-tts') ?? '').slice(0, 600))}" data-bub-lang="${/^[A-Za-z]{2,3}(?:[_-][A-Za-z0-9]{2,4})?$/.test(lang) ? lang : ''}"`;
  }
  const out: string[] = [];
  const get = (name: string) => attrs.get(name);
  const num = (name: string) => {
    const v = get(name);
    return v && /^\d{1,5}%?$/.test(v.trim()) ? v.trim() : null;
  };
  const cls = get('class');
  if (cls && /^[\w\- ]{1,200}$/.test(cls)) out.push(`class="${cls}"`);
  const id = get('id');
  if (id && /^[\w-]{1,60}$/.test(id)) out.push(`id="${id.startsWith('bub-') ? id : `bub-${id}`}"`);
  const style = get('style');
  if (style) {
    const clean = cleanStyle(style);
    if (clean) out.push(`style="${escapeAttr(clean)}"`);
  }
  for (const name of ['title', 'alt']) {
    const v = get(name);
    if (v !== undefined && ['img', 'audio', 'video', 'abbr', 'span', 'a', 'div', 'p', 'td', 'th', 'q', 'cite', 'bdo'].includes(tag)) out.push(`${name}="${escapeAttr(decodeAttr(v).slice(0, 300))}"`);
  }
  const dir = get('dir');
  if (dir && /^(?:ltr|rtl|auto)$/i.test(dir)) out.push(`dir="${dir.toLowerCase()}"`);
  const lang = get('lang');
  if (lang && /^[a-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/.test(lang)) out.push(`lang="${lang}"`);
  if (tag === 'font') {
    const color = get('color');
    if (color && /^(?:#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(color)) out.push(`color="${color}"`);
    const size = get('size');
    if (size && /^[+-]?\d$/.test(size)) out.push(`size="${size}"`);
    const face = get('face');
    if (face && /^[\w ,'-]{1,80}$/.test(face)) out.push(`face="${face}"`);
  }
  if (tag === 'td' || tag === 'th') for (const name of ['colspan', 'rowspan']) if (num(name)) out.push(`${name}="${num(name)}"`);
  if (tag === 'img' || tag === 'video') for (const name of ['width', 'height']) if (num(name)) out.push(`${name}="${num(name)}"`);
  if (tag === 'ol') {
    const start = get('start');
    if (start && /^\d{1,4}$/.test(start)) out.push(`start="${start}"`);
  }
  if (tag === 'a') {
    const href = get('href') ? decodeAttr(get('href')!).trim() : '';
    if (/^(?:https?:\/\/|mailto:)/i.test(href)) out.push(`href="${escapeAttr(href)}"`, 'target="_blank"', 'rel="noopener noreferrer"');
  }
  if (MEDIA_TAGS.has(tag)) {
    const name = get('src') !== undefined ? mediaName(get('src')!) : null;
    const url = name && options.media ? options.media(name) : null;
    if (tag === 'img' && !url) return null;
    if (url) out.push(`src="${escapeAttr(url)}"`);
    else if (tag === 'source') return null;
    if (tag === 'audio' || tag === 'video') out.push('controls');
    if (tag === 'video') out.push('preload="metadata"');
    if (tag === 'audio') out.push('preload="none"');
  }
  return out.length ? ` ${out.join(' ')}` : '';
}

const ATTR = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** Gibt nur erlaubtes HTML zurück; Text bleibt, Unerlaubtes fällt weg, offene Tags werden geschlossen. */
export function sanitizeHtml(html: string, options: SanitizeOptions = {}): string {
  const src = soundTagsToHtml(html);
  const out: string[] = [];
  const stack: string[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      out.push(escapeText(src.slice(i)));
      break;
    }
    if (lt > i) out.push(escapeText(src.slice(i, lt)));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/.exec(src.slice(lt, lt + 4000));
    if (!m) {
      out.push('&lt;');
      i = lt + 1;
      continue;
    }
    i = lt + m[0].length;
    const closing = m[1] === '/';
    const tag = m[2]!.toLowerCase();
    if (!closing && DROP_WITH_CONTENT.has(tag)) {
      const close = new RegExp(`</${tag}\\s*>`, 'i').exec(src.slice(i));
      i = close ? i + close.index + close[0].length : n;
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at >= 0) {
        while (stack.length > at) out.push(`</${stack.pop()}>`);
      }
      continue;
    }
    const attrs = new Map<string, string>();
    for (const a of m[3]!.matchAll(ATTR)) attrs.set(a[1]!.toLowerCase(), a[2] ?? a[3] ?? a[4] ?? '');
    const cleaned = cleanAttrs(tag, attrs, options);
    if (cleaned === null) continue;
    out.push(`<${tag}${cleaned}>`);
    if (!VOID_TAGS.has(tag)) stack.push(tag);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('');
}

// ---------------------------------------------------------------- CSS

function splitTopLevel(css: string): { prelude: string; body: string }[] {
  const rules: { prelude: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let bodyStart = -1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) bodyStart = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && bodyStart >= 0) {
        rules.push({ prelude: css.slice(start, bodyStart).trim(), body: css.slice(bodyStart + 1, i) });
        start = i + 1;
        bodyStart = -1;
      } else if (depth < 0) depth = 0;
    } else if (c === ';' && depth === 0) {
      rules.push({ prelude: css.slice(start, i).trim(), body: '' });
      start = i + 1;
    }
  }
  return rules;
}

function cleanDeclarations(body: string, media: ((name: string) => string | null) | undefined): string {
  const out: string[] = [];
  for (const part of body.split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    const prop = part.slice(0, at).trim().toLowerCase();
    let value = part.slice(at + 1).trim();
    if (!/^[a-z-]+$/.test(prop) || !value || prop === 'position' && /fixed|sticky/i.test(value) || /^(?:behavior|-moz-binding)$/.test(prop)) continue;
    // `url(datei)` bleibt nur, wenn die Datei im Paket liegt (dann mit der Adresse zum Anzeigen); Netz-Adressen fallen weg.
    let bad = false;
    value = value.replace(/url\(\s*(["']?)([^"')]*)\1\s*\)/gi, (_m, _q, name: string) => {
      const file = mediaName(name);
      const url = file && media ? media(file) : null;
      if (!url) bad = true;
      return url ? `url("${escapeAttr(url)}")` : '';
    });
    if (bad || /expression\s*\(|javascript\s*:|vbscript\s*:|@import|[\\<>]/i.test(value)) continue;
    out.push(`${prop}: ${value}`);
  }
  return out.join('; ');
}

/** Beschränkt das CSS eines Notiztyps auf die Karte: Auswahlen bekommen `scope` vorangestellt (`.card`, `body` und `html` sind die Karte selbst); `@import`, Schriften und Netz-Adressen fallen weg. */
export function scopeCss(css: string, scope: string, media?: (name: string) => string | null): string {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  for (const rule of splitTopLevel(clean)) {
    const { prelude, body } = rule;
    if (!prelude) continue;
    if (prelude.startsWith('@')) {
      const name = /^@([a-z-]+)/i.exec(prelude)?.[1]?.toLowerCase();
      if (name === 'media' || name === 'supports') {
        const inner = scopeCss(body, scope, media);
        if (inner) out.push(`${prelude} { ${inner} }`);
      }
      continue;
    }
    const selectors = prelude
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !/[\\<>@]/.test(s))
      .map((s) => {
        const self = /^(?:html|body|:root|\.card)(?![\w-])(.*)$/is.exec(s);
        return self ? `${scope}${self[1]}` : `${scope} ${s}`;
      });
    const declarations = cleanDeclarations(body, media);
    if (selectors.length && declarations) out.push(`${selectors.join(', ')} { ${declarations} }`);
  }
  return out.join('\n');
}
