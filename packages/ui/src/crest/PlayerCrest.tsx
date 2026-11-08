import { CREST_LABELS, CREST_PALETTE, type CrestSpec } from '@brett-und-blatt/engine';
import { useId } from 'react';

/*
 * Das Wappen eines Passes als SVG (Vorhaben #135, Schritt #147). Die Beschreibung (`CrestSpec`) kommt aus der Engine und
 * ist dort geprüft; hier wird nur gezeichnet. Die Linienfarbe ist `currentColor`, auf hellem Grund also dunkel und auf
 * dunklem hell. Bei kleinen Größen bleiben nur Schild, Farben und Tier; Zier fällt weg.
 */

const SHIELDS = {
  klassisch: 'M10 30 H90 V76 C90 106 70 124 50 132 C30 124 10 106 10 76 Z',
  rund: 'M10 30 H90 V84 A40 40 0 0 1 10 84 Z',
  spitz: 'M10 30 H90 V72 L50 132 L10 72 Z',
  rolle: 'M10 30 H36 Q50 42 64 30 H90 V76 C90 106 70 124 50 132 C30 124 10 106 10 76 Z',
} as const;
/** Das Tierfeld sitzt bei der spitzen Form etwas höher, weil unten weniger Platz ist. */
const MEDALLION_Y = { klassisch: 80, rund: 80, spitz: 76, rolle: 80 } as const;
/** Ab dieser Breite (px) wird die Zier gezeichnet. */
export const CREST_ORNAMENT_MIN_SIZE = 56;

export interface PlayerCrestProps {
  spec: CrestSpec;
  /** Breite in px; die Höhe folgt. */
  size?: number;
  /** Sichtbarer Name für Screenreader, z. B. „Wappen von Mia“. */
  label?: string;
  className?: string;
}

export function PlayerCrest({ spec, size = 64, label, className }: PlayerCrestProps) {
  const id = useId().replace(/:/g, '');
  const small = size < CREST_ORNAMENT_MIN_SIZE;
  const [a, b] = CREST_PALETTE[spec.colors];
  const path = SHIELDS[spec.shield];
  const y = MEDALLION_Y[spec.shield];
  const ornaments = small ? [] : spec.ornaments;
  const has = (name: string) => ornaments.includes(name as never);
  const viewBox = small ? '10 28 80 106' : '0 0 100 150';
  const height = small ? (size * 106) / 80 : size * 1.5;
  const stroke = small ? 5 : size < 100 ? 3.5 : 3;
  const text = `${label ?? 'Wappen'}: ${spec.animal}, ${CREST_LABELS.colors[spec.colors]}, ${CREST_LABELS.division[spec.division]}${ornaments.length > 0 ? `, ${ornaments.map((item) => CREST_LABELS.ornament[item]).join(', ')}` : ''}`;
  return (
    <svg viewBox={viewBox} width={size} height={height} className={className} role="img" aria-label={text} style={{ flex: 'none' }}>
      <defs>
        <clipPath id={`crest-${id}`}>
          <path d={path} />
        </clipPath>
      </defs>
      <g clipPath={`url(#crest-${id})`}>
        <rect width="100" height="150" fill={a} />
        {spec.division === 'quer' && <rect y="82" width="100" height="70" fill={b} />}
        {spec.division === 'geteilt' && <rect x="50" width="50" height="150" fill={b} />}
        {spec.division === 'schraeg' && <polygon points="0,150 100,30 100,150" fill={b} />}
      </g>
      {has('rahmen') && <path d={path} transform="translate(50 81) scale(.86) translate(-50 -81)" fill="none" stroke="#FFF7E3" strokeWidth="2.4" />}
      <path d={path} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
      {has('lorbeer') && (
        <>
          <path d="M6 124 C-4 100 -4 72 8 50" fill="none" stroke="#2E7D32" strokeWidth="6" strokeDasharray="7 4" strokeLinecap="round" />
          <path d="M94 124 C104 100 104 72 92 50" fill="none" stroke="#2E7D32" strokeWidth="6" strokeDasharray="7 4" strokeLinecap="round" />
        </>
      )}
      {has('krone') && <path d="M30 26 L33 8 L42 18 L50 4 L58 18 L67 8 L70 26 Z" fill="#E0A800" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />}
      <circle cx="50" cy={y} r={small ? 26 : 20} fill="#FFF7E3" stroke="currentColor" strokeWidth={small ? 4 : 2} />
      <text x="50" y={y + (small ? 12 : 9)} textAnchor="middle" fontSize={small ? 36 : 26} aria-hidden="true">
        {spec.animal}
      </text>
      {has('band') && <path d="M16 126 H84 L78 135 L84 144 H16 L22 135 Z" fill={b} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />}
    </svg>
  );
}
