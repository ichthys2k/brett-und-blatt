/**
 * Was Mitspieler am Tisch sehen (#385): die Figur in der Hand und der Zeigestrahl, zusätzlich
 * zu Kopf und Händen aus #351. Nur Ort und Art, nie ein Wert: eine gegriffene Karte kommt als
 * „Karte, Rückseite“ an, Figuren und Steine liegen ohnehin offen auf dem Brett. Reine
 * Kodierung, damit sich „nichts Verdecktes“ testen lässt.
 */
export type Pose7 = number[];

/** 0 = Figur/Stein/Plättchen (offen), 1 = Karte (nur Rückseite). */
export type HeldKind = 0 | 1;
export type Held = [number, number, number, HeldKind];

/** Lokal gegriffenes Objekt in Raumkoordinaten (die Szene setzt es, `PoseSender` sendet es). */
export const presence: { held: Held | null; fingers: { left: number[] | null; right: number[] | null } } = { held: null, fingers: { left: null, right: null } };

/** Fünf Beugewerte (0 gestreckt … 9 eingerollt) je Hand: Daumen bis kleiner Finger. */
export type Fingers = number[];

export interface Packet {
  head: Pose7;
  left: Pose7 | null;
  right: Pose7 | null;
  held: Held | null;
  pointLeft: boolean;
  pointRight: boolean;
  fingerLeft: Fingers | null;
  fingerRight: Fingers | null;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function encodePacket(p: Packet): string {
  const out: Record<string, unknown> = { h: p.head, l: p.left, r: p.right };
  if (p.held) out.g = [round(p.held[0]), round(p.held[1]), round(p.held[2]), p.held[3]];
  if (p.pointLeft || p.pointRight) out.p = [p.pointLeft ? 1 : 0, p.pointRight ? 1 : 0];
  if (p.fingerLeft || p.fingerRight) out.f = [p.fingerLeft ? p.fingerLeft.join('') : null, p.fingerRight ? p.fingerRight.join('') : null];
  return JSON.stringify(out);
}

function decodeFingers(v: unknown): Fingers | null {
  return typeof v === 'string' && /^[0-9]{5}$/.test(v) ? [...v].map(Number) : null;
}

const isPose = (v: unknown): v is Pose7 => Array.isArray(v) && v.length === 7 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** Liest ein Paket; Unbrauchbares wird verworfen, unbekannte Felder werden ignoriert. */
export function decodePacket(text: string): Packet | null {
  let data: { h?: unknown; l?: unknown; r?: unknown; g?: unknown; p?: unknown; f?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isPose(data.h)) return null;
  const g = data.g;
  const held: Held | null =
    Array.isArray(g) && g.length === 4 && g.slice(0, 3).every((n) => typeof n === 'number' && Number.isFinite(n)) && (g[3] === 0 || g[3] === 1) ? [g[0], g[1], g[2], g[3]] : null;
  const p = Array.isArray(data.p) ? data.p : [];
  return { head: data.h, left: isPose(data.l) ? data.l : null, right: isPose(data.r) ? data.r : null, held, pointLeft: p[0] === 1, pointRight: p[1] === 1, fingerLeft: Array.isArray(data.f) ? decodeFingers(data.f[0]) : null, fingerRight: Array.isArray(data.f) ? decodeFingers(data.f[1]) : null };
}
