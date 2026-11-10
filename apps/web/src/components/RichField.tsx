import { sanitizeHtml } from '@brett-und-blatt/engine';
import { useEffect, useRef, useState } from 'react';

/*
 * Ein Feld einer Notiz (#101, L4): kleines Textfeld mit Formatierung (`contenteditable`), dazu die HTML-Ansicht. Gespeichert wird immer bereinigtes
 * HTML; Bilder und Ton behalten ihre Dateinamen (nur zum Anzeigen stehen Adressen davor).
 */

const BTN = 'min-h-11 min-w-11 rounded-lg border border-line bg-surface px-2 text-sm hover:bg-surface-2';

/** Wandelt die Adressen zum Anzeigen im bearbeiteten HTML wieder in Dateinamen und bereinigt. */
function toStored(el: HTMLElement, reverse: Map<string, string>): string {
  const clone = el.cloneNode(true) as HTMLElement;
  for (const node of clone.querySelectorAll<HTMLElement>('img,audio,video,source')) {
    const src = node.getAttribute('src');
    const name = src ? reverse.get(src) : undefined;
    if (name) node.setAttribute('src', name);
  }
  // Ton steht in Anki als `[sound:datei]` im Feld; die Audio-Elemente zum Anhören gehören nur in die Anzeige.
  return sanitizeHtml(clone.innerHTML, { media: (name) => name }).replace(/<audio\b[^>]*?\bsrc="([^"]+)"[^>]*><\/audio>/g, (_m, name: string) => `[sound:${name.replace(/&amp;/g, '&')}]`);
}

export function RichField({ id, label, value, onChange, media, cloze = false, plain = false }: { id: string; label: string; value: string; onChange: (html: string) => void; media: (name: string) => string | null; cloze?: boolean; plain?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const reverse = useRef(new Map<string, string>());
  const [html, setHtml] = useState(false);
  const [source, setSource] = useState(value);
  const last = useRef(value);

  const shown = (stored: string): string => {
    reverse.current = new Map();
    return sanitizeHtml(stored, {
      media: (name) => {
        const url = media(name);
        if (url) reverse.current.set(url, name);
        return url;
      },
    });
  };
  useEffect(() => {
    if (!ref.current || html) return;
    // Nur von außen geänderte Werte ins Feld schreiben, sonst springt die Schreibmarke.
    if (value !== last.current || ref.current.innerHTML === '') {
      ref.current.innerHTML = shown(value);
      last.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, html]);
  useEffect(() => setSource(value), [value]);

  const emit = () => {
    if (!ref.current) return;
    const stored = toStored(ref.current, reverse.current);
    last.current = stored;
    onChange(stored);
  };
  const run = (command: string) => {
    ref.current?.focus();
    document.execCommand(command);
    emit();
  };
  const addCloze = (same: boolean) => {
    const el = ref.current;
    if (!el) return;
    const text = el.innerText;
    const used = [...text.matchAll(/\{\{c(\d+)::/g)].map((m) => Number(m[1]));
    const next = used.length === 0 ? 1 : same ? Math.max(...used) : Math.max(...used) + 1;
    const selected = window.getSelection()?.toString() ?? '';
    el.focus();
    document.execCommand('insertText', false, `{{c${next}::${selected}}}`);
    emit();
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {!plain && (
        <div className="flex flex-wrap gap-1" role="toolbar" aria-label={`Formatierung für ${label}`}>
          <button type="button" className={BTN} aria-label="Fett" onClick={() => run('bold')} disabled={html}>
            <b>F</b>
          </button>
          <button type="button" className={BTN} aria-label="Kursiv" onClick={() => run('italic')} disabled={html}>
            <i>K</i>
          </button>
          <button type="button" className={BTN} aria-label="Unterstrichen" onClick={() => run('underline')} disabled={html}>
            <u>U</u>
          </button>
          <button type="button" className={BTN} aria-label="Aufzählung" onClick={() => run('insertUnorderedList')} disabled={html}>
            •
          </button>
          <button type="button" className={BTN} aria-label="Nummerierung" onClick={() => run('insertOrderedList')} disabled={html}>
            1.
          </button>
          <button type="button" className={BTN} aria-label="Hochgestellt" onClick={() => run('superscript')} disabled={html}>
            x²
          </button>
          <button type="button" className={BTN} aria-label="Tiefgestellt" onClick={() => run('subscript')} disabled={html}>
            x₂
          </button>
          <button type="button" className={BTN} aria-label="Formatierung entfernen" onClick={() => run('removeFormat')} disabled={html}>
            ⌫
          </button>
          {cloze && (
            <button type="button" className={BTN} aria-label="Lücke aus der Auswahl machen (mit Umschalt: gleiche Nummer)" onClick={(e) => addCloze(e.shiftKey)} disabled={html}>
              […]
            </button>
          )}
          <button type="button" className={BTN} aria-pressed={html} onClick={() => setHtml(!html)}>
            {'</>'}
          </button>
        </div>
      )}
      {html ? (
        <textarea
          id={id}
          className="min-h-24 w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onBlur={() => {
            const clean = sanitizeHtml(source, { media: (name) => name }).replace(/<audio\b[^>]*?\bsrc="([^"]+)"[^>]*><\/audio>/g, (_m, name: string) => `[sound:${name.replace(/&amp;/g, '&')}]`);
            last.current = clean;
            onChange(clean);
          }}
        />
      ) : (
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 [&_img]:max-h-40 [&_img]:max-w-full"
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            // Nur Text einfügen: so kommt kein fremdes Aussehen oder HTML mit.
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
          }}
        />
      )}
    </div>
  );
}
