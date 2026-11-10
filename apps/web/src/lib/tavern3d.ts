import type { RoomScene, TableSurface } from './look';
import type { Route } from './router';

/**
 * Begehbare 3D-Taverne (Stil A: stilisierte 3D-Geometrie mit Echtzeit-Licht, #262).
 *
 * Reine Geometrie-, Kamera- und Projektionslogik ohne DOM-Abhängigkeit, damit
 * Stationen, Kamerafahrten, Lichtberechnung und Hotspot-Auswahl in Vitest
 * direkt prüfbar sind und der Canvas-Zustand über Routenwechsel hinweg erhalten bleibt.
 */

export type TavernStationId = 'home' | 'single' | 'online' | 'tournaments' | 'options' | 'profile';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  z: number;
  scale: number;
}

export interface TavernHotspot {
  id: Exclude<TavernStationId, 'home'>;
  label: string;
  to: string;
  pos: Vec3;
  radius: number;
}

export interface Face3D {
  verts: readonly [Vec3, Vec3, Vec3, Vec3];
  color: string;
  station?: Exclude<TavernStationId, 'home'>;
  emissive?: boolean;
}

/** Kamera-Positionen für die Totale (`home`) und die 5 Stationen im Raum. */
export const STATION_CAMERAS: Record<TavernStationId, CameraPose> = {
  home: { x: -0.15, y: 1.78, z: -6.35, yaw: -0.12, pitch: 0.16 },
  single: { x: -0.35, y: 1.38, z: -3.15, yaw: 0.3, pitch: 0.42 },
  online: { x: 0.42, y: 1.46, z: -2.95, yaw: -0.36, pitch: 0.31 },
  tournaments: { x: -0.55, y: 1.86, z: -2.65, yaw: 0.2, pitch: 0.06 },
  options: { x: -1.78, y: 1.32, z: -2.85, yaw: 0.54, pitch: 0.12 },
  profile: { x: -1.68, y: 2.18, z: -2.75, yaw: 0.5, pitch: -0.06 },
};

/** Anklickbare 3D-Stationen im Raum (für das Hauptmenü `#/`). */
export const TAVERN_HOTSPOTS: readonly TavernHotspot[] = [
  { id: 'single', label: '♟️ Lokales Spiel', to: '#/einzelspieler', pos: { x: -0.95, y: 0.96, z: -1.45 }, radius: 42 },
  { id: 'online', label: '🌐 Online Spiel', to: '#/online', pos: { x: 1.25, y: 0.98, z: 0.1 }, radius: 40 },
  { id: 'tournaments', label: '🏆 Turniere', to: '#/turniere', pos: { x: -1.05, y: 1.95, z: 1.45 }, radius: 42 },
  { id: 'options', label: '🔥 Optionen', to: '#/ton', pos: { x: -2.85, y: 1.0, z: 0.65 }, radius: 40 },
  { id: 'profile', label: '🛡️ Profil & Pass', to: '#/pass', pos: { x: -2.75, y: 2.25, z: 0.65 }, radius: 36 },
];

/** Ordnet jeder Route die passende 3D-Kamerastation zu. */
export function stationForRoute(routeName: Route['name']): TavernStationId {
  switch (routeName) {
    case 'menu':
      return 'home';
    case 'home':
    case 'setup':
      return 'single';
    case 'online':
    case 'classes':
    case 'class':
    case 'orgs':
    case 'org':
      return 'online';
    case 'tournaments':
    case 'tournament':
    case 'series':
      return 'tournaments';
    case 'sound':
    case 'imprint':
    case 'privacy':
    case 'operator':
      return 'options';
    case 'pass':
    case 'passView':
    case 'account':
    case 'library':
    case 'packView':
      return 'profile';
    default:
      return 'home';
  }
}

/**
 * Modulweiter Kamerazustand: bleibt beim Wechsel zwischen `Menu` und `TavernPage`
 * erhalten, sodass die Kamera ohne Sprung von der bisherigen Position weiterfährt.
 */
let liveCamera: CameraPose = { ...STATION_CAMERAS.home };
let hoveredMenuStation: Exclude<TavernStationId, 'home'> | null = null;
const hoverListeners = new Set<() => void>();

export function getLiveCamera(): CameraPose {
  return liveCamera;
}

