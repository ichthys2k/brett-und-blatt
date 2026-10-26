import { cardName, cardRank, cardSuit, isRed, rankLabel, type CardId, type Suit } from '@brett-und-blatt/engine';
import type { CSSProperties, MouseEventHandler } from 'react';

export type DeckStyle = 'french' | 'four-color' | 'bavarian' | 'german';

/** Farbzeichen als SVG-Pfade (Feld 0–100) */
export function SuitShape({
  suit,
  deckStyle = 'french',
  x = 0,
  y = 0,
  size = 100,
}: {
  suit: Suit;
  deckStyle?: DeckStyle;
  x?: number;
  y?: number;
  size?: number;
}) {
  const scale = size / 100;
  const isGermanic = deckStyle === 'bavarian' || deckStyle === 'german';

  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* Herz: Französisch wie Deutsch/Bayerisch gleich */}
      {suit === 'H' && <path d="M50 90C20 66 4 49 4 30 4 14 16 4 30 4c10 0 17 6 20 14 3-8 10-14 20-14 14 0 26 10 26 26 0 19-16 36-46 60z" />}

      {/* Karo (französisch) vs. Schellen (deutsch/bayerisch) */}
      {suit === 'D' &&
        (!isGermanic ? (
          <path d="M50 2 86 50 50 98 14 50z" />
        ) : (
          /* Schelle: runde Glocke mit Aufhängung und Schallschlitz */
          <g>
            <circle cx="50" cy="18" r="8" fill="none" stroke="currentColor" strokeWidth="6" />
            <circle cx="50" cy="56" r="38" />
            <line x1="22" y1="64" x2="78" y2="64" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            <circle cx="30" cy="64" r="5" fill="#fff" />
            <circle cx="70" cy="64" r="5" fill="#fff" />
          </g>
        ))}

      {/* Pik (französisch) vs. Gras/Grün (deutsch/bayerisch) */}
      {suit === 'S' &&
        (!isGermanic ? (
          <path d="M50 4c30 26 46 40 46 57 0 15-11 23-23 23-9 0-16-4-20-11 1 10 5 17 12 23H35c7-6 11-13 12-23-4 7-11 11-20 11C15 84 4 76 4 61 4 44 20 30 50 4z" />
        ) : (
          /* Grasblatt: spitz zulaufendes Laubblatt mit Mittelrippe */
          <g>
            <path d="M50 6 C25 24 18 52 32 78 C38 88 44 94 50 96 C56 94 62 88 68 78 C82 52 75 24 50 6 Z" />
            <path d="M50 26 L50 92" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          </g>
        ))}

      {/* Kreuz (französisch) vs. Eichel (deutsch/bayerisch) */}
      {suit === 'C' &&
        (!isGermanic ? (
          <>
            <circle cx="50" cy="27" r="21" />
            <circle cx="26" cy="58" r="21" />
            <circle cx="74" cy="58" r="21" />
            <path d="M45 50c0 22-4 34-12 46h34c-8-12-12-24-12-46z" />
          </>
        ) : (
          /* Eichel: Hütchen oben mit Stiel und Eichelkörper unten */
          <g>
            <rect x="47" y="6" width="6" height="16" rx="2" />
            <path d="M26 30 C26 22 74 22 74 30 L76 38 C76 40 24 40 24 38 Z" />
            <path d="M28 40 C28 68 40 92 50 96 C60 92 72 68 72 40 Z" />
          </g>
        ))}
    </g>
  );
}

export function cardSuitColor(suit: Suit, deckStyle: DeckStyle = 'french'): string {
  if (deckStyle === 'four-color') {
    switch (suit) {
      case 'C':
        return 'var(--bub-card-black, #1f2328)'; // Kreuz: Schwarz
      case 'S':
        return '#2e7d32'; // Pik: Grün
      case 'H':
        return 'var(--bub-card-red, #c62828)'; // Herz: Rot
      case 'D':
        return '#d97706'; // Karo: Goldgelb
    }
  }

  if (deckStyle === 'bavarian' || deckStyle === 'german') {
    switch (suit) {
      case 'C':
        return '#5d4037'; // Eichel: Braun
      case 'S':
        return '#2e7d32'; // Gras: Grün
      case 'H':
        return 'var(--bub-card-red, #c62828)'; // Herz: Rot
      case 'D':
        return '#d97706'; // Schellen: Goldgelb
    }
  }

  // french standard: Rot für H/D, Schwarz für C/S
  return suit === 'H' || suit === 'D' ? 'var(--bub-card-red, #c62828)' : 'var(--bub-card-black, #1f2328)';
}

