// Quartett „Geometrie & Körper“ (#319): 32 exakte Zeichnungen als SVG, kein Bildmodell.
// Wie mit Tusche und Blattgold auf Pergament: Flächen golden, Kanten in Tinte, Symmetrieachsen
// gestrichelt, verdeckte Kanten gepunktet. Jede Ecke trägt `data-ecke`, jede Kante `data-kante`;
// `tests/quartett-geometrie.test.ts` zählt sie gegen `values.vertices` und `values.edges` der Karte.
//   node scripts/grafik/geometrie-svg.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const set = JSON.parse(readFileSync(resolve(root, 'content/quartett/geometrie.json'), 'utf8'));
const out = resolve(root, 'content/quartett/bilder/geometrie');
mkdirSync(out, { recursive: true });

const W = 480;
const H = 360;
const MARGIN = 44;
const INK = '#3b2a1a';
const HIDDEN = '#8a7658';
const AXIS = '#9a6a2e';
const GOLD = '#d9a400';
const f = (n) => Math.round(n * 10) / 10;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Ebene Figuren: Punkte in beliebigen Einheiten, werden eingepasst.

function regular(n, rotation = -Math.PI / 2) {
  return Array.from({ length: n }, (_, k) => [Math.cos(rotation + (k * TAU) / n), Math.sin(rotation + (k * TAU) / n)]);
}