export function setLiveCamera(next: CameraPose): void {
  liveCamera = { ...next };
}

export function setHoveredStation(station: Exclude<TavernStationId, 'home'> | null): void {
  if (hoveredMenuStation === station) return;
  hoveredMenuStation = station;
  for (const fn of hoverListeners) fn();
}

export function getHoveredStation(): Exclude<TavernStationId, 'home'> | null {
  return hoveredMenuStation;
}

export function subscribeHoveredStation(fn: () => void): () => void {
  hoverListeners.add(fn);
  return () => hoverListeners.delete(fn);
}

/** Bewegt die Kamera weich in Richtung der Zielstation (oder springt sofort bei `reducedMotion`). */
export function stepCamera(
  current: CameraPose,
  targetStation: TavernStationId,
  pointer: { x: number; y: number },
  reducedMotion: boolean,
  alpha = 0.08,
): CameraPose {
  const base = STATION_CAMERAS[targetStation];
  if (reducedMotion) {
    return { ...base };
  }
  const parallax = targetStation === 'home' ? 1 : 0.45;
  const goalX = base.x + pointer.x * 0.48 * parallax;
  const goalY = base.y - pointer.y * 0.26 * parallax;
  const goalYaw = base.yaw + pointer.x * 0.11 * parallax;
  const goalPitch = base.pitch + pointer.y * 0.075 * parallax;

  return {
    x: current.x + (goalX - current.x) * alpha,
    y: current.y + (goalY - current.y) * alpha,
    z: current.z + (base.z - current.z) * alpha,
    yaw: current.yaw + (goalYaw - current.yaw) * alpha,
    pitch: current.pitch + (goalPitch - current.pitch) * alpha,
  };
}

/** Projiziert einen 3D-Punkt im Raum auf die 2D-Bühne. */
export function projectPoint(pt: Vec3, cam: CameraPose, width: number, height: number): ProjectedPoint | null {
  const dx = pt.x - cam.x;
  const dy = pt.y - cam.y;
  const dz = pt.z - cam.z;

  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const x1 = dx * cy - dz * sy;
  const z1 = dx * sy + dz * cy;

  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const y2 = dy * cp - z1 * sp;
  const z2 = dy * sp + z1 * cp;

  if (z2 <= 0.25) return null;
  const fov = Math.min(width, height) * 0.96;
  const scale = fov / z2;
  return {
    x: width * 0.42 + x1 * scale,
    y: height * 0.54 - y2 * scale,
    z: z2,
    scale,
  };
}

/** Prüft, ob ein Zeigerklick/Hover im Hauptmenü eine der 5 Stationen im Raum trifft. */
export function pickHotspot(
  mx: number,
  my: number,
  cam: CameraPose,
  width: number,
  height: number,
): TavernHotspot | null {
  let best: TavernHotspot | null = null;
  let bestDist = Infinity;
  for (const spot of TAVERN_HOTSPOTS) {
    const p = projectPoint(spot.pos, cam, width, height);
    if (!p) continue;
    const d = Math.hypot(mx - p.x, my - p.y);
    if (d <= spot.radius && d < bestDist) {
      best = spot;
      bestDist = d;
    }
  }
  return best;
}

interface Palette {
  bgTop: string;
  bgMid: string;
  bgBot: string;
  floorA: string;
  floorB: string;
  wall: string;
  beam: string;
  hearthStone: string;
  banner: string;
}

const ROOM_PALETTES: Record<RoomScene, Palette> = {
  tavern: {
    bgTop: '#24160c',
    bgMid: '#170e08',
    bgBot: '#0f0905',
    floorA: '#2c1c11',
    floorB: '#23160c',
    wall: '#312116',
    beam: '#2b1b10',
    hearthStone: '#433124',
    banner: '#8a3324',
  },
  castle: {
    bgTop: '#1b2028',
    bgMid: '#13171d',
    bgBot: '#0b0e12',
    floorA: '#282d35',
    floorB: '#20242b',
    wall: '#323842',
    beam: '#252a32',
    hearthStone: '#454c57',
    banner: '#991b1b',
  },
  library: {
    bgTop: '#1f1812',
    bgMid: '#15100c',
    bgBot: '#0d0a07',
    floorA: '#312015',
    floorB: '#271910',
    wall: '#3b281a',
    beam: '#2a1b11',
    hearthStone: '#4a3628',
    banner: '#1e5631',
  },
  garden: {
    bgTop: '#14221b',
    bgMid: '#0e1913',
    bgBot: '#09110d',
    floorA: '#263328',
    floorB: '#1e2920',
    wall: '#2f3e32',
    beam: '#243026',
    hearthStone: '#465347',
    banner: '#b45309',
  },
};

