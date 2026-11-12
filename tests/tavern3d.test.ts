import { describe, expect, it } from 'vitest';
import {
  buildTavernGeometry,
  getHoveredStation,
  pickHotspot,
  projectPoint,
  setHoveredStation,
  shadeFaceColor,
  STATION_CAMERAS,
  stationForRoute,
  stepCamera,
  TAVERN_HOTSPOTS,
} from '../apps/web/src/lib/tavern3d';
import type { RoomScene, TableSurface } from '../apps/web/src/lib/look';

const ROOM_SCENES: readonly RoomScene[] = ['tavern', 'castle', 'library', 'garden'];
const TABLE_SURFACES: readonly TableSurface[] = ['auto', 'oak', 'walnut', 'green-felt', 'red-felt', 'slate', 'marble'];

describe('Begehbare 3D-Taverne (#262)', () => {
  it('ordnet den Routen die passenden 3D-Stationen im Raum zu', () => {
    expect(stationForRoute('menu')).toBe('home');
    expect(stationForRoute('home')).toBe('single');
    expect(stationForRoute('setup')).toBe('single');
    expect(stationForRoute('online')).toBe('online');
    expect(stationForRoute('orgs')).toBe('online');
    expect(stationForRoute('tournaments')).toBe('tournaments');
    expect(stationForRoute('series')).toBe('tournaments');
    expect(stationForRoute('sound')).toBe('options');
    expect(stationForRoute('imprint')).toBe('options');
    expect(stationForRoute('board')).toBe('board');
    expect(stationForRoute('pass')).toBe('profile');
    expect(stationForRoute('account')).toBe('profile');
    expect(stationForRoute('library')).toBe('profile');
    expect(stationForRoute('learn')).toBe('profile');
    expect(stationForRoute('learning')).toBe('profile');
    expect(stationForRoute('collection')).toBe('profile');
  });

  it('fährt die Kamera weich zur Zielstation und springt bei prefers-reduced-motion direkt', () => {
    const start = { ...STATION_CAMERAS.home };
    const step1 = stepCamera(start, 'single', { x: 0.2, y: -0.1 }, false, 0.2);
    expect(step1.z).toBeGreaterThan(start.z);
    expect(step1.z).toBeLessThan(STATION_CAMERAS.single.z);

    const snapped = stepCamera(start, 'tournaments', { x: 0.4, y: 0.4 }, true);
    expect(snapped).toEqual(STATION_CAMERAS.tournaments);
  });

  it('projiziert alle 6 Stationen in der Totale sichtbar und erkennt Klicks auf die Hotspots', () => {
    const width = 1280;
    const height = 720;
    const cam = STATION_CAMERAS.home;

    for (const spot of TAVERN_HOTSPOTS) {
      const p = projectPoint(spot.pos, cam, width, height);
      expect(p).not.toBeNull();
      expect(p!.x).toBeGreaterThan(0);
      expect(p!.x).toBeLessThan(width);
      expect(p!.y).toBeGreaterThan(0);
      expect(p!.y).toBeLessThan(height);

      const hit = pickHotspot(p!.x, p!.y, cam, width, height);
      expect(hit?.id).toBe(spot.id);
    }

    expect(pickHotspot(-500, -500, cam, width, height)).toBeNull();
  });

  it('baut Geometrie für alle 6 Stationen, Raumkulissen und Tischoberflächen', () => {
    for (const room of ROOM_SCENES) {
      for (const table of TABLE_SURFACES) {
        const faces = buildTavernGeometry({ room, table, time: 1.2 });
        expect(faces.length).toBeGreaterThan(80);
        const stations = new Set(faces.map((f) => f.station).filter(Boolean));
        expect(stations).toEqual(new Set(['single', 'online', 'tournaments', 'options', 'profile', 'board']));
      }
    }
  });

  it('hellt hervorgehobene Stationen bei Hover/Fokus sichtbar auf', () => {
    const face = buildTavernGeometry({ room: 'tavern', table: 'oak', time: 0 }).find((f) => f.station === 'single' && !f.emissive)!;
    const normal = shadeFaceColor(face.color, face.verts, false);
    const highlighted = shadeFaceColor(face.color, face.verts, true);
    expect(highlighted).not.toBe(normal);

    setHoveredStation('online');
    expect(getHoveredStation()).toBe('online');
    setHoveredStation(null);
    expect(getHoveredStation()).toBeNull();
  });
});