function star(points, inner) {
  return Array.from({ length: points * 2 }, (_, k) => {
    const r = k % 2 === 0 ? 1 : inner;
    const a = -Math.PI / 2 + (k * Math.PI) / points;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
}

/** Passt Punkte (und Achsen) in die Fläche ein; gibt eine Abbildung zurück. */
function fitter(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((W - 2 * MARGIN) / (maxX - minX || 1), (H - 2 * MARGIN) / (maxY - minY || 1));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { map: ([x, y]) => [W / 2 + (x - cx) * scale, H / 2 + (y - cy) * scale], scale };
}

function axisLines(center, angles, length) {
  return angles.map((a) => {
    const dx = Math.cos(a) * length;
    const dy = Math.sin(a) * length;
    return `<line class="achse" x1="${f(center[0] - dx)}" y1="${f(center[1] - dy)}" x2="${f(center[0] + dx)}" y2="${f(center[1] + dy)}" />`;
  });
}

/** Vieleck mit Ecken, Kanten und Symmetrieachsen (Winkel in Bogenmaß, um den Mittelpunkt der Figur). */
function polygonFigure(points, axisAngles = []) {
  const { map } = fitter(points);
  const p = points.map(map);
  const center = map([points.reduce((s, q) => s + q[0], 0) / points.length, points.reduce((s, q) => s + q[1], 0) / points.length]);
  const reach = Math.max(...p.map((q) => Math.hypot(q[0] - center[0], q[1] - center[1]))) * 1.12;
  return [
    `<polygon class="flaeche" points="${p.map((q) => `${f(q[0])},${f(q[1])}`).join(' ')}" />`,
    ...axisLines(center, axisAngles, reach),
    ...p.map((q, i) => {
      const r = p[(i + 1) % p.length];
      return `<line class="kante" data-kante="${i}" x1="${f(q[0])}" y1="${f(q[1])}" x2="${f(r[0])}" y2="${f(r[1])}" />`;
    }),
    ...p.map((q, i) => `<circle class="ecke" data-ecke="${i}" cx="${f(q[0])}" cy="${f(q[1])}" r="4" />`),
  ];
}

const regularAxes = (n, rotation = -Math.PI / 2) => Array.from({ length: n }, (_, k) => rotation + (k * Math.PI) / n);

function circleFigure() {
  const r = (H - 2 * MARGIN) / 2;
  return [
    `<circle class="flaeche" cx="${W / 2}" cy="${H / 2}" r="${r}" />`,
    ...axisLines([W / 2, H / 2], [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4], r * 1.1),
    `<circle class="kante" data-kante="0" cx="${W / 2}" cy="${H / 2}" r="${r}" fill="none" />`,
  ];
}

function semicircleFigure() {
  const r = Math.min((W - 2 * MARGIN) / 2, H - 2 * MARGIN);
  const cy = H / 2 + r / 2;
  const [x1, x2] = [W / 2 - r, W / 2 + r];
  return [
    `<path class="flaeche" d="M ${f(x1)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 1 ${f(x2)} ${f(cy)} Z" />`,
    ...axisLines([W / 2, cy - r / 2], [Math.PI / 2], r * 0.62),
    `<path class="kante" data-kante="0" d="M ${f(x1)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 1 ${f(x2)} ${f(cy)}" fill="none" />`,
    `<line class="kante" data-kante="1" x1="${f(x1)}" y1="${f(cy)}" x2="${f(x2)}" y2="${f(cy)}" />`,
    `<circle class="ecke" data-ecke="0" cx="${f(x1)}" cy="${f(cy)}" r="4" />`,
    `<circle class="ecke" data-ecke="1" cx="${f(x2)}" cy="${f(cy)}" r="4" />`,
  ];
}

// ---------------------------------------------------------------------------
// Körper: Ecken und Flächen (Eckenlisten), gedreht und senkrecht projiziert.

function prism(n, height = 1.4, rotation = Math.PI / n, scaleTop = 1) {
  const ring = regular(n, rotation).map(([x, z]) => [x, z]);
  const vertices = [...ring.map(([x, z]) => [x, -height / 2, z]), ...ring.map(([x, z]) => [x * scaleTop, height / 2, z * scaleTop])];
  const faces = [ring.map((_, i) => i), ring.map((_, i) => n + i).reverse()];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
  return { vertices, faces };
}

function pyramid(n, height = 1.6, rotation = Math.PI / n) {
  const ring = regular(n, rotation);
  const vertices = [...ring.map(([x, z]) => [x, -height / 2, z]), [0, height / 2, 0]];
  const faces = [ring.map((_, i) => i)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
  return { vertices, faces };
}

function fromTriangles(vertices) {
  // Alle Dreiecke aus kürzesten Kanten (Tetraeder, Oktaeder, Ikosaeder).
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let min = Infinity;
  for (let i = 0; i < vertices.length; i++) for (let j = i + 1; j < vertices.length; j++) min = Math.min(min, d(vertices[i], vertices[j]));
  const near = (i, j) => Math.abs(d(vertices[i], vertices[j]) - min) < 1e-6;
  const faces = [];
  for (let i = 0; i < vertices.length; i++)
    for (let j = i + 1; j < vertices.length; j++)
      for (let k = j + 1; k < vertices.length; k++) if (near(i, j) && near(j, k) && near(i, k)) faces.push([i, j, k]);
  return { vertices, faces };
}

/** Tetraeder auf einer Grundfläche stehend, Spitze oben. */
function tetrahedron() {
  const base = regular(3, Math.PI / 6).map(([x, z]) => [x, -1 / 3, z]);
  return { vertices: [...base, [0, 1, 0]], faces: [[0, 1, 2], [0, 1, 3], [1, 2, 3], [2, 0, 3]] };
}

/** Legt einen Körper auf die Seite (Achse waagerecht), etwa das Dreiecksprisma. */
function lying({ vertices, faces }) {
  return { vertices: vertices.map(([x, y, z]) => [y, x, z]), faces };
}

const PHI = (1 + Math.sqrt(5)) / 2;
const ICOSA = [
  [0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
  [1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
];

function dodecahedron() {
  // Dual zum Ikosaeder: Ecken = Mittelpunkte der Ikosaederflächen, Flächen = Ikosaederecken.
  const ico = fromTriangles(ICOSA);
  const vertices = ico.faces.map((t) => [0, 1, 2].map((c) => (ICOSA[t[0]][c] + ICOSA[t[1]][c] + ICOSA[t[2]][c]) / 3));
  const faces = ICOSA.map((v, vi) => {
    const around = ico.faces.map((t, ti) => (t.includes(vi) ? ti : -1)).filter((ti) => ti >= 0);
    // Um die Achse der Ecke sortieren.
    const n = v.map((c) => c / Math.hypot(...v));
    const u = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const a = norm(cross(n, u));
    const b = cross(n, a);
    return around.sort((p, q) => angleOf(vertices[p], a, b) - angleOf(vertices[q], a, b));
  });
  return { vertices, faces };
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => a.map((c) => c / Math.hypot(...a));
const angleOf = (p, a, b) => Math.atan2(dot(p, b), dot(p, a));

function rotate([x, y, z], yaw, pitch) {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
  return [x1, y2, z2];
}

/** Zeichnet einen konvexen Körper: sichtbare Flächen golden, verdeckte Kanten gepunktet. */
function solidFigure({ vertices, faces }, yaw = 0.55, pitch = 0.42) {
  const center = [0, 1, 2].map((c) => vertices.reduce((s, v) => s + v[c], 0) / vertices.length);
  const rotated = vertices.map((v) => rotate(sub(v, center), yaw, pitch));
  // Bildschirm: x nach rechts, y nach unten (deshalb -y), Blick entlang -z (z zum Betrachter).
  const { map } = fitter(rotated.map(([x, y]) => [x, -y]));
  const screen = rotated.map(([x, y]) => map([x, -y]));
  const front = faces.map((face) => {
    const [a, b, c] = face.map((i) => rotated[i]);
    let n = cross(sub(b, a), sub(c, a));
    const mid = [0, 1, 2].map((k) => face.reduce((s, i) => s + rotated[i][k], 0) / face.length);
    if (dot(n, mid) < 0) n = n.map((x) => -x); // nach außen
    return n[2] > 1e-9;
  });
  const edges = new Map();
  faces.forEach((face, fi) =>
    face.forEach((v, k) => {
      const w = face[(k + 1) % face.length];
      const key = v < w ? `${v}-${w}` : `${w}-${v}`;
      const seen = edges.get(key) ?? { a: Math.min(v, w), b: Math.max(v, w), visible: false };
      seen.visible ||= front[fi];
      edges.set(key, seen);
    }),
  );
  const visibleVertex = new Set([...edges.values()].filter((e) => e.visible).flatMap((e) => [e.a, e.b]));
  const list = [...edges.values()];
  return [
    ...faces.flatMap((face, fi) => (front[fi] ? [`<polygon class="flaeche" points="${face.map((i) => `${f(screen[i][0])},${f(screen[i][1])}`).join(' ')}" />`] : [])),
    ...list.map((e, i) => `<line class="${e.visible ? 'kante' : 'kante verdeckt'}" data-kante="${i}" x1="${f(screen[e.a][0])}" y1="${f(screen[e.a][1])}" x2="${f(screen[e.b][0])}" y2="${f(screen[e.b][1])}" />`),
    ...screen.map((p, i) => `<circle class="${visibleVertex.has(i) ? 'ecke' : 'ecke verdeckt'}" data-ecke="${i}" cx="${f(p[0])}" cy="${f(p[1])}" r="${visibleVertex.has(i) ? 4 : 3}" />`),
  ];
}

// ---------------------------------------------------------------------------
// Runde Körper: Achse senkrecht, Kreise als Ellipsen (vorne durchgezogen, hinten gepunktet).

const TILT = 0.32; // Verhältnis der Ellipsenhöhe zur Breite

function ellipseEdge(cx, cy, rx, id, hiddenBack = true) {
  const ry = rx * TILT;
  const front = `<path class="kante" data-kante="${id}" d="M ${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(cx + rx)} ${f(cy)}" />`;
  const back = `<path class="${hiddenBack ? 'kante verdeckt' : 'kante'}" data-kante="${id}" d="M ${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 0 1 ${f(cx + rx)} ${f(cy)}" />`;
  return [front, back];
}

function cylinderFigure() {
  const h = H - 2 * MARGIN - 40;
  const r = h / 4 + 20;
  const [top, bottom] = [H / 2 - h / 2 + 10, H / 2 + h / 2 - 10];
  return [
    `<path class="flaeche" d="M ${f(W / 2 - r)} ${f(top)} L ${f(W / 2 - r)} ${f(bottom)} A ${f(r)} ${f(r * TILT)} 0 0 0 ${f(W / 2 + r)} ${f(bottom)} L ${f(W / 2 + r)} ${f(top)} Z" />`,
    `<ellipse class="flaeche" cx="${W / 2}" cy="${f(top)}" rx="${f(r)}" ry="${f(r * TILT)}" />`,
    `<line class="umriss" x1="${f(W / 2 - r)}" y1="${f(top)}" x2="${f(W / 2 - r)}" y2="${f(bottom)}" />`,
    `<line class="umriss" x1="${f(W / 2 + r)}" y1="${f(top)}" x2="${f(W / 2 + r)}" y2="${f(bottom)}" />`,
    ...ellipseEdge(W / 2, top, r, 0, false),
    ...ellipseEdge(W / 2, bottom, r, 1, true),
    `<line class="achse" x1="${W / 2}" y1="${f(top - 22)}" x2="${W / 2}" y2="${f(bottom + 22)}" />`,
  ];
}

function coneFigure() {
  const h = H - 2 * MARGIN - 20;
  const r = h / 2.2;
  const [apex, base] = [H / 2 - h / 2, H / 2 + h / 2 - 12];
  return [
    `<path class="flaeche" d="M ${W / 2} ${f(apex)} L ${f(W / 2 - r)} ${f(base)} A ${f(r)} ${f(r * TILT)} 0 0 0 ${f(W / 2 + r)} ${f(base)} Z" />`,
    `<line class="umriss" x1="${W / 2}" y1="${f(apex)}" x2="${f(W / 2 - r)}" y2="${f(base)}" />`,
    `<line class="umriss" x1="${W / 2}" y1="${f(apex)}" x2="${f(W / 2 + r)}" y2="${f(base)}" />`,
    ...ellipseEdge(W / 2, base, r, 0, true),
    `<line class="achse" x1="${W / 2}" y1="${f(apex - 16)}" x2="${W / 2}" y2="${f(base + 24)}" />`,
    `<circle class="ecke" data-ecke="0" cx="${W / 2}" cy="${f(apex)}" r="4" />`,
  ];
}

function hemisphereFigure() {
  // Schale mit der ebenen Fläche nach oben: Rand ganz sichtbar, darunter die Wölbung.
  const r = (W - 2 * MARGIN) / 2.4;
  const rim = H / 2 - r / 2 + 6;
  return [
    `<path class="flaeche" d="M ${f(W / 2 - r)} ${f(rim)} A ${f(r)} ${f(r)} 0 0 0 ${f(W / 2 + r)} ${f(rim)} Z" />`,
    `<ellipse class="flaeche" cx="${W / 2}" cy="${f(rim)}" rx="${f(r)}" ry="${f(r * TILT)}" />`,
    `<path class="umriss" d="M ${f(W / 2 - r)} ${f(rim)} A ${f(r)} ${f(r)} 0 0 0 ${f(W / 2 + r)} ${f(rim)}" />`,
    ...ellipseEdge(W / 2, rim, r, 0, false),
    `<line class="achse" x1="${W / 2}" y1="${f(rim - 30)}" x2="${W / 2}" y2="${f(rim + r + 20)}" />`,
  ];
}

function sphereFigure() {
  const r = (H - 2 * MARGIN) / 2;
  const ry = r * TILT;
  return [
    `<circle class="flaeche" cx="${W / 2}" cy="${H / 2}" r="${f(r)}" />`,
    `<circle class="umriss" cx="${W / 2}" cy="${H / 2}" r="${f(r)}" />`,
    // Äquator nur als Hilfslinie: eine Kugel hat keine Kante.
    `<path class="hilfslinie" d="M ${f(W / 2 - r)} ${H / 2} A ${f(r)} ${f(ry)} 0 0 0 ${f(W / 2 + r)} ${H / 2}" />`,
    `<path class="hilfslinie verdeckt" d="M ${f(W / 2 - r)} ${H / 2} A ${f(r)} ${f(ry)} 0 0 1 ${f(W / 2 + r)} ${H / 2}" />`,
    `<ellipse class="glanz" cx="${f(W / 2 - r * 0.35)}" cy="${f(H / 2 - r * 0.4)}" rx="${f(r * 0.22)}" ry="${f(r * 0.14)}" />`,
  ];
}

// ---------------------------------------------------------------------------
// Die 32 Karten

const S3 = Math.sqrt(3);
const FIGURES = {
  A1: () => polygonFigure([[-1, -1], [1, -1], [1, 1], [-1, 1]], [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]),
  A2: () => polygonFigure([[-2, -1], [2, -1], [2, 1], [-2, 1]], [0, Math.PI / 2]),
  A3: () => polygonFigure([[0, -1], [S3, 0], [0, 1], [-S3, 0]], [0, Math.PI / 2]),
  A4: () => polygonFigure([[-1, -1], [1, -1], [2, 1], [-2, 1]], [Math.PI / 2]),
  B1: () => polygonFigure(regular(3), regularAxes(3)),
  B2: () => polygonFigure([[0, 0], [4, 0], [0, -3]]),
  B3: semicircleFigure,
  B4: circleFigure,
  C1: () => polygonFigure(regular(5), regularAxes(5)),
  C2: () => polygonFigure(regular(6), regularAxes(6)),
  C3: () => polygonFigure(regular(8, -Math.PI / 2 + Math.PI / 8), regularAxes(8, -Math.PI / 2 + Math.PI / 8)),
  C4: () => polygonFigure(regular(10), regularAxes(10)),
  D1: () => solidFigure(tetrahedron(), 0.5, 0.35),
  D2: () => solidFigure(prism(4, Math.SQRT2, Math.PI / 4)),
  D3: () => solidFigure(fromTriangles([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]), 0.45, 0.35),
  D4: () => solidFigure(fromTriangles(ICOSA), 0.4, 0.3),
  E1: () => solidFigure(lying(prism(3, 2.6, 0)), 0.6, 0.3),
  E2: () => solidFigure(prism(4, 2 * Math.SQRT2, Math.PI / 4)),
  E3: () => solidFigure(prism(5, 1.4)),
  E4: () => solidFigure(prism(6, 1.4)),
  F1: () => solidFigure(pyramid(4, 1.6, Math.PI / 4)),
  F2: () => solidFigure(pyramid(5, 1.6)),
  F3: () => solidFigure(pyramid(6, 2)),
  F4: () => solidFigure(prism(4, 0.9, Math.PI / 4, 0.5)),
  G1: cylinderFigure,
  G2: coneFigure,
  G3: hemisphereFigure,
  G4: sphereFigure,
  H1: () => polygonFigure(regular(12, -Math.PI / 2 + Math.PI / 12), regularAxes(12, -Math.PI / 2 + Math.PI / 12)),
  H2: () => polygonFigure(star(5, 0.382), regularAxes(5)),
  H3: () => polygonFigure(star(6, 1 / S3), regularAxes(6)),
  H4: () => solidFigure(dodecahedron(), 0.5, 0.35),
};

const STYLE = `
  .flaeche { fill: ${GOLD}; fill-opacity: 0.22; stroke: none; }
  .kante, .umriss { fill: none; stroke: ${INK}; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
  .kante.verdeckt, .hilfslinie.verdeckt { stroke: ${HIDDEN}; stroke-width: 2; stroke-dasharray: 1.5 6; }
  .hilfslinie { fill: none; stroke: ${HIDDEN}; stroke-width: 1.6; }
  .achse { stroke: ${AXIS}; stroke-width: 1.6; stroke-dasharray: 10 7; }
  .ecke { fill: ${INK}; }
  .ecke.verdeckt { fill: ${HIDDEN}; }
  .glanz { fill: #fff8e6; fill-opacity: 0.55; }
`;

let written = 0;
const setPath = resolve(root, 'content/quartett/geometrie.json');
for (const card of set.cards) {
  card.image = `bub-quartett-geometrie-${card.id.toLowerCase()}.svg`;
  const draw = FIGURES[card.id];
  if (!draw) throw new Error(`Keine Zeichnung für ${card.id}`);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${card.name}">`,
    `<defs><radialGradient id="pergament" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#f7eed6"/><stop offset="1" stop-color="#e3cf9f"/></radialGradient><style>${STYLE.replace(/\s+/g, ' ')}</style></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#pergament)" />`,
    ...draw(),
    '</svg>',
  ].join('\n');
  writeFileSync(resolve(out, `bub-quartett-geometrie-${card.id.toLowerCase()}.svg`), `${svg}\n`);
  written++;
}
// Das Set nennt je Karte ihr Bild (Medienname, auch für Anki).
writeFileSync(setPath, `${JSON.stringify(set, null, 2)}\n`);
console.log(`${written} Zeichnungen in content/quartett/bilder/geometrie/, Feld „image“ in geometrie.json`);
