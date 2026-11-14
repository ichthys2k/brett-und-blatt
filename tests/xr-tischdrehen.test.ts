import { describe, expect, it } from 'vitest';
import { angleDelta, lineAngle, snapYaw, tableToWorld, worldToTable, type Vec3 } from '../apps/xr/src/table-frame';

const near = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));

describe('Tisch drehen (#387)', () => {
  it('Raum → Tisch ist die Umkehrung von Tisch → Raum, mit Größe und Drehung', () => {
    const p: Vec3 = [0.3, 1.1, -0.2];
    for (const [scale, yaw] of [[1, 0], [0.5, 0.7], [0.8, -2.1]] as const) near(worldToTable(tableToWorld(p, scale, yaw), scale, yaw), p);
  });
  it('die Tischmitte bleibt beim Drehen an ihrem Ort', () => {
    near(tableToWorld([0, 0.74, -0.55], 1, 1.3), [0, 0.74, -0.55]);
  });
  it('ein Punkt vor dem Tisch dreht um 90° nach der Seite', () => {
    // Tisch um +90° gedreht: der Platz vorn (z + 1) liegt im Raum bei x + 1.
    near(tableToWorld([0, 0.74, 0.45], 1, Math.PI / 2), [1, 0.74, -0.55]);
  });
  it('Drehen mit zwei Händen folgt dem Winkel der Verbindungslinie', () => {
    const a = lineAngle([0, 1, 0], [1, 1, 0]);
    const b = lineAngle([0, 1, 0], [0, 1, 1]);
    expect(angleDelta(a, b)).toBeCloseTo(-Math.PI / 2);
    expect(angleDelta(3.1, -3.1)).toBeCloseTo(2 * Math.PI - 6.2);
  });
  it('rastet nahe 15°-Schritten ein, sonst nicht', () => {
    const deg = (d: number) => (d * Math.PI) / 180;
    expect(snapYaw(deg(31))).toBeCloseTo(deg(30));
    expect(snapYaw(deg(38))).toBeCloseTo(deg(38));
    expect(snapYaw(0)).toBe(0);
  });
});