const TABLE_COLORS: Record<TableSurface, { top: string; side: string }> = {
  auto: { top: '#7c502b', side: '#54351b' },
  oak: { top: '#855831', side: '#5a3b20' },
  walnut: { top: '#4e3422', side: '#342215' },
  'green-felt': { top: '#2b5e3f', side: '#4f3219' },
  'red-felt': { top: '#7a2828', side: '#4f3219' },
  slate: { top: '#475569', side: '#334155' },
  marble: { top: '#d6d3cd', side: '#9ca3af' },
};

export function roomPalette(room: RoomScene): Palette {
  return ROOM_PALETTES[room] ?? ROOM_PALETTES.tavern;
}

function addBox(
  faces: Face3D[],
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
  station?: Exclude<TavernStationId, 'home'>,
  emissive = false,
): void {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const v: readonly Vec3[] = [
    { x: cx - hx, y: cy - hy, z: cz - hz },
    { x: cx + hx, y: cy - hy, z: cz - hz },
    { x: cx + hx, y: cy + hy, z: cz - hz },
    { x: cx - hx, y: cy + hy, z: cz - hz },
    { x: cx - hx, y: cy - hy, z: cz + hz },
    { x: cx + hx, y: cy - hy, z: cz + hz },
    { x: cx + hx, y: cy + hy, z: cz + hz },
    { x: cx - hx, y: cy + hy, z: cz + hz },
  ];
  const indices: readonly [number, number, number, number][] = [
    [0, 1, 2, 3], // vorn
    [5, 4, 7, 6], // hinten
    [4, 0, 3, 7], // links
    [1, 5, 6, 2], // rechts
    [3, 2, 6, 7], // oben
    [4, 5, 1, 0], // unten
  ];
  for (const [a, b, c, d] of indices) {
    faces.push({
      verts: [v[a]!, v[b]!, v[c]!, v[d]!],
      color,
      ...(station ? { station } : {}),
      ...(emissive ? { emissive: true } : {}),
    });
  }
}

