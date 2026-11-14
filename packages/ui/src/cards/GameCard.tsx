import {
  useId,
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
} from 'react';
import { CardBack, type CardBackProps, type CardSize } from './CardBack';

export interface GameCardBadge {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom';
  label: ReactNode;
  tone?: 'default' | 'accent' | 'danger' | 'warning' | 'success' | 'gold' | 'mana' | string;
  icon?: ReactNode;
  title?: string;
}

export interface GameCardRuntimeBadge {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  label: string;
  tone?: 'default' | 'accent' | 'danger' | 'warning' | 'success' | 'gold' | string;
}

export interface GameCardAnkiSide {
  html: string;
  scopedCss?: string;
}

export interface GameCardProps {
  /** Durch die Anki-Engine gerenderte Vorderseite */
  ankiFront?: GameCardAnkiSide;
  html?: string;
  scopedCss?: string;

  /** Strukturierter Rahmen-Aufbau */
  illustration?: ReactNode;
  frameAsset?: string;
  title?: ReactNode;
  badges?: GameCardBadge[];
  bodyText?: ReactNode;
  footer?: ReactNode;

  /** Eigene Kind-Elemente (haben Vorrang) */
  children?: ReactNode;

  /** Kartengröße (kompatibel mit CardFan und TrickTable) */
  size?: CardSize;

  /** Verdeckte Karte mit flüssiger 3D-Flip-Animation */
  faceDown?: boolean;

  /** Eigener Kartenrücken für die Rückseite */
  cardBackProps?: CardBackProps;

  /** Visuelle Zustände */
  selected?: boolean;
  playable?: boolean;
  disabled?: boolean;
  foil?: 'none' | 'gold' | 'holo';

  /** Dynamische Plaketten in den vier Ecken der Vorderseite */
  runtimeBadges?: GameCardRuntimeBadge[];

