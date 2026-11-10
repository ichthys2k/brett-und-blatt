import { useEffect, useRef, useState } from 'react';
import { useActiveLook, useChosenRoom, useChosenTable, type RoomScene } from '../lib/look';
import { navigate, useRoute } from '../lib/router';
import {
  buildTavernGeometry,
  getHoveredStation,
  getLiveCamera,
  pickHotspot,
  projectPoint,
  roomPalette,
  setHoveredStation,
  setLiveCamera,
  shadeFaceColor,
  stationForRoute,
  stepCamera,
  subscribeHoveredStation,
  TAVERN_HOTSPOTS,
  type TavernHotspot,
  type TavernStationId,
} from '../lib/tavern3d';
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

interface Mote3D {
  x: number;
  y: number;
  z: number;
  speed: number;
}

const MOTES_3D: Mote3D[] = Array.from({ length: 22 }, (_, i) => ({
  x: -3.2 + ((i * 0.29) % 5.6),
  y: (i * 0.17) % 2.8,
  z: -2.4 + ((i * 0.41) % 4.0),
  speed: 0.0035 + (i % 4) * 0.0014,
}));

/**
 * Begehbare 3D-Taverne (#262, Stil A) mit Kamerafahrten zu den 5 Stationen:
 * - Im Hauptmenü (`calm = false`) Totale des Raums; Menü-Einträge und 3D-Objekte im Raum
 *   heben die jeweilige Station hervor und sind direkt anklickbar.
 * - Auf Unterseiten (`calm = true`) gleitet die Kamera fließend zur jeweiligen Station
 *   (Spieltisch, Online-Rundtisch, Turniertafel, Kamin oder Wappenschild).
 * - Bei `prefers-reduced-motion: reduce` oder im Aussehen „Schlicht“ steht die Szene still.
 */
