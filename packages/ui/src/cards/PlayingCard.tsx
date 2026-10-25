import { cardName, cardRank, cardSuit, isRed, rankLabel, type CardId, type Suit } from '@brett-und-blatt/engine';
import type { CSSProperties, MouseEventHandler } from 'react';

/** Farbzeichen als SVG-Pfade (Feld 0–100) – zuverlässiger als Schriftzeichen, die manche Handys als Emoji zeigen. */
export function SuitShape({ suit, x = 0, y = 0, size = 100 }: { suit: Suit; x?: number; y?: number; size?: number }) {
  const scale = size / 100;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {suit === 'H' && <path d="M50 90C20 66 4 49 4 30 4 14 16 4 30 4c10 0 17 6 20 14 3-8 10-14 20-14 14 0 26 10 26 26 0 19-16 36-46 60z" />}
      {suit === 'D' && <path d="M50 2 86 50 50 98 14 50z" />}
      {suit === 'S' && (
        <path d="M50 4c30 26 46 40 46 57 0 15-11 23-23 23-9 0-16-4-20-11 1 10 5 17 12 23H35c7-6 11-13 12-23-4 7-11 11-20 11C15 84 4 76 4 61 4 44 20 30 50 4z" />
      )}
      {suit === 'C' && (
        <>
          <circle cx="50" cy="27" r="21" />
          <circle cx="26" cy="58" r="21" />
          <circle cx="74" cy="58" r="21" />
          <path d="M45 50c0 22-4 34-12 46h34c-8-12-12-24-12-46z" />
        </>
      )}
    </g>
  );
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
}

/**
 * Eine Spielkarte im französischen Blatt. Die Größe bestimmt die umgebende Breite
 * (Seitenverhältnis 5:7); Vorderseiten werden als SVG aus den Kartendaten gezeichnet.
 */
export function PlayingCard({ card, selected, highlight, onClick, className = '', style, label }: PlayingCardProps) {
  const classes = `bub-card ${selected ? 'bub-card-selected' : ''} ${highlight ? `bub-card-${highlight}` : ''} ${onClick ? 'bub-card-clickable' : ''} ${className}`;
  const content = card === null ? <span className="bub-card-back" /> : <CardFace card={card} />;
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

function CardFace({ card }: { card: CardId }) {
  const suit = cardSuit(card);
  const rank = cardRank(card);
  const label = rankLabel(rank);
  const color = isRed(card) ? 'var(--bub-card-red, #c62828)' : 'var(--bub-card-black, #1f2328)';
  return (
    <svg viewBox="0 0 250 350" className="bub-card-face" aria-hidden="true">
      <rect x="2" y="2" width="246" height="346" rx="20" fill="#fff" stroke="#c9c2b6" strokeWidth="3" />
      <g fill={color}>
        <text x="20" y="72" fontSize="70" fontWeight="700" fontFamily="system-ui, sans-serif" letterSpacing="-4">
          {label}
        </text>
        <SuitShape suit={suit} x={22} y={84} size={44} />
        <g transform="rotate(180 125 175)">
          <text x="20" y="72" fontSize="70" fontWeight="700" fontFamily="system-ui, sans-serif" letterSpacing="-4">
            {label}
          </text>
          <SuitShape suit={suit} x={22} y={84} size={44} />
        </g>
        {rank > 10 ? (
          <>
            <text x="125" y="200" fontSize="120" fontWeight="700" fontFamily="Georgia, serif" textAnchor="middle">
              {label}
            </text>
            <SuitShape suit={suit} x={100} y={220} size={50} />
          </>
        ) : (
          <SuitShape suit={suit} x={rank === 1 ? 55 : 70} y={rank === 1 ? 105 : 120} size={rank === 1 ? 140 : 110} />
        )}
      </g>
    </svg>
  );
}
