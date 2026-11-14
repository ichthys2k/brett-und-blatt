/**
 * Wo ein Spielklang erklingt (#381): reine Rechnung ohne Audio, damit sie sich testen lässt.
 * Ein Ereignis mit Platznummer (`seat`) kommt vom Tischrand vor diesem Platz, alles andere aus der
 * Tischmitte. Die Punkte liegen im Tischsystem; `toWorld` rechnet einen verkleinerten Tisch (#370) ein.
 */
export type Spot = [number, number, number];

const TABLE_CENTER: Spot = [0, 0.74, -0.55];
const EDGE = 0.45;
/** Etwas über der Tischplatte, damit der Klang nicht im Holz sitzt. */
const LIFT = 0.06;

export function seatEdge(angle: number): Spot {
  return [TABLE_CENTER[0] + Math.sin(angle) * EDGE, TABLE_CENTER[1] + LIFT, TABLE_CENTER[2] + Math.cos(angle) * EDGE];
}

/** Kopfhöhe eines Platzes: dort sitzt der Sprecher, aus seiner Richtung kommt die Stimme. */
export function seatHead(angle: number): Spot {
  return [TABLE_CENTER[0] + Math.sin(angle) * 1.0, 1.2, TABLE_CENTER[2] + Math.cos(angle) * 1.0];
}

export function eventSpot(event: unknown, angleOf: (seat: number) => number | null): Spot {
  const seat = (event as { seat?: unknown })?.seat;
  const angle = typeof seat === 'number' ? angleOf(seat) : null;
  return angle === null ? [TABLE_CENTER[0], TABLE_CENTER[1] + LIFT, TABLE_CENTER[2]] : seatEdge(angle);
}

/** Tischsystem → Raum bei Tischgröße `scale` (1 = voll, 0,5 = halb so groß) um die Tischmitte. */
export function toWorld(p: Spot, scale: number): Spot {
  return [TABLE_CENTER[0] + (p[0] - TABLE_CENTER[0]) * scale, TABLE_CENTER[1] + (p[1] - TABLE_CENTER[1]) * scale, TABLE_CENTER[2] + (p[2] - TABLE_CENTER[2]) * scale];
}
