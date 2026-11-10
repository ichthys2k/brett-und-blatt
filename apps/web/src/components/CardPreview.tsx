import { CARD_SCOPE, renderCard, type AnkiCollection, type AnkiNote } from '@brett-und-blatt/engine';
import { useMemo, useState } from 'react';

/*
 * Vorder- und Rückseite einer Karte (#101, L4). Der Renderer der Engine liefert bereinigtes HTML und CSS, das auf die Karte beschränkt ist;
 * hier wird es nur eingesetzt. Skripte aus Vorlagen laufen nie.
 */

// Vorgabe wie in Anki; das CSS des Notiztyps steht danach und überschreibt sie.
export const CARD_BASE_CSS = `${CARD_SCOPE} { overflow: auto; contain: layout paint; border-radius: 12px; padding: 16px; min-height: 5rem; text-align: center; background: #fff; color: #000; font-family: arial; font-size: 20px; }\n${CARD_SCOPE} img { max-width: 100%; height: auto; }\n${CARD_SCOPE} .bub-error { color: #b00020; }\n${CARD_SCOPE} .typeGood { background: #afa; }\n${CARD_SCOPE} .typeBad { color: #000; background: #faa; }\n${CARD_SCOPE} .typeMissed { color: #000; background: #ccc; }\n${CARD_SCOPE} .bub-typeans { width: 100%; font-size: inherit; box-sizing: border-box; }`;

export function CardPreview({ collection, note, ord, media, label }: { collection: AnkiCollection; note: AnkiNote; ord: number; media: (name: string) => string | null; label?: string }) {
  const [typed, setTyped] = useState('');
  const [side, setSide] = useState<'question' | 'answer'>('question');
  const card = useMemo(() => renderCard(collection, note, ord, { media, typed: side === 'answer' ? typed : undefined }), [collection, note, ord, media, side, typed]);
  return (
    <figure className="space-y-2">
      {label && <figcaption className="text-sm font-medium">{label}</figcaption>}
      <style>{`${CARD_BASE_CSS}\n${card.css}`}</style>
      <div className={CARD_SCOPE.slice(1)} data-side={side}>
        <div
          // eslint-disable-next-line react/no-danger -- vom Renderer der Engine bereinigt (sanitize.ts)
          dangerouslySetInnerHTML={{ __html: side === 'question' ? card.question : card.answer }}
          onInput={(e) => {
            const t = e.target as HTMLInputElement;
            if (t.classList?.contains('bub-typeans')) setTyped(t.value);
          }}
        />
      </div>
      {card.errors.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-danger" aria-label="Fehler in der Vorlage">
          {card.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button type="button" className="min-h-11 rounded-xl border border-line px-4 text-sm" aria-pressed={side === 'question'} onClick={() => setSide('question')}>
          Vorderseite
        </button>
        <button type="button" className="min-h-11 rounded-xl border border-line px-4 text-sm" aria-pressed={side === 'answer'} onClick={() => setSide('answer')}>
          Rückseite
        </button>
      </div>
    </figure>
  );
}
