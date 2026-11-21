import type { HTMLAttributes, ReactNode } from 'react';

/** Liste der Konsole (#636); Kinder sind `KnsListItem`. */
export function KnsList({ className = '', children, ...rest }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={`kns-list ${className}`.trim()} {...rest}>
      {children}
    </ul>
  );
}

export interface KnsListItemProps {
  title: ReactNode;
  meta?: ReactNode;
  /** Bild, Wappen oder Emoji links. */
  leading?: ReactNode;
  /** Zustand rechts in der Hauptfläche (z. B. „2 frei“). */
  trailing?: ReactNode;
  /** Hauptaktion als Link … */
  href?: string;
  /** … oder als Knopf. Ohne beides ist die Zeile nur Anzeige. */
  onActivate?: () => void;
  /** Vorleser-Text der Hauptaktion, wenn Titel und Meta nicht reichen. */
  label?: string;
  /** Höchstens zwei Nebenknöpfe rechts (meist `KnsButton variant="quiet"`). */
  actions?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Kennung für Fokus-Wiederherstellung (`data-kns-id`). */
  focusId?: string;
}

/** Zeile einer Liste: die ganze Fläche ist die Hauptaktion (A), Nebenknöpfe stehen rechts daneben. */
export function KnsListItem({ title, meta, leading, trailing, href, onActivate, label, actions, disabled, className = '', focusId }: KnsListItemProps) {
  const inner = (
    <>
      {leading && (
        <span className="kns-list-leading" aria-hidden="true">
          {leading}
        </span>
      )}
      <span className="kns-list-text">
        <span className="kns-list-title">{title}</span>
        {meta && <span className="kns-list-meta">{meta}</span>}
      </span>
      {trailing && <span className="kns-list-trailing">{trailing}</span>}
    </>
  );
  let main: ReactNode;
  if (href && !disabled) {
    main = (
      <a href={href} className="kns-list-main" aria-label={label} data-kns-id={focusId}>
        {inner}
      </a>
    );
  } else if (onActivate || (href && disabled)) {
    main = (
      <button type="button" className="kns-list-main" aria-label={label} disabled={disabled} onClick={onActivate} data-kns-id={focusId}>
        {inner}
      </button>
    );
  } else {
    main = <div className="kns-list-main kns-list-static">{inner}</div>;
  }
  return (
    <li className={`kns-list-item ${className}`.trim()}>
      {main}
      {actions && <span className="kns-list-actions">{actions}</span>}
    </li>
  );
}