export function TavernScene({ calm = false, station }: { calm?: boolean; station?: TavernStationId }) {
  const scene = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const route = useRoute();
  const room = useChosenRoom();
  const table = useChosenTable();
  const look = useActiveLook();
  const isTavern = room === 'tavern';
  const targetStation: TavernStationId = station ?? (calm ? stationForRoute(route.name) : 'home');
  const [spotLabel, setSpotLabel] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = scene.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || look === 'plain';
    const pointer = { x: 0, y: 0 };
    const smoothPointer = { x: 0, y: 0 };
    let localHover: TavernHotspot | null = null;
    let rafId = 0;
    let time = 0;

    const drawFrame = () => {
      time += reducedMotion ? 0 : 0.025;
      smoothPointer.x += (pointer.x - smoothPointer.x) * (reducedMotion ? 1 : 0.09);
      smoothPointer.y += (pointer.y - smoothPointer.y) * (reducedMotion ? 1 : 0.09);

      const nextCam = stepCamera(getLiveCamera(), targetStation, smoothPointer, reducedMotion);
      setLiveCamera(nextCam);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width || window.innerWidth || 800);
      const h = Math.max(1, rect.height || window.innerHeight || 600);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pal = roomPalette(room);
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, pal.bgTop);
      bgGrad.addColorStop(0.6, pal.bgMid);
      bgGrad.addColorStop(1, pal.bgBot);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const activeHighlight =
        getHoveredStation() ?? localHover?.id ?? (targetStation !== 'home' ? targetStation : null);

      const faces = buildTavernGeometry({ room, table, time });
      const projected: {
        pts: { x: number; y: number; z: number; scale: number }[];
        avgZ: number;
        fill: string;
        highlighted: boolean;
      }[] = [];

      for (const face of faces) {
        const p0 = projectPoint(face.verts[0], nextCam, w, h);
        const p1 = projectPoint(face.verts[1], nextCam, w, h);
        const p2 = projectPoint(face.verts[2], nextCam, w, h);
        const p3 = projectPoint(face.verts[3], nextCam, w, h);
        if (!p0 || !p1 || !p2 || !p3) continue;
        const pts = [p0, p1, p2, p3];
        const avgZ = (p0.z + p1.z + p2.z + p3.z) * 0.25;
        const highlighted = Boolean(face.station && face.station === activeHighlight);
        projected.push({
          pts,
          avgZ,
          fill: shadeFaceColor(face.color, face.verts, highlighted, face.emissive),
          highlighted,
        });
      }

      projected.sort((a, b) => b.avgZ - a.avgZ);

      for (const pf of projected) {
        ctx.beginPath();
        ctx.moveTo(pf.pts[0]!.x, pf.pts[0]!.y);
        for (let i = 1; i < pf.pts.length; i++) {
          ctx.lineTo(pf.pts[i]!.x, pf.pts[i]!.y);
        }
        ctx.closePath();
        ctx.fillStyle = pf.fill;
        ctx.fill();
        ctx.strokeStyle = pf.highlighted ? 'rgba(242, 210, 122, 0.85)' : 'rgba(0, 0, 0, 0.26)';
        ctx.lineWidth = pf.highlighted ? 1.6 : 0.9;
        ctx.stroke();
      }

      // Kamin-Lichtschein im 3D-Raum
      const fireScreen = projectPoint({ x: -2.7, y: 0.68, z: 0.65 }, nextCam, w, h);
      if (fireScreen) {
        const flicker = reducedMotion ? 1 : 0.88 + Math.sin(time * 3.4) * 0.12;
        const radius = Math.max(40, 175 * flicker);
        const g = ctx.createRadialGradient(fireScreen.x, fireScreen.y, 4, fireScreen.x, fireScreen.y, radius);
        g.addColorStop(0, 'rgba(255, 165, 65, 0.38)');
        g.addColorStop(0.5, 'rgba(255, 105, 25, 0.14)');
        g.addColorStop(1, 'rgba(255, 90, 10, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Im Hauptmenü: Dezente 3D-Stationspunkte für direkte Klicks im Raum
      if (!calm) {
        for (const spot of TAVERN_HOTSPOTS) {
          const sp = projectPoint(spot.pos, nextCam, w, h);
          if (!sp) continue;
          const isHot = activeHighlight === spot.id;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, isHot ? 9.5 : 6, 0, Math.PI * 2);
          ctx.fillStyle = isHot ? 'rgba(242, 210, 122, 0.95)' : 'rgba(242, 210, 122, 0.42)';
          ctx.fill();
          ctx.strokeStyle = '#2a1c0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Schwebende Glutfunken im 3D-Raum
      if (!reducedMotion && !calm) {
        for (const m of MOTES_3D) {
          m.y += m.speed;
          if (m.y > 2.9) m.y = 0.12;
          const mp = projectPoint(m, nextCam, w, h);
          if (mp) {
            ctx.beginPath();
            ctx.arc(mp.x, mp.y, Math.max(1.1, Math.min(3.2, mp.scale * 0.014)), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 210, 122, 0.76)';
            ctx.fill();
          }
        }
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const mx = event.clientX / Math.max(1, window.innerWidth) - 0.5;
      const my = event.clientY / Math.max(1, window.innerHeight) - 0.5;
      pointer.x = mx;
      pointer.y = my;
      if (!calm && !reducedMotion) {
        el.style.setProperty('--mx', String(mx));
        el.style.setProperty('--my', String(my));
        const parentMenu = el.closest<HTMLElement>('.bub-menu');
        if (parentMenu) {
          parentMenu.style.setProperty('--mx', String(mx));
          parentMenu.style.setProperty('--my', String(my));
        }
      }
      if (!calm && window.innerWidth > 760) {
        const rect = canvas.getBoundingClientRect();
        const cx = event.clientX - rect.left;
        const cy = event.clientY - rect.top;
        // Rechts liegt der Menürahmen – Hotspots nur im freien linken/mittleren Bereich prüfen
        const overMenu = event.target instanceof Element && Boolean(event.target.closest('.bub-menu-frame, .bub-menu-plaque'));
        const hit = overMenu ? null : pickHotspot(cx, cy, getLiveCamera(), rect.width || window.innerWidth, rect.height || window.innerHeight);
        localHover = hit;
        if (hit) {
          const p = projectPoint(hit.pos, getLiveCamera(), rect.width || window.innerWidth, rect.height || window.innerHeight);
          setSpotLabel(p ? { text: hit.label, x: p.x, y: p.y } : null);
        } else {
          setSpotLabel(null);
        }
      }
    };

    const onClick = (event: MouseEvent) => {
      if (calm || window.innerWidth <= 760) return;
      const overInteractive =
        event.target instanceof Element &&
        Boolean(event.target.closest('button, a, nav, footer, .bub-menu-frame, .bub-menu-plaque'));
      if (overInteractive) return;
      const rect = canvas.getBoundingClientRect();
      const hit = pickHotspot(
        event.clientX - rect.left,
        event.clientY - rect.top,
        getLiveCamera(),
        rect.width || window.innerWidth,
        rect.height || window.innerHeight,
      );
      if (hit) {
        setHoveredStation( null);
        navigate(hit.to);
      }
    };

    const unsubHover = subscribeHoveredStation(() => {
      if (reducedMotion) drawFrame();
    });

    drawFrame();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('click', onClick);
    const onResize = () => {
      if (reducedMotion) drawFrame();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      unsubHover();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
    };
  }, [calm, look, room, table, targetStation]);

  return (
    <div
      className="bub-menu-scene"
      ref={scene}
      aria-hidden="true"
      data-calm={calm || undefined}
      data-room={room}
      data-station={targetStation}
      data-clickable={spotLabel ? 'true' : undefined}
    >
      {/* Rückfall-Bildschicht (falls Canvas deaktiviert ist oder auf sehr schmalen Ansichten) */}
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

      {/* Stilisierte 3D-Tavernen-Bühne (Stil A, #262) */}
      <canvas ref={canvasRef} className="bub-menu-canvas" />

      <div className="bub-menu-layer bub-menu-glow" />
      {isTavern && <div className="bub-menu-layer bub-menu-hearth" />}
      {calm ? null : (
        <div className="bub-menu-layer bub-menu-motes">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 37) % 97}%`,
                animationDelay: `${(i * 1.7) % 9}s`,
                animationDuration: `${9 + (i % 5) * 2}s`,
              }}
            />
          ))}
        </div>
      )}
      {calm || !isTavern ? null : (
        <div className="bub-menu-layer bub-menu-front">
          <img src={front} alt="" draggable={false} />
        </div>
      )}
      {!calm && spotLabel && (
        <div
          className="bub-menu-hotspot-label"
          style={{ left: `${spotLabel.x}px`, top: `${spotLabel.y - 16}px` }}
        >
          {spotLabel.text}
        </div>
      )}
      <div className="bub-menu-shade" />
    </div>
  );
}
