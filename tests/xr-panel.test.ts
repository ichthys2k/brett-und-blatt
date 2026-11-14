import { describe, expect, it } from 'vitest';
import { MIN_ABOVE_TABLE, SEAT_PAGE, headHeight, liftAboveTable, lowestEdge, seatPageRange } from '../apps/xr/src/scene/panel-layout';
import { SCALE_MAX, SCALE_MIN, SCALE_STEP, clampScale, placementOrigin, scaleAboutTable } from '../apps/xr/src/scene/Placement';
import { TABLE_CENTER } from '../apps/xr/src/scene/Tavern';
import { EYE_MAX, EYE_MIN, alignOffset } from '../apps/xr/src/scene/view-align';

const TABLE_TOP = 0.74;

describe('VR-Menüfenster (#364)', () => {
  it('hebt ein langes Fenster über die Tischplatte', () => {
    // Lobby mit vielen Plätzen: 2 Kopfzeilen, 10 Knopfreihen, Grundhöhe 1,25 m
    const lift = liftAboveTable(1.25, 2, 10, TABLE_TOP);
    expect(lift).toBeGreaterThan(0);
    const bottom = 1.25 + lift + lowestEdge(2, 10);
    expect(bottom).toBeGreaterThanOrEqual(TABLE_TOP + MIN_ABOVE_TABLE - 1e-9);
  });

  it('lässt ein kurzes Fenster, wo es ist', () => {
    expect(liftAboveTable(1.25, 2, 3, TABLE_TOP)).toBe(0);
  });

  it('wächst mit jeder Reihe nach unten', () => {
    expect(lowestEdge(2, 5)).toBeLessThan(lowestEdge(2, 4));
    expect(lowestEdge(2, 0)).toBe(-headHeight(2) / 2);
  });

  it('teilt die Platzliste in Seiten und hält die Seite im Bereich', () => {
    expect(seatPageRange(3, 0)).toMatchObject({ from: 0, to: 3, pages: 1 });
    const r = seatPageRange(10, 2);
    expect(r).toMatchObject({ from: 2 * SEAT_PAGE, to: 10, pages: 3, current: 2 });
    expect(seatPageRange(10, 9).current).toBe(2);
    expect(seatPageRange(10, -3).current).toBe(0);
  });
});

describe('Tisch am Kopf ausrichten (#365)', () => {
  it('hebt einen Kopf ohne bekannten Boden (Höhe 0) auf Augenhöhe', () => {
    const o = alignOffset({ x: 0, y: 0, z: 0 });
    expect(o.y).toBe(EYE_MIN);
  });

  it('lässt eine normale Haltung unverändert', () => {
    expect(alignOffset({ x: 0, y: 1.2, z: 0 }).y).toBe(0);
  });

  it('holt einen zu hohen Kopf herunter und zentriert vor dem Tisch', () => {
    const o = alignOffset({ x: 0.3, y: 2.1, z: -0.2 });
    expect(2.1 + o.y).toBe(EYE_MAX);
    expect(o.x).toBe(-0.3);
    expect(o.z).toBe(0.2);
  });
});

describe('Mixed Reality: Tisch auf Fläche (#370)', () => {
  it('legt die Tischmitte auf den Treffer', () => {
    const o = placementOrigin({ x: 0.4, y: 0.9, z: -1.2 });
    expect(o).toEqual({ x: TABLE_CENTER[0] - 0.4, y: TABLE_CENTER[1] - 0.9, z: TABLE_CENTER[2] + 1.2 });
  });

  it('begrenzt die Größe auf 30 bis 100 Prozent', () => {
    expect(clampScale(0.1)).toBe(SCALE_MIN);
    expect(clampScale(2)).toBe(SCALE_MAX);
    expect(clampScale(0.7 + SCALE_STEP)).toBe(0.8);
  });

  it('rechnet Punkte um die Tischmitte um und hält die Mitte fest', () => {
    expect(scaleAboutTable([...TABLE_CENTER], 0.5)).toEqual([...TABLE_CENTER]);
    const p = scaleAboutTable([TABLE_CENTER[0] + 0.2, TABLE_CENTER[1], TABLE_CENTER[2]], 0.5);
    expect(p[0]).toBeCloseTo(TABLE_CENTER[0] + 0.4);
  });
});
