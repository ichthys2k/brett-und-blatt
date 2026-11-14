/**
 * Tönung neutraler Figuren (#325): Die Bilder für Vierer-Schach, Ludo und Chinesisches Dame sind cremefarben.
 * Ein SVG-Filter multipliziert die Helligkeit mit der Farbe des Platzes, die Schattierung bleibt erhalten.
 */
function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** Kennung des Filters zu einer Farbe, z. B. `bub-tint-dc2626`. */
export const tintId = (color: string): string => `bub-tint-${color.replace('#', '').toLowerCase()}`;

/** Der Wert für `filter` (CSS) bzw. das Attribut `filter` (SVG). */
export const tintFilter = (color: string): string => `url(#${tintId(color)})`;

const GAIN = 1.45;

/** Der Filter selbst; gehört in ein `<defs>` oder einen unsichtbaren `<svg>` im selben Dokument. */
export function TintFilter({ color }: { color: string }) {
  const [r, g, b] = parse(color);
  const row = (c: number) => `${(c * 0.3 * GAIN).toFixed(3)} ${(c * 0.59 * GAIN).toFixed(3)} ${(c * 0.11 * GAIN).toFixed(3)} 0 0`;
  return (
    <filter id={tintId(color)} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={`${row(r)} ${row(g)} ${row(b)} 0 0 0 1 0`} />
    </filter>
  );
}

/** Unsichtbarer SVG mit den Filtern für HTML-Figuren (Vierer-Schach). */
export function TintFilters({ colors }: { colors: readonly string[] }) {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        {colors.map((color) => (
          <TintFilter key={color} color={color} />
        ))}
      </defs>
    </svg>
  );
}
