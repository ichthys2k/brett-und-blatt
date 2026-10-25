import type { CSSProperties, MouseEventHandler } from 'react';

/** Kurze Zeichenfolge aus Emojis? Dann groß zeigen, sonst als Text. */
const EMOJI = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️)+$/u;

export interface ContentCardProps {
  /** Inhalt (Emoji oder kurzer Text) – oder null für eine verdeckte Karte. */
  content: string | null;
  /** Kleine Beschriftung unter einem Emoji, z. B. „Schwarzer Peter“. */
  caption?: string;
  highlight?: 'target' | 'hint' | null;
  dimmed?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Karte mit eigenem Inhalt statt französischem Blatt – für Paare finden,
 * Schwarzer Peter und Lernkarten (Einmaleins, Vokabeln). Die Schrift passt sich
 * der Kartengröße an.
 */
export function ContentCard({ content, caption, highlight, dimmed, onClick, label, className = '', style }: ContentCardProps) {
  const classes = `bub-ccard ${content === null ? 'bub-ccard-down' : ''} ${highlight ? `bub-card-${highlight}` : ''} ${dimmed ? 'bub-ccard-dimmed' : ''} ${onClick ? 'bub-card-clickable' : ''} ${className}`;
  const inner =
    content === null ? (
      <span className="bub-card-back" />
    ) : (
      <span className="bub-ccard-face">
        <span className={EMOJI.test(content) ? 'bub-ccard-emoji' : 'bub-ccard-text'}>{content}</span>
        {caption && <span className="bub-ccard-caption">{caption}</span>}
      </span>
    );
  const name = label ?? (content === null ? 'verdeckte Karte' : caption ? `${content} ${caption}` : content);
  return onClick ? (
    <button type="button" className={classes} style={style} onClick={onClick} aria-label={name}>
      {inner}
    </button>
  ) : (
    <span className={classes} style={style} role="img" aria-label={name}>
      {inner}
    </span>
  );
}
