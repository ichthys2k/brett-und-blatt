import { useId, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';

export interface KnsDialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  onClose: () => void;
  /** Knöpfe unten (z. B. „Abbrechen“ und die Hauptaktion). */
  actions?: ReactNode;
  size?: 's' | 'm' | 'l';
  children: ReactNode;
}

/**
 * Fenster der Konsole (#636): abgedunkelter Hintergrund, Titel, Schließen-Knopf, Aktionen unten. `aria-modal`
 * sorgt über `ModalFocusManager` für Anfangsfokus, Fokusfalle, B und die Rückkehr des Fokus. Im Hochformat kommt
 * das Fenster von unten über die volle Breite (CSS).
 */
export function KnsDialog({ title, onClose, actions, size = 'm', children, className = '', onKeyDown, ...rest }: KnsDialogProps) {
  const titleId = useId();
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };
  return (
    <div className="kns-dialog-layer">
      <div className="kns-dialog-shade" aria-hidden="true" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`kns-dialog kns-dialog-${size} ${className}`.trim()} onKeyDown={keyDown} {...rest}>
        <header className="kns-dialog-head">
          <h2 id={titleId} className="kns-dialog-title">
            {title}
          </h2>
          <button type="button" className="kns-dialog-close" aria-label="Schließen" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="kns-dialog-body" data-scroll-container>
          {children}
        </div>
        {actions && <footer className="kns-dialog-actions">{actions}</footer>}
      </div>
    </div>
  );
}