/** Baut die stilisierte 3D-Geometrie der Taverne samt aller 5 Stationen auf. */
export function buildTavernGeometry(options: {
  room: RoomScene;
  table: TableSurface;
  time: number;
  crestColor?: string;
}): Face3D[] {
  const { room, table, time, crestColor = '#2f5d3a' } = options;
  const pal = roomPalette(room);
  const tbl = TABLE_COLORS[table] ?? TABLE_COLORS.auto;
  const faces: Face3D[] = [];

  // 1. Boden (Holzdielen / Steinplatten)
  for (let gx = -4; gx <= 3; gx++) {
    for (let gz = -4; gz <= 2; gz++) {
      const col = (gx + gz) % 2 === 0 ? pal.floorA : pal.floorB;
      faces.push({
        verts: [
          { x: gx, y: 0, z: gz },
          { x: gx + 1, y: 0, z: gz },
          { x: gx + 1, y: 0, z: gz + 1 },
          { x: gx, y: 0, z: gz + 1 },
        ],
        color: col,
      });
    }
  }

  // Rückwand & linke Wand-Pfeiler
  addBox(faces, -0.5, 1.65, 2.15, 7.6, 3.3, 0.25, pal.wall);
  addBox(faces, -3.75, 1.65, -0.5, 0.28, 3.3, 5.4, pal.wall);
  // Wandtäfelung & Deckenbalken
  addBox(faces, -0.5, 0.55, 1.98, 7.4, 1.1, 0.08, pal.beam);
  addBox(faces, -0.5, 3.15, -0.6, 7.6, 0.24, 0.3, pal.beam);
  addBox(faces, -0.5, 3.15, 1.1, 7.6, 0.24, 0.3, pal.beam);

  // Bücherregal in der Bibliothek / Banner im Burgsaal
  if (room === 'library') {
    addBox(faces, 1.4, 1.75, 1.88, 1.8, 2.2, 0.28, '#4a2e16');
    addBox(faces, 1.4, 1.95, 1.72, 1.5, 0.28, 0.08, '#b45309');
    addBox(faces, 1.4, 1.45, 1.72, 1.5, 0.28, 0.08, '#1d4ed8');
  }

  // Kronleuchter unter der Decke
  addBox(faces, -0.3, 2.75, -0.6, 0.9, 0.12, 0.9, '#3a2a1d');
  addBox(faces, -0.65, 2.9, -0.6, 0.1, 0.22, 0.1, '#fde047', undefined, true);
  addBox(faces, 0.05, 2.9, -0.6, 0.1, 0.22, 0.1, '#fde047', undefined, true);

  // 2. Station „Optionen“ (#/ton): Gemauerter Kamin & Musikpult links
  addBox(faces, -3.1, 1.32, 0.65, 1.25, 2.64, 1.15, pal.hearthStone, 'options');
  addBox(faces, -2.95, 1.28, 0.65, 1.35, 0.18, 1.3, '#5c4028', 'options'); // Kaminsims
  // Feuerholz & animierte Flammen
  addBox(faces, -2.75, 0.2, 0.65, 0.45, 0.16, 0.65, '#3b2313', 'options');
  const flicker1 = 0.82 + Math.sin(time * 3.5) * 0.18;
  const flicker2 = 0.78 + Math.cos(time * 4.7) * 0.22;
  addBox(faces, -2.75, 0.52, 0.65, 0.52, 0.68 * flicker1, 0.52, '#ff7b24', 'options', true);
  addBox(faces, -2.68, 0.62, 0.65, 0.32, 0.55 * flicker2, 0.32, '#fde047', 'options', true);
  // Kleines Musik-/Notenpult neben dem Kamin
  addBox(faces, -2.35, 0.52, -0.35, 0.14, 1.0, 0.14, '#5a3b22', 'options');
  addBox(faces, -2.35, 1.04, -0.35, 0.48, 0.1, 0.42, '#855831', 'options');
  addBox(faces, -2.35, 1.1, -0.35, 0.38, 0.04, 0.32, '#f6ead2', 'options');

  // 3. Station „Profil & Pass“ (#/pass): Wappenschild über dem Kaminsims
  addBox(faces, -2.52, 2.18, 0.65, 0.16, 0.68, 0.58, '#d4af37', 'profile');
  addBox(faces, -2.44, 2.18, 0.65, 0.08, 0.54, 0.46, crestColor, 'profile');
  addBox(faces, -2.4, 2.18, 0.65, 0.06, 0.18, 0.18, '#facc15', 'profile', true);

  // 4. Station „Turniere“ (#/turniere): Turniertafel & Siegerpokal an der Rückwand
  addBox(faces, -1.05, 1.92, 1.78, 2.15, 1.32, 0.16, '#5a3b22', 'tournaments');
  addBox(faces, -1.05, 1.92, 1.68, 1.82, 1.02, 0.06, '#e6d3ad', 'tournaments');
  // Wappenwimpel links und rechts der Tafel
  addBox(faces, -2.0, 1.88, 1.72, 0.28, 0.95, 0.06, pal.banner, 'tournaments');
  addBox(faces, -0.1, 1.88, 1.72, 0.28, 0.95, 0.06, '#1e40af', 'tournaments');
  // Trophäen-Konsole & goldener Pokal
  addBox(faces, -0.45, 0.62, 1.45, 0.75, 1.24, 0.48, '#4e3422', 'tournaments');
  addBox(faces, -0.45, 1.42, 1.45, 0.26, 0.38, 0.26, '#eab308', 'tournaments', true);
  addBox(faces, -0.45, 1.64, 1.45, 0.34, 0.12, 0.34, '#fef08a', 'tournaments', true);

  // 5. Station „Lokales Spiel“ (#/einzelspieler): Großer Spieltisch im Vordergrund
  addBox(faces, -0.95, 0.74, -1.45, 2.2, 0.15, 1.65, tbl.top, 'single');
  addBox(faces, -1.75, 0.37, -2.05, 0.22, 0.74, 0.22, tbl.side, 'single');
  addBox(faces, -0.15, 0.37, -2.05, 0.22, 0.74, 0.22, tbl.side, 'single');
  addBox(faces, -1.75, 0.37, -0.85, 0.22, 0.74, 0.22, tbl.side, 'single');
  addBox(faces, -0.15, 0.37, -0.85, 0.22, 0.74, 0.22, tbl.side, 'single');
  // 3D-Schachbrett mit Figuren auf dem Tisch
  addBox(faces, -1.22, 0.84, -1.45, 0.92, 0.06, 0.92, '#d9c29c', 'single');
  addBox(faces, -1.38, 0.96, -1.55, 0.14, 0.22, 0.14, '#f8fafc', 'single');
  addBox(faces, -1.18, 0.94, -1.32, 0.12, 0.18, 0.12, '#f8fafc', 'single');
  addBox(faces, -1.05, 0.96, -1.52, 0.14, 0.22, 0.14, '#292524', 'single');
  // Kartenstapel & 3D-Würfel auf dem Tisch
  addBox(faces, -0.42, 0.84, -1.35, 0.36, 0.05, 0.5, '#fbf5e6', 'single');
  addBox(faces, -0.52, 0.86, -1.78, 0.14, 0.14, 0.14, '#ffffff', 'single');
  addBox(faces, -0.32, 0.86, -1.72, 0.14, 0.14, 0.14, '#fde047', 'single', true);

  // 6. Station „Online Spiel“ (#/online): Grüner Gesellschaftstisch mit Laterne
  addBox(faces, 1.25, 0.74, 0.1, 1.9, 0.15, 1.9, '#2b5e3f', 'online');
  addBox(faces, 1.25, 0.37, 0.1, 0.42, 0.74, 0.42, '#4a2e16', 'online');
  // Tischlaterne in der Mitte & Kartenplätze
  addBox(faces, 1.25, 0.98, 0.1, 0.26, 0.36, 0.26, '#fbbf24', 'online', true);
  addBox(faces, 1.25, 1.2, 0.1, 0.34, 0.08, 0.34, '#3a2916', 'online');
  addBox(faces, 0.65, 0.83, 0.1, 0.28, 0.04, 0.38, '#f6ead2', 'online');
  addBox(faces, 1.85, 0.83, 0.1, 0.28, 0.04, 0.38, '#f6ead2', 'online');
  // Zwei Hocker am Online-Tisch
  addBox(faces, 0.1, 0.44, 0.1, 0.42, 0.44, 0.42, '#5a3b22', 'online');
  addBox(faces, 2.4, 0.44, 0.1, 0.42, 0.44, 0.42, '#5a3b22', 'online');

  return faces;
}