  /** Interaktion & Barrierefreiheit */
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Universeller Spielkarten-Container für alle Karten- und Spezialspiele.
 * Unterstützt 3D-Wende-Animation, Anki-HTML, strukturierte Rahmen,
 * dynamische Plaketten und volle Barrierefreiheit.
 */
export function GameCard({
  ankiFront,
  html,
  scopedCss,
  illustration,
  frameAsset,
  title,
  badges,
  bodyText,
  footer,
  children,
  size,
  faceDown = false,
  cardBackProps,
  selected = false,
  playable = false,
  disabled = false,
  foil = 'none',
  runtimeBadges,
  onClick,
  onKeyDown,
  label,
  className = '',
  style,
}: GameCardProps) {
  const scopeId = useId().replace(/:/g, '');

  const effectiveHtml = html ?? ankiFront?.html;
  const effectiveCss = scopedCss ?? ankiFront?.scopedCss;

  // Beschriftung für Screenreader ermitteln
  const titleString = typeof title === 'string' ? title : undefined;
  const fallbackLabel = faceDown ? 'verdeckte Karte' : titleString ?? 'Karte';
  const computedLabel = label ?? fallbackLabel;

  const sizeClass = size ? `bub-card-size-${size}` : '';
  const selectedClass = selected ? 'bub-card-selected' : '';
  const playableClass = playable ? 'bub-card-playable' : '';
  const disabledClass = disabled ? 'bub-card-disabled' : '';
  const faceDownClass = faceDown ? 'bub-game-card--face-down' : '';
  const interactiveClass = onClick && !disabled ? 'bub-card-clickable' : '';
  const classes = `bub-card bub-game-card ${sizeClass} ${selectedClass} ${playableClass} ${disabledClass} ${faceDownClass} ${interactiveClass} ${className}`.trim();

  // Tastaturbedienung für Barrierefreiheit (Enter & Space aktivieren onClick)
  const handleKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || !onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Auslösen über synthetisches MouseEvent
      (event.currentTarget as HTMLElement).click();
    }
  };

  const frontContent = (
    <>
      {effectiveHtml ? (
        <div className={`bub-game-card-anki bub-game-card-anki-${scopeId}`}>
          {effectiveCss && <style>{effectiveCss}</style>}
          <div
            className="bub-game-card-anki-html"
            // eslint-disable-next-line react/no-danger -- aus der Anki-Engine bereitgestellt
            dangerouslySetInnerHTML={{ __html: effectiveHtml }}
          />
          {children}
        </div>
      ) : children ? (
        children
      ) : (
        <div className={`bub-game-card-structured ${frameAsset ? `bub-game-card-frame--${frameAsset}` : ''}`}>
          {(title || (badges && badges.length > 0)) && (
            <div className="bub-game-card-header">
              <div className="bub-game-card-badges-left">
                {badges
                  ?.filter((b) => b.position === 'top-left' || b.position === 'top')
                  .map((b, i) => (
                    <span key={i} className={`bub-card-pill bub-card-pill--${b.tone ?? 'default'}`} title={b.title}>
                      {b.icon}
                      {b.label}
                    </span>
                  ))}
              </div>
              {title && <div className="bub-game-card-title">{title}</div>}
              <div className="bub-game-card-badges-right">
                {badges
                  ?.filter((b) => b.position === 'top-right')
                  .map((b, i) => (
                    <span key={i} className={`bub-card-pill bub-card-pill--${b.tone ?? 'default'}`} title={b.title}>
                      {b.icon}
                      {b.label}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {illustration && <div className="bub-game-card-illustration">{illustration}</div>}

          {bodyText && <div className="bub-game-card-body">{bodyText}</div>}

          {(footer ||
            (badges && badges.some((b) => b.position === 'bottom-left' || b.position === 'bottom-right' || b.position === 'bottom'))) && (
            <div className="bub-game-card-footer">
              <div className="bub-game-card-badges-left">
                {badges
                  ?.filter((b) => b.position === 'bottom-left' || b.position === 'bottom')
                  .map((b, i) => (
                    <span key={i} className={`bub-card-pill bub-card-pill--${b.tone ?? 'default'}`} title={b.title}>
                      {b.icon}
                      {b.label}
                    </span>
                  ))}
              </div>
              {footer && <div className="bub-game-card-footer-text">{footer}</div>}
              <div className="bub-game-card-badges-right">
                {badges
                  ?.filter((b) => b.position === 'bottom-right')
                  .map((b, i) => (
                    <span key={i} className={`bub-card-pill bub-card-pill--${b.tone ?? 'default'}`} title={b.title}>
                      {b.icon}
                      {b.label}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Glanz-/Foil-Effekt */}
      {foil && foil !== 'none' && <div className={`bub-game-card-foil bub-game-card-foil--${foil}`} />}

      {/* Dynamische Laufzeit-Plaketten */}
      {runtimeBadges && runtimeBadges.length > 0 && (
        <div className="bub-game-card-runtime-badges">
          {runtimeBadges.map((rb, idx) => (
            <span
              key={idx}
              className={`bub-game-card-runtime-badge bub-game-card-runtime-badge--${rb.position} bub-game-card-runtime-badge--${rb.tone ?? 'default'}`}
            >
              {rb.label}
            </span>
          ))}
        </div>
      )}
    </>
  );

  const innerFlipper = (
    <div className={`bub-game-card-flipper ${faceDown ? 'bub-game-card-flipped' : ''}`}>
      <div className="bub-game-card-side bub-game-card-front" aria-hidden={faceDown || undefined}>
        {frontContent}
      </div>
      <div className="bub-game-card-side bub-game-card-back" aria-hidden={!faceDown || undefined}>
        <CardBack size={size} {...cardBackProps} />
      </div>
    </div>
  );

  return onClick ? (
    <button
      type="button"
      className={classes}
      style={style}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={computedLabel}
      aria-pressed={selected || undefined}
    >
      {innerFlipper}
    </button>
  ) : (
    <span className={classes} style={style} role="img" aria-label={computedLabel}>
      {innerFlipper}
    </span>
  );
}
