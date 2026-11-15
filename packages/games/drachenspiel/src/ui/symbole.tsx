/**
 * Symbolsatz des Drachenspiels (#434, Strang #425, Glied S1): Wertesymbole (Angriff, Leben, Kosten,
 * Rüstung) und je ein Zeichen für jedes Schlüsselwort, dazu Rand-Effekte um das Kartenbild.
 *
 * Alles ist reines SVG mit dicker Kontur, damit es auch bei etwa 20 px erkennbar bleibt; die Formen
 * unterscheiden sich, Farbe ist nie das einzige Merkmal. Zahlen bleiben Text über dem Symbol.
 * Eingebaut werden die Bausteine erst in S2 bis S4 (Feld-, Hand- und Zoomkarte).
 */
import type { ReactNode } from 'react';
import type { KeywordId } from '../types';
import { TRAIT_DEFINITIONS } from './traits';
import './symbole.css';

/** Größenstufen der Karten: Feld (klein), Hand (mittel), Zoom (Großansicht). */
export type SymbolSize = 'feld' | 'hand' | 'zoom';
export type StatKind = 'attack' | 'health' | 'cost' | 'armor';
/** Unverändert, verstärkt (über dem Grundwert) oder verletzt bzw. verbilligt/verteuert unter dem Grundwert. */
export type StatState = 'base' | 'buffed' | 'hurt';

const OUTLINE = '#1a120a';
const GLYPH = '#fffaf0';

export const STAT_NAMES: Record<StatKind, string> = {
  attack: 'Angriff',
  health: 'Ausdauer',
  cost: 'Knappen',
  armor: 'Rüstung',
};

/** Bei den Kosten heißt „verstärkt“ verbilligt (grün) und „verletzt“ verteuert (rot). */
function stateName(kind: StatKind, state: StatState): string {
  if (state === 'base') return '';
  if (kind === 'cost') return state === 'buffed' ? 'verbilligt' : 'verteuert';
  return state === 'buffed' ? 'verstärkt' : kind === 'armor' ? 'geschwächt' : 'verletzt';
}

/** Grundformen der Wertesymbole im Raster 32 × 32. */
const STAT_SHAPES: Record<StatKind, ReactNode> = {
  attack: (
    <>
      <path d="M16 1.5 L26 9 V21 H6 V9 Z" fill="#e3a72f" />
      <path d="M16 1.5 L26 9 L16 11 L6 9 Z" fill="#fff" opacity="0.3" stroke="none" />
      <path d="M3 21 H29 V25.5 H3 Z" fill="#8a5a1c" />
      <path d="M13 25.5 H19 V30.5 H13 Z" fill="#5b3a12" />
    </>
  ),
  health: (
    <>
      <path d="M16 29.5 C6 22.5 2 16.5 3 11 C4 5.5 10.5 3 16 8.6 C21.5 3 28 5.5 29 11 C30 16.5 26 22.5 16 29.5 Z" fill="#d23a2e" />
      <path d="M8 9.5 C9 7.6 11 7 12.6 7.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
    </>
  ),
  cost: (
    <>
      <path d="M16 1.8 L28.2 8.8 V23.2 L16 30.2 L3.8 23.2 V8.8 Z" fill="#2f6fd6" />
      <path d="M16 1.8 L28.2 8.8 L16 12 L3.8 8.8 Z" fill="#fff" opacity="0.32" stroke="none" />
      <path d="M16 30.2 L28.2 23.2 L16 21 L3.8 23.2 Z" fill="#000" opacity="0.18" stroke="none" />
    </>
  ),
  armor: (
    <>
      <path d="M16 2 L28 6 V15 C28 22 23 27 16 30 C9 27 4 22 4 15 V6 Z" fill="#8e9aa8" />
      <path d="M16 5.5 L24.5 8.4 V15 C24.5 20 21 23.8 16 26.2 C11 23.8 7.5 20 7.5 15 V8.4 Z" fill="none" stroke="#e8eef4" strokeWidth="1.6" opacity="0.7" />
    </>
  ),
};

/** Eckzeichen für den Zustand: Spitze nach oben = verstärkt, nach unten = verletzt (Form statt nur Farbe). */
const STATE_MARKS: Record<Exclude<StatState, 'base'>, ReactNode> = {
  buffed: <path d="M26.5 0.8 L31.4 7.6 H21.6 Z" fill="#3ccf62" />,
  hurt: <path d="M21.6 0.8 H31.4 L26.5 7.6 Z" fill="#ff5a48" />,
};

