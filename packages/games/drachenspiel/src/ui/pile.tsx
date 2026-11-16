import { CardBack, useCardCosmetics } from '@brett-und-blatt/ui';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Höchstens so viele Karten fliegen auf einmal; mehr (Starthand) erscheinen ohne Flug. */
const MAX_FLIGHTS = 3;

/** Eine gezogene Karte: hebt sich vom Stapel, kippt leicht und gleitet zur Hand. */
function Flight({ from, to, delay, onDone }: { from: DOMRect; to: DOMRect | null; delay: number; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cosmetics = useCardCosmetics();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') {
      onDone();
      return;
    }
    const dx = to ? to.left + to.width / 2 - (from.left + from.width / 2) : 0;
    const dy = to ? to.top + to.height / 2 - (from.top + from.height / 2) : from.height * 2;
    const scale = to ? to.width / from.width : 1.2;
    const animation = el.animate(
      [
        { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)', filter: 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.4))', opacity: 1, offset: 0 },
        // Die oberste Karte hebt sich ab: höher, leicht verdreht, mit größerem Schatten.
        { transform: `translate3d(${dx * 0.04}px,${-from.height * 0.28}px,0) rotate(-5deg) scale(1.1)`, filter: 'drop-shadow(0 10px 8px rgb(0 0 0 / 0.45))', opacity: 1, offset: 0.28 },
        { transform: `translate3d(${dx * 0.7}px,${dy * 0.6 - from.height * 0.15}px,0) rotate(4deg) scale(${1 + (scale - 1) * 0.7})`, filter: 'drop-shadow(0 12px 10px rgb(0 0 0 / 0.4))', opacity: 1, offset: 0.7 },
        { transform: `translate3d(${dx}px,${dy}px,0) rotate(0deg) scale(${scale})`, filter: 'drop-shadow(0 2px 3px rgb(0 0 0 / 0.4))', opacity: 0.9, offset: 1 },
      ],
      { duration: 560, delay, easing: 'cubic-bezier(0.3, 0.1, 0.25, 1)', fill: 'both' },
    );
    animation.onfinish = onDone;
    // Beim Aufräumen (auch im Entwicklungsmodus doppelt) nur abbrechen, nicht die Karte entfernen.
    return () => {
      animation.onfinish = null;
      animation.cancel();
    };
    // Der Flug wird nur einmal gestartet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return createPortal(
    <div
      ref={ref}
      className="ds-pile-flight"
      aria-hidden="true"
      style={{ left: from.left, top: from.top, width: from.width, height: from.height }}
    >
      <CardBack design={cosmetics.cardBack} crest={cosmetics.crest} />
    </div>,
    document.body,
  );
}

/** Nachziehstapel als echter Stapel aus Kartenrücken; gezogene Karten fliegen sichtbar zur Hand. */
export function DeckPile({ count, handTarget, reducedMotion }: { count: number; handTarget: () => HTMLElement | null; reducedMotion: boolean }) {
  const cosmetics = useCardCosmetics();
  const pileRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(count);
  const nextId = useRef(0);
  const [flights, setFlights] = useState<{ id: number; from: DOMRect; to: DOMRect | null; delay: number }[]>([]);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = count;
    const drawn = before - count;
    const pile = pileRef.current;
    if (drawn <= 0 || drawn > MAX_FLIGHTS || reducedMotion || !pile) return;
    const from = pile.getBoundingClientRect();
    const to = handTarget()?.getBoundingClientRect() ?? null;
    setFlights((list) => [...list, ...Array.from({ length: drawn }, (_, i) => ({ id: nextId.current++, from, to, delay: i * 140 }))]);
  }, [count, handTarget, reducedMotion]);

  // Je etwa 6 Karten eine sichtbare Lage, höchstens 6.
  const layers = count <= 0 ? 0 : Math.min(6, Math.ceil(count / 6));
  return (
    <>
      <span ref={pileRef} className="ds-pile" role="img" aria-label={`Dein Nachziehstapel: ${count} ${count === 1 ? 'Karte' : 'Karten'}`}>
        {layers === 0 && <span className="ds-pile-empty" />}
        {Array.from({ length: layers }, (_, i) => (
          <span key={i} className="ds-pile-layer" style={{ transform: `translate(${-i * 1.2}px, ${-i * 1.8}px)` }}>
            <CardBack design={cosmetics.cardBack} crest={cosmetics.crest} />
          </span>
        ))}
        <span className="ds-pile-count">{count}</span>
      </span>
      {flights.map((f) => (
        <Flight key={f.id} from={f.from} to={f.to} delay={f.delay} onDone={() => setFlights((list) => list.filter((x) => x.id !== f.id))} />
      ))}
    </>
  );
}
