import { useEffect, useRef, useState } from 'react';
import { StationEditor } from './StationEditor';
import { useActiveLook, useChosenLight, useChosenRoom, useChosenTable, useMenu3d, type RoomScene, type TavernMood } from '../lib/look';
import { navigate, useRoute } from '../lib/router';
import {
  buildTavernGeometry,
  getHoveredStation,
  getLiveCamera,
  pickHotspot,
  projectPoint,
  moodAt,
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
import portrait from '../menu/taverne-hoch.webp';

/** Leerer Tavernenraum für die Stationen im Querformat (#454, Option B); Hochformat bleibt unten unverändert. */
const MOOD_LEER: Record<TavernMood, string> = {
  morgen: new URL('../menu/taverne-leer-morgen.webp', import.meta.url).href,
  tag: new URL('../menu/taverne-leer-tag.webp', import.meta.url).href,
  abend: new URL('../menu/taverne-leer-abend.webp', import.meta.url).href,
  nacht: new URL('../menu/taverne-leer-nacht.webp', import.meta.url).href,
  winter: new URL('../menu/taverne-leer-winter.webp', import.meta.url).href,
  fest: new URL('../menu/taverne-leer-fest.webp', import.meta.url).href,
};

/** Dieselben Stimmungen im Hochformat für schmale Ansichten (Handys). */
const MOOD_PORTRAITS: Record<TavernMood, string> = {
  morgen: new URL('../menu/taverne-hoch-morgen.webp', import.meta.url).href,
  tag: new URL('../menu/taverne-hoch-tag.webp', import.meta.url).href,
  abend: portrait,
  nacht: new URL('../menu/taverne-hoch-nacht.webp', import.meta.url).href,
  winter: new URL('../menu/taverne-hoch-winter.webp', import.meta.url).href,
  fest: new URL('../menu/taverne-hoch-fest.webp', import.meta.url).href,
};

/** Gemalte Stationen im Raum (#317, freigestellt); Größe in Metern, die Beschriftung liefert der Hotspot. */
const STATION_SPRITES: Record<string, { url: string; size: number }> = {
  single: { url: new URL('../menu/stationen/single.webp', import.meta.url).href, size: 0.9 },
  online: { url: new URL('../menu/stationen/online.webp', import.meta.url).href, size: 1.1 },
  tournaments: { url: new URL('../menu/stationen/tournaments.webp', import.meta.url).href, size: 1.0 },
  options: { url: new URL('../menu/stationen/options.webp', import.meta.url).href, size: 1.2 },
  profile: { url: new URL('../menu/stationen/profile.webp', import.meta.url).href, size: 0.9 },
  board: { url: new URL('../menu/stationen/board.webp', import.meta.url).href, size: 1.0 },
  learn: { url: new URL('../menu/stationen/learn.webp', import.meta.url).href, size: 0.8 },
};
interface Station2D {
  id: Exclude<TavernStationId, 'home'>;
  label: string;
  to: string;
  /** Mittelpunkt und Breite in Prozent der Bildbreite (Bild 1376 × 768). */
  x: number;
  y: number;
  w: number;
}

/**
 * Stationen im leeren 2D-Tavernenraum (#454): freigestellte Einzelbilder, per Prozent auf dem Bild
 * verankert (die Bühne `bub-menu-stage` folgt dem Zuschnitt des Bildes). Der Kamin steht links an der Wand.
 */
const STATIONS_2D: readonly Station2D[] = [
  { id: 'options', label: '🔥 Optionen', to: '#/ton', x: 13.6, y: 58.5, w: 28.4 },
  { id: 'board', label: '📌 Schwarzes Brett', to: '#/brett', x: 77.8, y: 72.6, w: 22.1 },
  { id: 'profile', label: '🛡️ Profil & Pass', to: '#/pass', x: 76.8, y: 39.3, w: 21.3 },
  { id: 'learn', label: '🗂️ Lernen', to: '#/lernen', x: 42.3, y: 61.8, w: 6.2 },
  { id: 'tournaments', label: '🏆 Turniere', to: '#/turniere', x: 29.6, y: 58.1, w: 16.4 },
  { id: 'online', label: '🌐 Online Spiel', to: '#/online', x: 47.5, y: 66, w: 15.1 },
  { id: 'single', label: '♟️ Lokales Spiel', to: '#/einzelspieler', x: 39.4, y: 81.7, w: 26 },
];
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
 * - Bei `prefers-reduced-motion: reduce` steht die 3D-Bühne still.
 *
 * Die 3D-Bühne gibt es nur, wenn „3D-Taverne im Hauptmenü“ eingeschaltet ist und das Aussehen
 * „Taverne“ gilt. Sonst zeigt die Szene allein das gemalte Bild der Lichtstimmung bzw. der
 * Raumkulisse – beide Ebenen liegen nie übereinander (sonst mischen sich 2D und 3D).
 */
export function TavernScene({ calm = false, station }: { calm?: boolean; station?: TavernStationId }) {
  const scene = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const route = useRoute();
  const room = useChosenRoom();
  const table = useChosenTable();
  const look = useActiveLook();
  const menu3d = useMenu3d();
  const use3d = menu3d && look === 'tavern';
  const light = useChosenLight();
  const mood: TavernMood = light === 'auto' ? moodAt(new Date()) : light;
  const isTavern = room === 'tavern';
  const targetStation: TavernStationId = station ?? (calm ? stationForRoute(route.name) : 'home');
  const [spotLabel, setSpotLabel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [hoveredStation, setLocalHoveredStation] = useState<TavernStationId | null>(() => getHoveredStation());
  // Bearbeitungsmodus (nur Dev-Server, ?stationen): Positionen mit der Maus setzen, im Browser gemerkt.
  const editMode = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('stationen');
  const [layout, setLayout] = useState<Station2D[]>(() => {
    if (!editMode) return [...STATIONS_2D];
    try {
      const saved = JSON.parse(localStorage.getItem('bub-station-layout') ?? 'null') as Station2D[] | null;
      if (saved && saved.length === STATIONS_2D.length) return saved;
    } catch {
      /* ohne gespeicherten Stand starten */
    }
    return [...STATIONS_2D];
  });
  useEffect(() => {
    if (!editMode) return;
    try {
      localStorage.setItem('bub-station-layout', JSON.stringify(layout));
    } catch {
      /* Speichern ist nur eine Bequemlichkeit */
    }
  }, [editMode, layout]);
  const activeStation = layout.find((st) => st.id === hoveredStation);

  useEffect(() => {
    setLocalHoveredStation(getHoveredStation());
    return subscribeHoveredStation(() => setLocalHoveredStation(getHoveredStation()));
  }, []);

  // 2D-Parallax auch ohne 3D-Bühne (#454)
  useEffect(() => {
    const el = scene.current;
    if (use3d || calm || !el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onPointerMove = (event: PointerEvent) => {
      const mx = event.clientX / Math.max(1, window.innerWidth) - 0.5;
      const my = event.clientY / Math.max(1, window.innerHeight) - 0.5;
      el.style.setProperty('--mx', String(mx));
      el.style.setProperty('--my', String(my));
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [use3d, calm]);

  useEffect(() => {
    const el = scene.current;
    const canvas = canvasRef.current;
    if (!use3d || !el || !canvas) {
      setSpotLabel(null);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: 0, y: 0 };
    const smoothPointer = { x: 0, y: 0 };
    let localHover: TavernHotspot | null = null;
    let rafId = 0;
    let time = 0;

    // Gemalte Stationen; bis ein Bild geladen ist, bleibt der gelbe Punkt.
    const sprites = new Map<string, HTMLImageElement>();
    for (const [id, sprite] of Object.entries(STATION_SPRITES)) {
      const img = new Image();
      img.onload = () => {
        if (reducedMotion) drawFrame();
      };
      img.src = sprite.url;
      sprites.set(id, img);
    }

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

      const pal = roomPalette(room, mood);
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, pal.bgTop);
      bgGrad.addColorStop(0.6, pal.bgMid);
      bgGrad.addColorStop(1, pal.bgBot);
      // Deckender Grund in den Farben der Lichtstimmung: Das gemalte Bild liegt nicht darunter.
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
          const sprite = sprites.get(spot.id);
          if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            const size = (STATION_SPRITES[spot.id]?.size ?? 0.9) * sp.scale * (isHot ? 1.12 : 1);
            if (isHot) {
              const glow = ctx.createRadialGradient(sp.x, sp.y, size * 0.1, sp.x, sp.y, size * 0.75);
              glow.addColorStop(0, 'rgba(242, 210, 122, 0.55)');
              glow.addColorStop(1, 'rgba(242, 210, 122, 0)');
              ctx.fillStyle = glow;
              ctx.fillRect(sp.x - size, sp.y - size, size * 2, size * 2);
            }
            ctx.drawImage(sprite, sp.x - size / 2, sp.y - size / 2, size, size);
            continue;
          }
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
  }, [use3d, calm, room, table, targetStation, mood]);

  return (
    <div
      className="bub-menu-scene"
      ref={scene}
      aria-hidden="true"
      data-calm={calm || undefined}
      data-room={room}
      data-mode={use3d ? '3d' : 'bild'}
      data-station={targetStation}
      data-clickable={spotLabel ? 'true' : undefined}
    >
      {use3d ? (
        /* Stilisierte 3D-Tavernen-Bühne (Stil A, #262) */
        <canvas ref={canvasRef} className="bub-menu-canvas" />
      ) : (
        <>
          {/* Gemaltes Standbild: Lichtstimmung (#317) bzw. Raumkulisse (#107) */}
          <div className="bub-menu-layer bub-menu-back">
            {isTavern ? (
              <picture>
                <source media="(max-width: 760px)" srcSet={MOOD_PORTRAITS[mood]} />
                <img src={MOOD_LEER[mood]} alt="" draggable={false} />
              </picture>
            ) : (
              <img src={ROOM_IMAGES[room]} alt="" draggable={false} />
            )}
          </div>
          <div className="bub-menu-layer bub-menu-glow" />
          {isTavern && <div className="bub-menu-layer bub-menu-hearth" />}
          {!calm && isTavern && (
            <div className="bub-menu-layer bub-menu-stations">
              <div className="bub-menu-stage">
                {!editMode && layout.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    tabIndex={-1}
                    className="bub-menu-station"
                    data-station={st.id}
                    data-hot={hoveredStation === st.id ? 'true' : undefined}
                    style={{ left: `${st.x}%`, top: `${st.y}%`, width: `${st.w}%` }}
                    onMouseEnter={() => setHoveredStation(st.id)}
                    onMouseLeave={() => setHoveredStation(null)}
                    onClick={() => {
                      setHoveredStation(null);
                      navigate(st.to);
                    }}
                  >
                    <img src={STATION_SPRITES[st.id]?.url} alt="" draggable={false} />
                  </button>
                ))}
                {activeStation && (
                  <div
                    className="bub-menu-hotspot-label"
                    style={{ left: `${activeStation.x}%`, top: `${activeStation.y - activeStation.w * 0.9}%` }}
                  >
                    {activeStation.label}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
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
      {editMode && !calm && isTavern && !use3d && (
        <StationEditor
          stations={layout}
          onChange={(next) => setLayout(next as Station2D[])}
          onReset={() => setLayout([...STATIONS_2D])}
          spriteUrl={(id) => STATION_SPRITES[id]?.url}
        />
      )}
    </div>
  );
}
