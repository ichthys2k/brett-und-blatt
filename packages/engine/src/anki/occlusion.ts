/*
 * Bilder verdecken (Image Occlusion, #101 L8). Anki ab 23.10 legt die Masken als Lücken ins Feld „Occlusion“:
 * `{{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.1:oi=1}}`, Werte als Anteil der Bildgröße. Die Vorlage von Anki zeichnet sie mit einem
 * Programm; fremde Programme laufen bei uns nie, deshalb zeichnet die Web-App die Masken selbst (SVG über dem Bild). Das Feld bleibt unverändert und geht
 * unverändert zurück nach Anki. Unterstützt: Rechteck, Ellipse, Vieleck (ohne Drehung). Textmasken und Drehwinkel werden nicht ausgewertet.
 */

export type OcclusionShape =
  | { kind: 'rect'; n: number; left: number; top: number; width: number; height: number; hideOthers: boolean }
  | { kind: 'ellipse'; n: number; left: number; top: number; rx: number; ry: number; hideOthers: boolean }
  | { kind: 'polygon'; n: number; points: [number, number][]; hideOthers: boolean };

const SHAPE = /\{\{c(\d+)::image-occlusion:(rect|ellipse|polygon):([^{}]*?)\}\}/g;

export const hasOcclusion = (field: string): boolean => /\{\{c\d+::image-occlusion:/.test(field);

const num = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Liest die Masken aus dem Feld; unbrauchbare Angaben fallen weg. */
export function parseOcclusion(field: string): OcclusionShape[] {
  const out: OcclusionShape[] = [];
  for (const m of field.matchAll(SHAPE)) {
    const n = Number(m[1]);
    const props = new Map<string, string>();
    for (const part of m[3]!.split(':')) {
      const at = part.indexOf('=');
      if (at > 0) props.set(part.slice(0, at), part.slice(at + 1).replace(/&nbsp;/g, ' '));
    }
    const hideOthers = props.get('oi') === '1';
    if (m[2] === 'rect') {
      const [left, top, width, height] = ['left', 'top', 'width', 'height'].map((k) => num(props.get(k)));
      if (left !== null && top !== null && width !== null && height !== null) out.push({ kind: 'rect', n, left, top, width, height, hideOthers });
    } else if (m[2] === 'ellipse') {
      const [left, top, rx, ry] = ['left', 'top', 'rx', 'ry'].map((k) => num(props.get(k)));
      if (left !== null && top !== null && rx !== null && ry !== null) out.push({ kind: 'ellipse', n, left, top, rx, ry, hideOthers });
    } else {
      const points = (props.get('points') ?? '')
        .split(/\s+/)
        .map((pair) => pair.split(',').map(Number))
        .filter((p): p is [number, number] => p.length === 2 && p.every(Number.isFinite));
      if (points.length >= 3) out.push({ kind: 'polygon', n, points, hideOthers });
    }
  }
  return out;
}

const f = (n: number): string => String(Math.round(n * 10000) / 10000);

/**
 * Die Masken als SVG über dem Bild (Koordinaten 0 bis 1). Karte `active`: Ihre Masken decken auf der Vorderseite zu und stehen auf der Rückseite
 * nur als Umriss; die anderen decken (bei „alle verdecken“, `oi=1`) zu, sonst fehlen sie. Alle Zahlen sind geprüft, es gibt keinen Text von außen.
 */
export function occlusionSvg(shapes: readonly OcclusionShape[], active: number, answer: boolean): string {
  const parts: string[] = [];
  for (const s of shapes) {
    const isActive = s.n === active;
    if (!isActive && !s.hideOthers) continue;
    const style = isActive ? (answer ? 'fill="none" stroke="#ff8e8e" stroke-width="0.006"' : 'fill="#ffeba2" stroke="#212121" stroke-width="0.004"') : 'fill="#ffeba2" stroke="#212121" stroke-width="0.004"';
    if (s.kind === 'rect') parts.push(`<rect x="${f(s.left)}" y="${f(s.top)}" width="${f(s.width)}" height="${f(s.height)}" ${style}/>`);
    else if (s.kind === 'ellipse') parts.push(`<ellipse cx="${f(s.left + s.rx)}" cy="${f(s.top + s.ry)}" rx="${f(s.rx)}" ry="${f(s.ry)}" ${style}/>`);
    else parts.push(`<polygon points="${s.points.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" ${style}/>`);
  }
  return `<svg class="bub-io-masks" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;left:0;top:0;width:100%;height:100%">${parts.join('')}</svg>`;
}
