/**
 * Bausteine des Turnierherrn am Tisch (#464, Strang #425, Glied S8): Wimpel mit der Zahl der
 * verbliebenen Wimpel (das „Leben“ des Helden) und die Reihe der Knappen als Edelsteine.
 * Das Porträt selbst setzt `HeroBar` in PlayBoard.tsx zusammen.
 */

import { StatGem } from './symbole';
import { useFitText } from './parts';

const OUTLINE = '#1a120a';

/** Wimpel am Porträt: große Zahl, unter dem Startwert als „verletzt“ gefärbt. */
export function WimpelGem({ health, max = 30 }: { health: number; max?: number }) {
  const label = `${health} von ${max} Wimpeln an der Tribüne`;
  return (
    <span className="ds-held-hp" data-state={health < max ? 'hurt' : 'base'} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 32 36" aria-hidden="true" focusable="false" stroke={OUTLINE} strokeWidth="2" strokeLinejoin="round">
        <path d="M4 2 H28 V33 L16 24.5 L4 33 Z" fill="#c8362b" />
        <path d="M4 2 H28 V8 H4 Z" fill="#fff" opacity="0.28" stroke="none" />
      </svg>
      <span className="ds-held-hp-num">{health}</span>
    </span>
  );
}

export interface KnappenRowProps {
  mana: number;
  maxMana: number;
  /** In diesem Zug gesperrte Knappen. */
  locked: number;
  /** Knappen, die im nächsten Zug gesperrt sind. */
  overloadNext: number;
}

/** Zehn Edelsteine: bereit, verbraucht, gesperrt, noch nicht herbeigeeilt. Die Zahl bleibt Text. */
export function KnappenRow({ mana, maxMana, locked, overloadNext }: KnappenRowProps) {
  const label = [
    `Knappen: ${mana} von ${maxMana} bereit`,
    locked > 0 ? `${locked} gesperrt` : '',
    overloadNext > 0 ? `im nächsten Zug ${overloadNext} gesperrt` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <div className="ds-held-mana" title={label}>
      <span className="ds-held-mana-num" aria-label={label}>
        {mana}/{maxMana}
        {overloadNext > 0 ? ` →🔒${overloadNext}` : ''}
      </span>
      <span className="ds-held-gems" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => {
          const recruited = i < maxMana;
          const ready = i < mana;
          const isLocked = !ready && recruited && i >= maxMana - locked;
          return <span key={i} className="ds-held-gem" data-state={!recruited ? 'none' : ready ? 'ready' : isLocked ? 'locked' : 'spent'} />;
        })}
      </span>
    </div>
  );
}

export interface HeroZoomCardProps {
  name: string;
  /** Titel des Champions und Haus, unten mittig wie die Herkunft einer Karte. */
  origin: string;
  image?: string;
  emoji: string;
  health: number;
  armor: number;
  strength: number;
  mana: number;
  /** Hauskraft, Waffe, Auftrag, Fallen – je eine Zeile im Textfeld. */
  lines: string[];
}

/**
 * Großansicht des Turnierherrn als Karte (#472): derselbe Aufbau wie Hand- und Zoomkarte (Klassen der
 * Kampfkarten-Vorlage, `handkarte.css`/`zoomkarte.css`), goldener Rahmen, Knappen als Edelstein oben links,
 * Angriff unten links, Wimpel unten rechts, darüber die Rüstung. Nur, was die Sicht ohnehin zeigt.
 */
export function HeroZoomCard({ name, origin, image, emoji, health, armor, strength, mana, lines }: HeroZoomCardProps) {
  const textRef = useFitText<HTMLDivElement>();
  return (
    <div className="ds-zoom-card">
      <div className="bub-card bub-game-card ds-hand-card ds-hand-hero ds-zoom-face" role="img" aria-label={`${name}: ${health} Wimpel`}>
        <div className="bub-game-card-anki">
          <div className="bub-game-card-anki-html">
            <div className="bub-combat-card">
              <div className="bub-combat-header">
                <div className="bub-combat-title-bar">
                  <div className="bub-combat-name">{name}</div>
                </div>
              </div>
              <div className="bub-combat-media">
                <div className="bub-combat-image">{image ? <img src={image} alt="" draggable={false} /> : emoji}</div>
              </div>
              <div className="bub-combat-body" />
            </div>
          </div>
          <StatGem kind="cost" value={mana} size="hand" className="ds-hand-cost" />
          {strength > 0 && <StatGem kind="attack" value={strength} size="hand" className="ds-hand-atk" />}
          {armor > 0 && <StatGem kind="armor" value={armor} size="hand" className="ds-hero-zoom-armor" />}
          <div className="ds-hero-zoom-hp">
            <WimpelGem health={health} />
          </div>
          <div ref={textRef} className="ds-zoom-text">
            {lines.map((line) => (
              <p key={line} className="ds-zoom-rules">
                {line}
              </p>
            ))}
          </div>
          <p className="ds-zoom-origin">{origin}</p>
        </div>
      </div>
    </div>
  );
}