export function getRankLabel(rank: number, deckStyle: DeckStyle = 'french'): string {
  if (deckStyle === 'bavarian') {
    if (rank === 1) return 'S'; // Sau
    if (rank === 11) return 'U'; // Unter
    if (rank === 12) return 'O'; // Ober
    if (rank === 13) return 'K'; // König
  }
  if (deckStyle === 'german') {
    if (rank === 1) return 'A'; // Ass / Daus
    if (rank === 11) return 'U'; // Unter
    if (rank === 12) return 'O'; // Ober
    if (rank === 13) return 'K'; // König
  }
  return rankLabel(rank);
}

export interface PlayingCardProps {
  /** Die Karte – oder null für eine verdeckte Karte. */
  card: CardId | null;
  selected?: boolean;
  /** Hervorhebung, z. B. als mögliches Ziel oder als Tipp. */
  highlight?: 'target' | 'hint' | null;
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
  style?: CSSProperties;
  /** Text für Screenreader, falls abweichend vom Kartennamen. */
  label?: string;
  deckStyle?: DeckStyle;
  /** Optionale Animation (z. B. 'drop' beim Ausspielen, 'shake' bei Erschütterung, 'deal' beim Austeilen). */
  anim?: 'drop' | 'shake' | 'deal' | null;
}

/**
 * Eine Spielkarte (französisches, 4-farbiges oder bayerisch/deutsches Blatt).
 * Die Größe bestimmt die umgebende Breite (Seitenverhältnis 5:7); Vorderseiten werden als SVG gezeichnet.
 */
export function PlayingCard({
  card,
  selected,
  highlight,
  onClick,
  className = '',
  style,
  label,
  deckStyle = 'french',
  anim,
}: PlayingCardProps) {
  const animClass = anim ? `bub-animate-${anim}` : '';
  const classes = `bub-card ${selected ? 'bub-card-selected' : ''} ${highlight ? `bub-card-${highlight}` : ''} ${onClick ? 'bub-card-clickable' : ''} ${animClass} ${className}`;
  const content = card === null ? <span className="bub-card-back" /> : <CardFace card={card} deckStyle={deckStyle} />;
  const name = label ?? (card === null ? 'verdeckte Karte' : cardName(card));
  return onClick ? (
    <button type="button" className={classes} style={style} onClick={onClick} aria-label={name} aria-pressed={selected || undefined}>
      {content}
    </button>
  ) : (
    <span className={classes} style={style} role="img" aria-label={name}>
      {content}
    </span>
  );
}

function CardFace({ card, deckStyle = 'french' }: { card: CardId; deckStyle?: DeckStyle }) {
  const suit = cardSuit(card);
  const rank = cardRank(card);
  const label = getRankLabel(rank, deckStyle);
  const color = cardSuitColor(suit, deckStyle);

  return (
    <svg viewBox="0 0 250 350" className="bub-card-face" aria-hidden="true">
      <rect x="2" y="2" width="246" height="346" rx="20" fill="#fff" stroke="#c9c2b6" strokeWidth="3" />
      <g fill={color}>
        <text x="20" y="72" fontSize="70" fontWeight="700" fontFamily="system-ui, sans-serif" letterSpacing="-4">
          {label}
        </text>
        <SuitShape suit={suit} deckStyle={deckStyle} x={22} y={84} size={44} />
        <g transform="rotate(180 125 175)">
          <text x="20" y="72" fontSize="70" fontWeight="700" fontFamily="system-ui, sans-serif" letterSpacing="-4">
            {label}
          </text>
          <SuitShape suit={suit} deckStyle={deckStyle} x={22} y={84} size={44} />
        </g>
        {rank > 10 ? (
          <>
            <text x="125" y="200" fontSize="120" fontWeight="700" fontFamily="Georgia, serif" textAnchor="middle">
              {label}
            </text>
            <SuitShape suit={suit} deckStyle={deckStyle} x={100} y={220} size={50} />
          </>
        ) : (
          <SuitShape suit={suit} deckStyle={deckStyle} x={rank === 1 ? 55 : 70} y={rank === 1 ? 105 : 120} size={rank === 1 ? 140 : 110} />
        )}
      </g>
    </svg>
  );
}
