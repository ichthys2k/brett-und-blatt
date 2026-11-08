import { useEffect, useRef } from 'react';
import behind from '../menu/taverne-hinten.webp';
import portrait from '../menu/taverne-hoch.webp';
import front from '../menu/taverne-vorn.webp';

/**
 * Szene der Taverne (#191): gemaltes Bild in zwei Ebenen (Raum hinten, Tisch vorn) mit leichter
 * Parallaxe, dazu Lichtschichten aus CSS (Laternen, Kaminglut, Funken). Auf schmalen Bildschirmen und
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
        <picture>
          <source media="(max-width: 760px)" srcSet={portrait} />
          <img src={behind} alt="" draggable={false} />
        </picture>
      </div>
      <div className="bub-menu-layer bub-menu-glow" />
      <div className="bub-menu-layer bub-menu-hearth" />
      {calm ? null : (
        <div className="bub-menu-layer bub-menu-motes">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 97}%`, animationDelay: `${(i * 1.7) % 9}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
          ))}
        </div>
      )}
      {calm ? null : (
        <div className="bub-menu-layer bub-menu-front">
          <img src={front} alt="" draggable={false} />
        </div>
      )}
      <div className="bub-menu-shade" />
    </div>
  );
}
