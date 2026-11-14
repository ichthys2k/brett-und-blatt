import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUB_COMBAT_CARD_FIELDS,
  BUB_COMBAT_CARD_NOTETYPE,
  drachenspielCardsToAnki,
  renderCardSide,
  type AnkiNote,
} from '@brett-und-blatt/engine';
import { cardOverrideOf, GameCard, getNoteField, useCardCosmetics, useCardOverride, type CardCosmetics, type InspectContent, type InspectStat } from '@brett-und-blatt/ui';
import { CARDS_DB } from '../cards';
import type { CardDefinition, HousePower, Minion } from '../types';
import { cardOrigin, getCardTraits, getMinionTraits, type TraitInfo } from './traits';
import { uiCard } from './cardLookup';
import { cardArtOf, cardArtUrl, withCardArt } from './cardArt';

const baseCombatNotes = new Map<string, AnkiNote>();
/** Stelle des Felds „Bild“ in der Anki-Kampfkarte (eigene Kartensets bringen dort ihr Bild mit). */
const BILD_FIELD = BUB_COMBAT_CARD_FIELDS.indexOf('Bild');

export function getCombatCardBaseNote(def: CardDefinition): AnkiNote {
  let note = baseCombatNotes.get(def.id);
  if (!note) {
    // Mit gemaltem Bild (#309) steht es als Medium im Feld „Bild“, sonst das Emoji.
    const image = cardArtOf(def.id);
    const col = drachenspielCardsToAnki([image ? { ...def, image } : def]);
    note = col.notes[0]!;
    baseCombatNotes.set(def.id, note);
  }
  return note;
}

export function renderCombatCardAnki(
  def: CardDefinition,
  options: {
    attack?: number;
    health?: number;
    hint?: string;
    overrideNote?: AnkiNote;
    mediaUrlMap?: Record<string, string>;
  } = {},
) {
  const note = options.overrideNote ?? getCombatCardBaseNote(def);
  const runtimeFields: Record<string, string> = {};
  const atk = options.attack ?? (def.isSpell ? undefined : def.attack);
  const hp = options.health ?? (def.isSpell ? undefined : def.health);
  if (atk !== undefined) {
    runtimeFields.AktuellerAngriff = String(atk);
    runtimeFields.Angriff = String(atk);
  }
  if (hp !== undefined) {
    runtimeFields.AktuellesLeben = String(hp);
    runtimeFields.Leben = String(hp);
  }
  if (options.hint) {
    runtimeFields.SpielHinweis = options.hint;
  }
  return renderCardSide(BUB_COMBAT_CARD_NOTETYPE, note, 0, 'front', {
    runtimeFields,
    mediaUrlMap: withCardArt(options.mediaUrlMap),
  });
}

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

/** Inhalt einer Karte auf der Hand und beim Kartentausch über <GameCard> und BUB_COMBAT_CARD_NOTETYPE. */
export function CardFace({
  def,
  currentAttack,
  currentHealth,
  hint,
  className = '',
}: {
  def: CardDefinition;
  currentAttack?: number;
  currentHealth?: number;
  hint?: string;
  className?: string;
}) {
  const cosmetics = useCardCosmetics();
  const overrideNote = useCardOverride(def.id);
  const rendered = useMemo(
    () =>
      renderCombatCardAnki(def, {
        attack: currentAttack,
        health: currentHealth,
        hint,
        overrideNote,
        mediaUrlMap: cosmetics.mediaUrlMap,
      }),
    [def, currentAttack, currentHealth, hint, overrideNote, cosmetics.mediaUrlMap],
  );

  return (
    <GameCard
      ankiFront={rendered}
      className={`ds-combat-card-game ${className}`}
      label={`${def.name}, Kosten ${def.cost} Knappen${currentAttack !== undefined || def.attack !== undefined ? `, Angriff ${currentAttack ?? def.attack}` : ''}${currentHealth !== undefined || def.health !== undefined ? `, Leben ${currentHealth ?? def.health}` : ''}`}
    />
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

/** Kartengestaltung der Partie, aus der die Großansicht Bilder und Anki-Änderungen liest. */
export type ZoomCosmetics = Pick<CardCosmetics, 'ankiOverrides' | 'mediaUrlMap'>;

const statChange = (value: number, base: number): 'up' | 'down' | undefined => (value > base ? 'up' : value < base ? 'down' : undefined);

/**
 * Inhalt der Großansicht (#418, früher `CardZoom`): gemaltes Bild (#417; ein Bild aus dem Anki-Feld
 * „Bild“ eines eigenen Kartensets hat Vorrang), Kosten und Werte, Regeltext, Schlüsselwörter, Herkunft
 * und Spruch. Die Hauskraft zeigt ihr Emoji.
 */
export function zoomContent(item: ZoomItem, cosmetics: ZoomCosmetics): InspectContent | undefined {
  if (item.kind === 'power') {
    const { power } = item;
    return {
      title: power.name,
      subtitle: 'Hauskraft, einmal je Zug',
      emoji: power.emoji,
      stats: [{ label: 'Kosten', value: String(power.cost), tone: 'cost' }],
      lines: [power.text],
    };
  }
  const def = uiCard(item.kind === 'card' ? item.defId : item.minion.cardId);
  if (!def) return undefined;
  const minion = item.kind === 'minion' ? item.minion : null;
  const traits = minion ? getMinionTraits(minion) : getCardTraits(def);
  const quote = minion?.quote ?? def.quote;
  const bild = getNoteField(cardOverrideOf(cosmetics.ankiOverrides, def.id), BILD_FIELD);
  const art = cardArtUrl(def.id, bild, cosmetics.mediaUrlMap);
  const stats: InspectStat[] = [{ label: 'Kosten', value: String(def.cost), tone: 'cost' }];
  if (!def.isSpell && !def.quest) {
    stats.push(
      { label: 'Angriff', value: String(minion?.attack ?? def.attack ?? 0), tone: 'attack', change: minion ? statChange(minion.attack, minion.baseAttack) : undefined },
      {
        label: 'Leben',
        value: String(minion?.health ?? def.health ?? 0),
        tone: 'health',
        change: minion ? (minion.health < minion.maxHealth ? 'down' : statChange(minion.maxHealth, minion.baseHealth)) : undefined,
      },
    );
  }
  return {
    title: def.name,
    subtitle: cardOrigin(def) || undefined,
    image: art ? { src: art, aspect: 3 / 4 } : undefined,
    emoji: def.emoji,
    stats,
    lines: def.text ? [def.text] : undefined,
    keywords: traits.map((trait) => ({ emoji: trait.emoji, name: trait.name, text: trait.description })),
    quote: quote || undefined,
  };
}

/** Spielverlauf: neueste Aktion oben, aufklappbar, damit das Feld auf dem Handy nicht schrumpft. */
export function GameLog({ entries }: { entries: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ds-badge ds-log-toggle" aria-expanded={open} aria-label="Verlauf" onClick={() => setOpen((value) => !value)}>
        📜<span className="ds-log-label"> Verlauf</span>
      </button>
      {open && (
        // Antippen schließt den Verlauf wieder, damit er nicht über dem Spielfeld liegen bleibt.
        <div className="ds-log" role="log" aria-label="Spielverlauf" onClick={() => setOpen(false)}>
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
