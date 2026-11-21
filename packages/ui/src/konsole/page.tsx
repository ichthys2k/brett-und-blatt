import { Children, cloneElement, isValidElement, useEffect, useId, useState, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { KnsButton } from './KnsButton';

export interface KnsPageProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Knöpfe rechts neben dem Titel (Hochformat: darunter). */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Seite der Konsole (#636): Kopf mit `<h1>` und Inhalt mit begrenzter Breite. */
export function KnsPage({ title, subtitle, actions, children, className = '', ...rest }: KnsPageProps) {
  return (
    <div className={`kns-page ${className}`.trim()} {...rest}>
      <header className="kns-page-head">
        <div className="kns-page-heading">
          <h1 className="kns-title">{title}</h1>
          {subtitle && <p className="kns-page-sub">{subtitle}</p>}
        </div>
        {actions && <div className="kns-page-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export interface KnsSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}

/** Abschnitt (#636): Zwischenüberschrift und eine Fläche, die Zeilen zusammenfasst. */
export function KnsSection({ title, hint, children, className = '', ...rest }: KnsSectionProps) {
  return (
    <section className={`kns-section ${className}`.trim()} {...rest}>
      {title && <h2 className="kns-section-title">{title}</h2>}
      {hint && <p className="kns-section-hint">{hint}</p>}
      <div className="kns-section-body">{children}</div>
    </section>
  );
}

export interface KnsEmptyProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}

/** Leerer Zustand (#636): großes Symbol, Titel, ein Satz, die nächstliegende Aktion. */
export function KnsEmpty({ icon, title, text, action, className = '', ...rest }: KnsEmptyProps) {
  return (
    <div className={`kns-empty ${className}`.trim()} {...rest}>
      {icon && (
        <span className="kns-empty-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="kns-empty-title">{title}</p>
      {text && <p className="kns-empty-text">{text}</p>}
      {action}
    </div>
  );
}

export type KnsTone = 'info' | 'success' | 'warning' | 'danger';

export interface KnsBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: KnsTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Höchstens eine Aktion, meist ein `KnsButton`. */
  action?: ReactNode;
  onClose?: () => void;
  /** Am unteren Rand schwebend statt in der Seite. */
  floating?: boolean;
}

/** Meldung (#636) mit farbiger Kante; Warnung und Fehler werden sofort angesagt, sonst höflich. */
export function KnsBanner({ tone = 'info', title, children, action, onClose, floating = false, className = '', ...rest }: KnsBannerProps) {
  const urgent = tone === 'warning' || tone === 'danger';
  return (
    <div className={`kns-banner kns-banner-${tone}${floating ? ' kns-banner-floating' : ''} ${className}`.trim()} role={urgent ? 'alert' : 'status'} {...rest}>
      <div className="kns-banner-text">
        {title && <p className="kns-banner-title">{title}</p>}
        {children && <div className="kns-banner-body">{children}</div>}
      </div>
      {(action || onClose) && (
        <div className="kns-banner-actions">
          {action}
          {onClose && (
            <button type="button" className="kns-banner-close" aria-label="Schließen" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface KnsFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  /** Genau ein Eingabeelement. */
  children: ReactElement<Record<string, unknown>>;
}

/** Feld für Formulare (#636): Beschriftung über dem Element, Hinweis und Fehler darunter (`aria-describedby`). */
export function KnsField({ label, hint, error, className = '', children }: KnsFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const child = Children.only(children);
  const described = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(child)
    ? cloneElement(child, { id: (child.props.id as string | undefined) ?? id, 'aria-describedby': described, 'aria-invalid': error ? true : undefined })
    : child;
  const controlId = isValidElement(child) ? ((child.props.id as string | undefined) ?? id) : id;
  return (
    <div className={`kns-field ${className}`.trim()}>
      <label className="kns-field-label" htmlFor={controlId}>
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="kns-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="kns-field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export interface KnsCodeProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  /** Vorleser-Text für den Code, z. B. „Raumcode“. */
  label?: string;
  /** Knopf „Kopieren“ zeigen (Standard: ja). */
  copy?: boolean;
}

/** Große, gut lesbare Anzeige für Raumcodes u. Ä. (#636), daneben „Kopieren“. */
export function KnsCode({ value, label = 'Code', copy = true, className = '', ...rest }: KnsCodeProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);
  const doCopy = () => {
    void navigator.clipboard?.writeText(value).then(
      () => setCopied(true),
      () => undefined,
    );
  };
  return (
    <div className={`kns-code ${className}`.trim()} {...rest}>
      <span className="kns-code-value" role="text" aria-label={`${label}: ${value}`}>
        {value}
      </span>
      {copy && (
        <KnsButton onClick={doCopy} aria-live="polite">
          {copied ? 'Kopiert' : 'Kopieren'}
        </KnsButton>
      )}
    </div>
  );
}
