/**
 * Lage des Tisches im Raum (#370, #387): Größe `scale` und Drehung `yaw` um die Hochachse durch
 * die Tischmitte. Die Szene setzt beides bei jedem Aufbau; Stellen, die Punkte aus dem Raum ins
 * Tischsystem (eigener Platz vorn) brauchen – Treffpunkt, Fächer, Tischgriff –, rechnen hier.
 * Reine Rechnung ohne three.js, damit sie sich testen lässt.
 */
export type Vec3 = [number, number, number];

const CENTER: Vec3 = [0, 0.74, -0.55];

export const tableFrame = { scale: 1, yaw: 0 };

/** Raum → Tischsystem: erst um die Mitte zurückdrehen, dann auf Normalgröße. */
export function worldToTable(p: Vec3, scale = tableFrame.scale, yaw = tableFrame.yaw): Vec3 {
  const x = p[0] - CENTER[0];
  const y = p[1] - CENTER[1];
  const z = p[2] - CENTER[2];
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [CENTER[0] + (x * cos - z * sin) / scale, CENTER[1] + y / scale, CENTER[2] + (x * sin + z * cos) / scale];
}

/** Tischsystem → Raum (Umkehrung von `worldToTable`). */
export function tableToWorld(p: Vec3, scale = tableFrame.scale, yaw = tableFrame.yaw): Vec3 {
  const x = (p[0] - CENTER[0]) * scale;
  const y = (p[1] - CENTER[1]) * scale;
  const z = (p[2] - CENTER[2]) * scale;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [CENTER[0] + x * cos + z * sin, CENTER[1] + y, CENTER[2] - x * sin + z * cos];
}

/** Winkel (um die Hochachse) der Verbindung von `a` nach `b`, für das Drehen mit zwei Händen. */
export function lineAngle(a: Vec3, b: Vec3): number {
  return Math.atan2(b[0] - a[0], b[2] - a[2]);
}

/** Kürzeste Winkeldifferenz in (−π, π]. */
export function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Auf Vielfache von `step` Grad gerastet, damit der Tisch nach dem Loslassen gerade steht. */
export function snapYaw(yaw: number, stepDeg = 15, withinDeg = 4): number {
  const step = (stepDeg * Math.PI) / 180;
  const nearest = Math.round(yaw / step) * step;
  return Math.abs(angleDelta(yaw, nearest)) <= (withinDeg * Math.PI) / 180 ? nearest : yaw;
}
