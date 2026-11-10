import { useEffect, useRef } from 'react';
import { useChosenRoom, type RoomScene } from '../lib/look';
import behind from '../menu/taverne-hinten.webp';
import portrait from '../menu/taverne-hoch.webp';
import front from '../menu/taverne-vorn.webp';
import castle from '../assets/raeume/burgsaal.webp';
import library from '../assets/raeume/bibliothek.webp';
import garden from '../assets/raeume/schlossgarten.webp';

const ROOM_IMAGES: Record<Exclude<RoomScene, 'tavern'>, string> = {
  castle,
  library,
  garden,
};

/**
 * Szene der Taverne (#191) bzw. des gewählten Raums (#107): im Standardraum „Taverne“ gemaltes Bild
 * in zwei Ebenen (Raum hinten, Tisch vorn) mit leichter Parallaxe, dazu Lichtschichten aus CSS
 * (Laternen, Kaminglut, Funken). Auf schmalen Bildschirmen und bei „Bewegung reduzieren“ steht das
 * Hochformat-Bild still. `calm` zeigt nur den Raum, dunkler (Unterseiten).
 * Ist ein anderer Raum gewählt (Burgsaal, Bibliothek, Schlossgarten), erscheint dessen gemalte Kulisse.
 */
export function TavernScene({ calm = false }: { calm?: boolean }) {
  const scene = useRef<HTMLDivElement>(null);
  const room = useChosenRoom();
  const isTavern = room === 'tavern';

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
    <div className="bub-menu-scene" ref={scene} aria-hidden="true" data-calm={calm || undefined} data-room={room}>
      <div className="bub-menu-layer bub-menu-back">
        {isTavern ? (
          <picture>
            <source media="(max-width: 760px)" srcSet={portrait} />
            <img src={behind} alt="" draggable={false} />
          </picture>
        ) : (
          <img src={ROOM_IMAGES[room]} alt="" draggable={false} />
        )}
      </div>
      <div className="bub-menu-layer bub-menu-glow" />
      {isTavern && <div className="bub-menu-layer bub-menu-hearth" />}
      {calm ? null : (
        <div className="bub-menu-layer bub-menu-motes">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 97}%`, animationDelay: `${(i * 1.7) % 9}s`, animationDuration: `${9 + (i % 5) * 2}s` }} />
          ))}
        </div>
      )}
      {calm || !isTavern ? null : (
        <div className="bub-menu-layer bub-menu-front">
          <img src={front} alt="" draggable={false} />
        </div>
      )}
      <div className="bub-menu-shade" />
    </div>
  );
}
