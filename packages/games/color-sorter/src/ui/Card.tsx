import { cardId, type CardId, type Suit } from '@brett-und-blatt/engine';
import { PlayingCard, type DeckStyle } from '@brett-und-blatt/ui';
import { createContext, useContext, type CSSProperties, type MouseEventHandler, type ReactNode } from 'react';
import { ACE, cardLabel, rankChips } from '../cards';
import { ENHANCEMENTS, FOILS, SEALS } from '../content';
import type { Card, Color, ViewCard } from '../types';
import { useTipProps, type ExtraProps, type Tip } from './Hover';

/** Emoji auf dem Kartenrücken (Schmuck aus dem Atelier). */
export const BackContext = createContext('🃏');

/** Kartenbild (französisch oder vierfarbig), je Gerät gewählt. */
export const DeckStyleContext = createContext<DeckStyle>('four-color');

const SUIT: Record<Color, Suit> = { h: 'H', s: 'S', d: 'D', c: 'C' };

/** Kennung für die gemeinsame Spielkarte aus `packages/ui` (Ass dort als 1). */
export function toCardId(card: Card): CardId {
  return cardId(SUIT[card.color], card.rank === ACE ? 1 : card.rank);
}

export const isOpen = (card: ViewCard | Card): card is Card => !('hidden' in card);

/** Text zu einer Karte, z. B. für den Hinweis unter der Hand. */
export function cardDetails(card: Card): string[] {
  const lines = [cardLabel(card)];
  if (card.enh) lines.push(`${ENHANCEMENTS[card.enh].emoji} ${ENHANCEMENTS[card.enh].name}: ${ENHANCEMENTS[card.enh].text}`);
  if (card.foil) lines.push(`${FOILS[card.foil].emoji} ${FOILS[card.foil].name}: ${FOILS[card.foil].text}`);
  if (card.seal) lines.push(`${SEALS[card.seal].emoji} ${SEALS[card.seal].name}: ${SEALS[card.seal].text}`);
  if (card.bonus) lines.push(`+${card.bonus} Witz dauerhaft`);
  return lines;
}

/** Sprechblase zu einer Karte: Rang und Farbe, Witz, Veredelung, Glanz und Abzeichen. */
export function cardTip(card: ViewCard): Tip {
  if (!isOpen(card)) return { emoji: '🂠', title: 'Verdeckte Karte', lines: ['Rang und Farbe sind verborgen.'] };
  const [title, ...rest] = cardDetails(card);
  const lines = card.enh === 'granite' ? rest : [`Zählt ${rankChips(card.rank)} Witz`, ...rest];
  return { title: title!, lines };
}

interface CardViewProps {
  card: ViewCard;
  selected?: boolean;
  dim?: boolean;
  hint?: boolean;
  pop?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
  className?: string;
  /** Ziehen und weitere Eigenschaften des Elements. */
  extra?: ExtraProps;
  /** Eigene Sprechblase statt der automatischen. */
  tip?: Tip;
}

/** Spielkarte: die gemeinsame `PlayingCard`, darüber Schneiderei, Wappen und Glanz als Abzeichen. */
export function CardView({ card, selected, dim, hint, pop, onClick, style, className = '', extra, tip }: CardViewProps) {
  const open = isOpen(card);
  const backEmoji = useContext(BackContext);
  const deckStyle = useContext(DeckStyleContext);
  const classes = [
    'cs-card',
    open ? (card.enh === 'granite' ? 'cs-c-granite' : 'cs-face') : 'cs-back',
    selected ? 'cs-selected' : '',
    dim ? 'cs-dim' : '',
    hint ? 'cs-hint' : '',
    open && card.foil ? `cs-foil-${card.foil}` : '',
    className,
  ].join(' ');
  const label = open ? cardDetails(card).join('. ') : 'verdeckte Karte';
  const props = useTipProps(tip ?? cardTip(card), extra);
  const merged = { ...style, ...props.style };
  const body = open ? (
    <>
      {card.enh === 'granite' ? (
        <span className="cs-rank-big" aria-hidden="true">
          🧱
        </span>
      ) : (
        <span className="cs-face-art" aria-hidden="true">
          <PlayingCard card={toCardId(card)} deckStyle={deckStyle} />
        </span>
      )}
      {card.enh && card.enh !== 'granite' && (
        <span className="cs-enh" aria-hidden="true">
          {ENHANCEMENTS[card.enh].emoji}
        </span>
      )}
      {card.seal && (
        <span className="cs-seal" aria-hidden="true">
          {SEALS[card.seal].emoji}
        </span>
      )}
    </>
  ) : (
    <span className="cs-back-mark" aria-hidden="true">
      {backEmoji}
    </span>
  );
  return onClick ? (
    <button type="button" {...props} className={`${classes} ${props.className ?? ''}`} style={merged} onClick={onClick} aria-label={label} aria-pressed={selected || undefined}>
      {body}
      {pop && <span className="cs-pop">{pop}</span>}
    </button>
  ) : (
    <span {...(props as object)} className={`${classes} ${props.className ?? ''}`} style={merged} role="img" aria-label={label}>
      {body}
      {pop && <span className="cs-pop">{pop}</span>}
    </span>
  );
}

interface TileProps {
  emoji: string;
  title: string;
  sub?: ReactNode;
  badge?: ReactNode;
  tone?: string;
  selected?: boolean;
  hint?: boolean;
  dim?: boolean;
  pop?: ReactNode;
  onClick?: () => void;
  className?: string;
  label?: string;
  tip?: Tip;
  extra?: ExtraProps;
  /** Wirkung als Text: erscheint nur am Desktop, wo die Kachel zur großen Karte wird. */
  body?: ReactNode;
  foot?: ReactNode;
}

/** Kachel für Mods, Zauberkarten, Angebote und Lieferungen. */
export function Tile({ emoji, title, sub, badge, tone = '', selected, hint, dim, pop, onClick, className = '', label, tip, extra, body: text, foot }: TileProps) {
  const props = useTipProps(tip, extra);
  const classes = ['cs-tile', text !== undefined ? 'cs-tile-text' : '', tone, selected ? 'cs-selected' : '', hint ? 'cs-hint' : '', dim ? 'cs-dim' : '', className].join(' ');
  const body = (
    <>
      <span className="cs-tile-emoji" aria-hidden="true">
        {emoji}
      </span>
      <span className="cs-tile-title">{title}</span>
      {text !== undefined && <span className="cs-tile-body">{text}</span>}
      {sub !== undefined && <span className="cs-tile-sub">{sub}</span>}
      {foot !== undefined && <span className="cs-tile-foot">{foot}</span>}
      {badge !== undefined && <span className="cs-tile-badge">{badge}</span>}
      {pop && <span className="cs-pop">{pop}</span>}
    </>
  );
  return onClick ? (
    <button type="button" {...props} className={`${classes} ${props.className ?? ''}`} onClick={onClick} aria-pressed={selected || undefined} aria-label={label ?? (tip ? `${title}. ${tip.lines.join('. ')}` : undefined)}>
      {body}
    </button>
  ) : (
    <span {...(props as object)} className={`${classes} ${props.className ?? ''}`} aria-label={label ?? (tip ? `${title}. ${tip.lines.join('. ')}` : undefined)}>
      {body}
    </span>
  );
}
