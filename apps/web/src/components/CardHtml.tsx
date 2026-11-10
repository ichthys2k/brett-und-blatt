import { useEffect, useRef, useState, type FormEventHandler, type KeyboardEvent, type MouseEvent } from 'react';
import { hasMath, renderMathInHtml } from '../lib/math';

/** Liest einen Text mit der Stimme des Browsers vor (Anki-Sprachausgabe `tts`); Sprache wie `en_US` oder leer. */
export function speak(text: string, lang: string): void {
  try {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang.replace('_', '-');
    speechSynthesis.speak(utterance);
  } catch {
    // ohne Sprachausgabe bleibt die Karte stumm
  }
}

const speakerOf = (event: { target: EventTarget | null }): HTMLElement | null => (event.target as HTMLElement | null)?.closest?.('.bub-tts') ?? null;

/** Das HTML einer gezeichneten Karte; Formeln `\(…\)` und `\[…\]` werden gesetzt (KaTeX, erst bei Bedarf geladen). */
export function CardHtml({ html, onInput }: { html: string; onInput?: FormEventHandler<HTMLDivElement> }) {
  const [out, setOut] = useState(html);
  useEffect(() => {
    setOut(html);
    if (!hasMath(html)) return;
    let live = true;
    void renderMathInHtml(html).then((done) => live && setOut(done));
    return () => {
      live = false;
    };
  }, [html]);
  const ref = useRef<HTMLDivElement>(null);
  // Vorlesezeichen sind für Tastatur und Screenreader erreichbar (Knopf-Rolle, Beschriftung).
  useEffect(() => {
    for (const el of ref.current?.querySelectorAll<HTMLElement>('.bub-tts') ?? []) {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', 'Vorlesen');
      el.style.cursor = 'pointer';
    }
  }, [out]);
  const activate = (el: HTMLElement | null) => el && speak(el.dataset.bubTts ?? '', el.dataset.bubLang ?? '');
  return (
    <div
      ref={ref}
      // eslint-disable-next-line react/no-danger -- vom Renderer der Engine bereinigt (sanitize.ts); KaTeX-Ausgabe ohne `trust`
      dangerouslySetInnerHTML={{ __html: out }}
      onClick={(e: MouseEvent) => activate(speakerOf(e))}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = speakerOf(e);
        if (el) (e.preventDefault(), e.stopPropagation(), activate(el));
      }}
      {...(onInput ? { onInput } : {})}
    />
  );
}
