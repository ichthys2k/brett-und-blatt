import { useEffect, useRef, useState } from 'react';
import { CARDS_DB } from '../cards';
import type { CardDefinition, HousePower, Minion } from '../types';
import { cardOrigin, getCardTraits, getMinionTraits, type TraitInfo } from './traits';

export function TraitBadge({ trait, isOpponent }: { trait: TraitInfo; isOpponent?: boolean }) {
  return (
    <span
      className={`ds-trait-badge ${isOpponent ? 'ds-trait-opponent' : ''}`}
      title={trait.fullTitle}
      aria-label={`${trait.name}: ${trait.description}`}
    >
      <span className="ds-trait-emoji">{trait.emoji}</span>
      <span className="ds-trait-tooltip" role="tooltip">
        <strong className="ds-trait-tooltip-title">
          {trait.emoji} {trait.name}
        </strong>
        <span className="ds-trait-tooltip-desc">{trait.description}</span>
      </span>
    </span>
  );
}

/** Inhalt einer Karte auf der Hand und beim Kartentausch. */
export function CardFace({ def }: { def: CardDefinition }) {
  return (
    <>
      <div className="ds-card-top">
        <span className="ds-card-cost">{def.cost}</span>
        <div className="ds-card-traits">
          {getCardTraits(def).map((trait) => (
            <TraitBadge key={trait.id} trait={trait} />
          ))}
        </div>
      </div>
      <div className="ds-card-center">
        <span className="ds-card-emoji">{def.emoji}</span>
        <span className="ds-card-name">{def.name}</span>
      </div>
      {def.text && <span className="ds-card-spelltext">{def.text}</span>}
      {!def.isSpell && !def.quest && (
        <div className="ds-minion-stats">
          <span className="ds-stat-atk">{def.attack}</span>
          <span className="ds-stat-hp">{def.health}</span>
        </div>
      )}
    </>
  );
}

/** Werte im Feld: verstärkt grün, verletzt rot. */
export function attackClass(minion: Minion): string {
  if (minion.attack > minion.baseAttack) return 'ds-stat-atk ds-stat-buffed';
  if (minion.attack < minion.baseAttack) return 'ds-stat-atk ds-stat-hurt';
  return 'ds-stat-atk';
}

export function healthClass(minion: Minion): string {
  if (minion.health < minion.maxHealth) return 'ds-stat-hp ds-stat-hurt';
  if (minion.maxHealth > minion.baseHealth) return 'ds-stat-hp ds-stat-buffed';
  return 'ds-stat-hp';
}

/** Was groß angesehen wird: eine Handkarte oder ein Tier auf dem Feld mit seinen aktuellen Werten. */
export type ZoomItem = { kind: 'card'; defId: string } | { kind: 'minion'; minion: Minion } | { kind: 'power'; power: HousePower };

export function CardZoom({ item, onClose }: { item: ZoomItem; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (item.kind === 'power') {
    const { power } = item;
    return (
      <div className="ds-zoom" role="dialog" aria-modal="true" aria-label={power.name} onClick={onClose}>
        <div className="ds-zoom-card ds-card-spell">
          <span className="ds-card-cost ds-zoom-cost">{power.cost}</span>
          <span className="ds-zoom-emoji">{power.emoji}</span>
          <strong className="ds-zoom-name">{power.name}</strong>
          <p className="ds-zoom-text">Hauskraft, einmal je Zug. {power.text}</p>
          <button ref={closeRef} type="button" className="ds-btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    );
  }

  const def = CARDS_DB[item.kind === 'card' ? item.defId : item.minion.cardId];
  if (!def) return null;
  const minion = item.kind === 'minion' ? item.minion : null;
  const traits = minion ? getMinionTraits(minion) : getCardTraits(def);
  const quote = minion?.quote ?? def.quote;

  return (
    <div className="ds-zoom" role="dialog" aria-modal="true" aria-label={def.name} onClick={onClose}>
      <div className={`ds-zoom-card ${def.isSpell ? 'ds-card-spell' : ''}`}>
        <span className="ds-card-cost ds-zoom-cost">{def.cost}</span>
        <span className="ds-zoom-emoji">{def.emoji}</span>
        <strong className="ds-zoom-name">{def.name}</strong>
        {def.text && <p className="ds-zoom-text">{def.text}</p>}
        {traits.length > 0 && (
          <ul className="ds-zoom-traits">
            {traits.map((trait) => (
              <li key={trait.id}>
                <strong>
                  {trait.emoji} {trait.name}:
                </strong>{' '}
                {trait.description}
              </li>
            ))}
          </ul>
        )}
        {cardOrigin(def) && <p className="ds-zoom-origin">{cardOrigin(def)}</p>}
        {quote && <p className="ds-zoom-quote">„{quote}“</p>}
        {!def.isSpell && !def.quest && (
          <div className="ds-minion-stats ds-zoom-stats">
            <span className={minion ? attackClass(minion) : 'ds-stat-atk'}>{minion?.attack ?? def.attack}</span>
            <span className={minion ? healthClass(minion) : 'ds-stat-hp'}>{minion?.health ?? def.health}</span>
          </div>
        )}
        <button ref={closeRef} type="button" className="ds-btn" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}

/** Spielverlauf: neueste Aktion oben, aufklappbar, damit das Feld auf dem Handy nicht schrumpft. */
export function GameLog({ entries }: { entries: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ds-badge ds-log-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        📜 Verlauf
      </button>
      {open && (
        <div className="ds-log" role="log" aria-label="Spielverlauf">
          {entries.length === 0 ? <p>Noch nichts passiert.</p> : [...entries].reverse().map((entry, index) => <p key={entries.length - index}>{entry}</p>)}
        </div>
      )}
    </>
  );
}

/** Lunte am Zug-Knopf: brennt in den letzten Sekunden des Zugs ab. */
export function Fuse({ leftMs, fromMs }: { leftMs: number; fromMs: number }) {
  return (
    <div className="ds-fuse" role="timer" aria-label={`Noch ${Math.ceil(leftMs / 1000)} Sekunden`}>
      <div className="ds-fuse-rest" style={{ width: `${Math.min(100, (leftMs / fromMs) * 100)}%` }} />
      <span className="ds-fuse-text">🔥 {Math.ceil(leftMs / 1000)} s</span>
    </div>
  );
}

export interface ArrowPoints {
  from: { x: number; y: number };
  to: { x: number; y: number };
  onTarget: boolean;
}

/** Zielpfeil von der Figur oder Zauberkarte zum Finger bzw. zum erlaubten Ziel. */
export function TargetArrow({ from, to, onTarget }: ArrowPoints) {
  const bend = { x: (from.x + to.x) / 2 + (to.y - from.y) * 0.12, y: (from.y + to.y) / 2 - Math.abs(to.x - from.x) * 0.12 };
  const angle = (Math.atan2(to.y - bend.y, to.x - bend.x) * 180) / Math.PI;
  return (
    <svg className={`ds-arrow ${onTarget ? 'ds-arrow-on-target' : ''}`} aria-hidden="true">
      <path className="ds-arrow-line" d={`M ${from.x} ${from.y} Q ${bend.x} ${bend.y} ${to.x} ${to.y}`} />
      <polygon className="ds-arrow-head" points="-14,-10 8,0 -14,10" transform={`translate(${to.x} ${to.y}) rotate(${angle})`} />
    </svg>
  );
}
