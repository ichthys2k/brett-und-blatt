import { useEffect, useRef, type CSSProperties } from 'react';
import behind from '../menu/taverne-hinten.webp';
import portrait from '../menu/taverne-hoch.webp';
import front from '../menu/taverne-vorn.webp';

/**
 * Szene der Taverne (#191): gemaltes Bild in zwei Ebenen (Raum hinten, Tisch vorn) mit leichter
 * Parallaxe, dazu Lichteffekte aus CSS auf der Bildbühne (flackernde Lampen, brennendes Feuer, aufsteigende Funken). Auf schmalen Bildschirmen und
 * bei „Bewegung reduzieren“ steht das Hochformat-Bild still. `calm` zeigt nur den Raum, dunkler (Unterseiten).
 */
export function TavernScene({ calm = false }: { calm?: boolean }) {
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scene.current;
    if (!el || calm || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (event: PointerEvent) => {
      el.style.setProperty('--mx', String(event.clientX / window.innerWidth - 0.5));
      el.style.setProperty('--my', String(event.clientY / window.innerHeight - 0.5));
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [calm]);

  return (
    <div className="bub-menu-scene" ref={scene} aria-hidden="true" data-calm={calm || undefined}>
      <div className="bub-menu-layer bub-menu-back">
        <div className="bub-menu-stage">
          <picture>
            <source media="(max-width: 760px)" srcSet={portrait} />
            <img src={behind} alt="" draggable={false} />
          </picture>
          <span className="bub-menu-lamp" data-n="1" />
          <span className="bub-menu-lamp" data-n="2" />
          <span className="bub-menu-lamp" data-n="3" />
          <span className="bub-menu-fire" />
          {calm ? null : (
            <span className="bub-menu-sparks">
              {SPARKS.map((spark, i) => (
                <i key={i} style={spark} />
              ))}
            </span>
          )}
        </div>
      </div>
      {calm ? null : (
        <div className="bub-menu-layer bub-menu-front">
          <div className="bub-menu-stage" data-front>
            <img src={front} alt="" draggable={false} />
          </div>
        </div>
      )}
      <div className="bub-menu-shade" />
    </div>
  );
}

/** Funken über dem Kamin: feste, scheinbar zufällige Werte je Funke (Aufstieg, Abdrift, Größe, Takt). */
const SPARKS: CSSProperties[] = Array.from({ length: 16 }, (_, i) => {
  const r = (n: number) => ((i * 7919 + n * 104729) % 1000) / 1000;
  return {
    '--ox': `${(r(1) - 0.5) * 5}%`,
    '--dx': `${(r(2) - 0.35) * 9}cqw`,
    '--rise': `${14 + r(3) * 26}`,
    '--size': `${2 + r(4) * 3}px`,
    animationDuration: `${2.2 + r(5) * 2.8}s`,
    animationDelay: `-${r(6) * 6}s`,
  } as CSSProperties;
});
