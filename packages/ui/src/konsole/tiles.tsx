import type { AnchorHTMLAttributes, ReactNode } from 'react';

export interface KnsTileProps extends Omit<AnchorHTMLAttributes<HTMLElement>, 'title' | 'onClick'> {
  /** Ziel als Link … */
  href?: string;
  /** … oder Aktion als Knopf. */
  onActivate?: () => void;
  /** Hintergrundbild (Kulisse); Text wird dann hell auf dunklem Verlauf. */
  image?: string;
  /** Wappen, Bild oder Emoji in der Mitte. */
  art: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Abzeichen oben links (z. B. Controller-Eignung). */
  badge?: ReactNode;
  /** Zeichen oben rechts (z. B. Stern für Lieblingsspiele). */
  mark?: ReactNode;
  /** `link` = Verweis-Kachel mit zweizeiligem Hinweis statt Meta. */
  variant?: 'game' | 'link';
}

/**
 * Grundform der Kachel (#636). Die ganze Kachel ist Link oder Knopf; der Vorleser-Text kommt aus `aria-label`
 * (sonst Titel), die sichtbaren Texte sind dann ausgeblendet für den Vorleser.
 */
export function KnsTile({ href, onActivate, image, art, title, meta, badge, mark, variant = 'game', className = '', style, ...rest }: KnsTileProps) {
  const classes = ['kns-tile', variant === 'link' ? 'kns-linktile' : '', className].filter(Boolean).join(' ');
  const content = (
    <>
      <span className="kns-tile-art" aria-hidden="true">
        {art}
      </span>
      {badge && (
        <span className="kns-grade" aria-hidden="true">
          {badge}
        </span>
      )}
      {mark && (
        <span className="kns-tile-star" aria-hidden="true">
          {mark}
        </span>
      )}
      <span className="kns-tile-text" aria-hidden={rest['aria-label'] ? true : undefined}>
        <span className="kns-tile-name">{title}</span>
        {meta && <span className={variant === 'link' ? 'kns-tile-meta kns-linktile-hint' : 'kns-tile-meta'}>{meta}</span>}
      </span>
    </>
  );
  const shared = {
    className: classes,
    'data-image': image ? '' : undefined,
    style: image ? { ...style, backgroundImage: `url("${image}")` } : style,
  };
  if (href) {
    return (
      <a href={href} {...shared} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onActivate} {...shared} {...(rest as Record<string, unknown>)}>
      {content}
    </button>
  );
}

/** Regal (#636): Überschrift und eine waagrecht rollende Reihe von Kacheln (`<li>`-Kinder). */
export function KnsShelf({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <section className="kns-shelf">
      <h2 className="kns-shelf-head">{title}</h2>
      {subtitle && <p className="kns-shelf-sub">{subtitle}</p>}
      <ul className="kns-shelf-row">{children}</ul>
    </section>
  );
}

/** Kachelraster (#636); Kinder sind `<li>` mit je einer Kachel. */
export function KnsGrid({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <ul className={`kns-grid ${className}`.trim()} aria-label={label}>
      {children}
    </ul>
  );
}