export interface StatGemProps {
  kind: StatKind;
  value: number;
  state?: StatState;
  size?: SymbolSize;
  className?: string;
}

/** Ein Wert als Symbol mit großer Zahl, z. B. Angriff als Schwert, Leben als Herz, Kosten als Edelstein. */
export function StatGem({ kind, value, state = 'base', size = 'hand', className }: StatGemProps) {
  const label = [`${STAT_NAMES[kind]} ${value}`, stateName(kind, state)].filter(Boolean).join(', ');
  return (
    <span
      className={`ds-sym-stat ds-sym-stat-${kind} ds-sym-${size}${className ? ` ${className}` : ''}`}
      data-state={state}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round">
        {STAT_SHAPES[kind]}
        {state !== 'base' && STATE_MARKS[state]}
      </svg>
      <span className="ds-sym-num">{value}</span>
    </span>
  );
}

export type EdgeKind = 'shield' | 'bubble' | 'veil' | 'ice';

interface KeywordSymbol {
  /** Hintergrund des runden Zeichens. */
  color: string;
  /** Zeichen im Raster 24 × 24 (wird im Kreis verkleinert). */
  glyph: ReactNode;
  /** Rand-Effekt um das Kartenbild, wo er passt. */
  edge?: EdgeKind;
}

const fill = { fill: GLYPH, stroke: 'none' } as const;
const line = (width = 2.8) => ({ fill: 'none', stroke: GLYPH, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round' }) as const;

/** Je Schlüsselwort ein Zeichen. Der Typ verlangt jedes Schlüsselwort aus `TRAIT_DEFINITIONS`. */
export const KEYWORD_SYMBOLS: Record<KeywordId, KeywordSymbol> = {
  taunt: {
    color: '#6b7280',
    edge: 'shield',
    glyph: <path d="M12 3.5 L19.5 6.2 V12 C19.5 16.3 16.4 19 12 20.6 C7.6 19 4.5 16.3 4.5 12 V6.2 Z" {...fill} />,
  },
  stealth: {
    color: '#3b2a6b',
    edge: 'veil',
    glyph: <path d="M14.5 3.6 A8.6 8.6 0 1 0 20.4 15.4 A7 7 0 0 1 14.5 3.6 Z" {...fill} />,
  },
  bubble: {
    color: '#c08f12',
    edge: 'bubble',
    glyph: (
      <>
        <circle cx="12" cy="12" r="7.4" {...line(2.8)} />
        <path d="M8.2 10.6 A4.2 4.2 0 0 1 10.8 7.9" {...line(2.4)} />
      </>
    ),
  },
  poisonous: {
    color: '#3f8f2f',
    glyph: (
      <>
        <path d="M9.6 3.5 H14.4 V9 L19.2 17.6 C20 19.1 19 20.5 17.3 20.5 H6.7 C5 20.5 4 19.1 4.8 17.6 L9.6 9 Z" {...fill} />
        <circle cx="11" cy="16.4" r="1.6" fill="#3f8f2f" stroke="none" />
      </>
    ),
  },
  rush: {
    color: '#d9641e',
    glyph: <path d="M13.6 2.6 L5.6 13.6 H10.8 L9.2 21.4 L18.4 9.6 H13 Z" {...fill} />,
  },
  sprinter: {
    color: '#158a8a',
    glyph: <path d="M4.8 6 L10.8 12 L4.8 18 M12.2 6 L18.2 12 L12.2 18" {...line(3.2)} />,
  },
  doubleStrike: {
    color: '#a02b2b',
    glyph: <path d="M5 16 L13 4.5 M10.5 19.5 L18.5 8" {...line(3.4)} />,
  },
  lifesteal: {
    color: '#2f9e55',
    glyph: (
      <>
        <path d="M12 20.4 C5 15.4 3.3 11.6 4.3 8.4 C5.3 5.2 9.4 4.2 12 7.6 C14.6 4.2 18.7 5.2 19.7 8.4 C20.7 11.6 19 15.4 12 20.4 Z" {...fill} />
        <path d="M12 9.6 V15.4 M9.1 12.5 H14.9" fill="none" stroke="#2f9e55" strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
  },
  frostbite: {
    color: '#3a8fd0',
    edge: 'ice',
    glyph: <path d="M12 3.6 V20.4 M4.7 7.8 L19.3 16.2 M4.7 16.2 L19.3 7.8 M9.6 4.8 L12 7 L14.4 4.8 M9.6 19.2 L12 17 L14.4 19.2" {...line(2.5)} />,
  },
  reborn: {
    color: '#6aa62b',
    glyph: (
      <>
        <path d="M12 20.5 V11.5" {...line(2.8)} />
        <path d="M12 13 C7 13 4.6 10 4.6 6.2 C9 6.2 12 8.6 12 13 Z" {...fill} />
        <path d="M12 11.6 C12 7.2 14.8 4.4 19.4 4.4 C19.4 8.8 16.6 11.6 12 11.6 Z" {...fill} />
      </>
    ),
  },
  immune: {
    color: '#7a4bb5',
    glyph: <path d="M12.2 12 C13.6 12 13.6 9.9 12 9.9 C9.7 9.9 9.7 14 12.4 14 C16 14 16 7.8 12 7.8 C7.2 7.8 7 16.4 12.4 16.4 C17.8 16.4 19.4 10 17 6.4" {...line(2.4)} />,
  },
  elusive: {
    color: '#7d7a3a',
    glyph: (
      <>
        <path d="M4.6 19.4 C4.6 10.2 9.6 4.6 19.4 4.6 C19.4 14 14 19.4 4.6 19.4 Z" {...fill} />
        <path d="M6.4 17.6 L14.6 9.4" fill="none" stroke="#7d7a3a" strokeWidth="1.9" strokeLinecap="round" />
      </>
    ),
  },
  tradeable: {
    color: '#4a6a8a',
    glyph: (
      <>
        <path d="M5.6 11 A6.6 6.6 0 0 1 16.6 7.2" {...line(2.6)} />
        <path d="M19.6 3.8 L19.4 10 L13.6 8.4 Z" {...fill} />
        <path d="M18.4 13 A6.6 6.6 0 0 1 7.4 16.8" {...line(2.6)} />
        <path d="M4.4 20.2 L4.6 14 L10.4 15.6 Z" {...fill} />
      </>
    ),
  },
};

export interface KeywordMarkProps {
  keyword: KeywordId;
  size?: SymbolSize;
  className?: string;
}

/** Rundes Zeichen für ein Schlüsselwort, etwa in der Reihe der Statussymbole unter dem Bild. */
export function KeywordMark({ keyword, size = 'hand', className }: KeywordMarkProps) {
  const symbol = KEYWORD_SYMBOLS[keyword];
  const trait = TRAIT_DEFINITIONS[keyword];
  return (
    <span
      className={`ds-sym-mark ds-sym-${size}${className ? ` ${className}` : ''}`}
      data-keyword={keyword}
      role="img"
      aria-label={trait.name}
      title={`${trait.name}: ${trait.description}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="10.8" fill={symbol.color} stroke={OUTLINE} strokeWidth="1.8" />
        <circle cx="12" cy="12" r="9.2" fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.35" />
        <g transform="translate(12 12) scale(0.8) translate(-12 -12)">{symbol.glyph}</g>
      </svg>
    </span>
  );
}

/** Schlüsselwörter mit Rand-Effekt, in fester Zeichenreihenfolge (Schleier innen, Schildwall außen). */
const EDGE_ORDER: EdgeKind[] = ['veil', 'ice', 'bubble', 'shield'];

export function edgesFor(keywords: readonly KeywordId[]): EdgeKind[] {
  const present = new Set(keywords.map((k) => KEYWORD_SYMBOLS[k].edge).filter((e): e is EdgeKind => !!e));
  return EDGE_ORDER.filter((e) => present.has(e));
}

/**
 * Rand-Effekte über einem Kartenbild. Der Elternbaustein braucht `position: relative`; die Ebenen
 * übernehmen dessen `border-radius` (Oval der Feldkarte, Rechteck der Handkarte).
 */
export function KeywordEdges({ keywords }: { keywords: readonly KeywordId[] }) {
  const edges = edgesFor(keywords);
  if (edges.length === 0) return null;
  return (
    <>
      {edges.map((edge) => (
        <span key={edge} className={`ds-sym-edge ds-sym-edge-${edge}`} aria-hidden="true" />
      ))}
    </>
  );
}