/** Berechnet die schattierte RGB-Farbe einer 3D-Fläche aus Kaminlicht, Deckenlicht und Stations-Fokus. */
export function shadeFaceColor(
  hex: string,
  verts: readonly [Vec3, Vec3, Vec3, Vec3],
  highlighted: boolean,
  emissive = false,
): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r0 = (n >> 16) & 255;
  const g0 = (n >> 8) & 255;
  const b0 = n & 255;

  if (emissive) {
    const boost = highlighted ? 1.15 : 1.0;
    return `rgb(${Math.min(255, Math.round(r0 * boost))},${Math.min(255, Math.round(g0 * boost))},${Math.min(255, Math.round(b0 * boost))})`;
  }

  const ux = verts[1].x - verts[0].x;
  const uy = verts[1].y - verts[0].y;
  const uz = verts[1].z - verts[0].z;
  const vx = verts[2].x - verts[0].x;
  const vy = verts[2].y - verts[0].y;
  const vz = verts[2].z - verts[0].z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;

  // Lichtquelle aus Richtung Kamin + Kronleuchter (-0.55, 0.72, -0.42)
  const dot = Math.max(0, (nx / len) * -0.55 + (ny / len) * 0.72 + (nz / len) * -0.42);
  const factor = (0.56 + dot * 0.52) * (highlighted ? 1.22 : 1.0);

  const r = Math.min(255, Math.max(0, Math.round(r0 * factor + (highlighted ? 18 : 0))));
  const g = Math.min(255, Math.max(0, Math.round(g0 * factor + (highlighted ? 12 : 0))));
  const b = Math.min(255, Math.max(0, Math.round(b0 * factor)));
  return `rgb(${r},${g},${b})`;
}
