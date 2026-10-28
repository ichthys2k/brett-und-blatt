import type { Card, Suit } from '../rules';

export const SUIT_INFO: Record<Suit, { name: string; color: string; ink: string; shape: string }> = {
  red: { name: 'Rot', color: '#dc2626', ink: '#ffffff', shape: '●' },
  yellow: { name: 'Gelb', color: '#eab308', ink: '#422006', shape: '▲' },
  green: { name: 'Grün', color: '#16a34a', ink: '#ffffff', shape: '■' },
  blue: { name: 'Blau', color: '#2563eb', ink: '#ffffff', shape: '★' },
};

export function cardLabel(card: Pick<Card, 'suit' | 'value'>): string {
  return `${SUIT_INFO[card.suit].name} ${card.value}`;
}

/** Farbige Zahlenkarte; das Formsymbol hilft, wenn Farben schwer zu unterscheiden sind. */
export function CardFace({ card, small = false }: { card: Pick<Card, 'suit' | 'value'>; small?: boolean }) {
  const info = SUIT_INFO[card.suit];
  return (
    <span className={`lg-face${small ? ' lg-face-small' : ''}`} style={{ background: info.color, color: info.ink }} aria-hidden="true">
      <span className="lg-corner">
        {card.value}
        <span className="lg-shape">{info.shape}</span>
      </span>
      <span className="lg-value">{card.value}</span>
      <span className="lg-corner lg-corner-bottom">
        {card.value}
        <span className="lg-shape">{info.shape}</span>
      </span>
    </span>
  );
}

export function CardBack({ small = false }: { small?: boolean }) {
  return (
    <span className={`lg-back${small ? ' lg-face-small' : ''}`} aria-hidden="true">
      <span className="lg-back-mark">L</span>
    </span>
  );
}
