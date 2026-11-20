import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { cardArtLargeUrlFor, cardArtOf, cardArtUrl, withCardArt } from './cardArt';
import { KEYWORD_SYMBOLS, KeywordMark, StatGem, type StatState } from './symbole';
import type { KeywordId } from '../types';

const baseCombatNotes = new Map<string, AnkiNote>();
/** Stelle des Felds „Bild“ in der Anki-Kampfkarte (eigene Kartensets bringen dort ihr Bild mit). */
export const BILD_FIELD = BUB_COMBAT_CARD_FIELDS.indexOf('Bild');
const RULES_FIELD = BUB_COMBAT_CARD_FIELDS.indexOf('Regeltext');
/** Feldinhalt einer Anki-Notiz als schlichter Text (ohne Auszeichnung). */
const plainText = (html: string | undefined) => (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

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

/** Art der Karte für den Rahmen der Handkarte (#436): Tier, Kniff, Falle, Aufgabe oder Bau. */
export type HandKind = 'minion' | 'spell' | 'trap' | 'quest' | 'building';

export function handKind(def: CardDefinition): HandKind {
  if (def.quest) return 'quest';
  if (def.trap) return 'trap';
  if (def.isSpell) return 'spell';
  if (def.building) return 'building';
  return 'minion';
}

/** So viele Schlüsselwort-Zeichen passen in die Kurzzeile der Handkarte; den Rest zeigt die Großansicht. */
const HAND_MARKS = 3;

/**
 * Handkarte (#436, Strang #425, Glied S3) für Hand, Kartentausch, Kartenwahl und Deckbau. Der Inhalt
 * kommt weiter aus der Anki-Vorlage `BUB_COMBAT_CARD_NOTETYPE` (eigene Kartensets und ersetzte Bilder
 * bleiben), `handkarte.css` ordnet ihn neu: Bild oben, Namensband, eine Zeile Kurztext. Kosten, Angriff
 * und Leben liegen als Symbole aus S1 in den Ecken, Schlüsselwörter als Zeichen in der Kurzzeile.
 */
export function CardFace({
  def,
  currentAttack,
  currentHealth,
  attackState,
  healthState,
  hint,
  className = '',
  children,
}: {
  def: CardDefinition;
  currentAttack?: number;
  currentHealth?: number;
  /** Verstärkt oder verletzt (nur für Tiere auf dem Feld in der Großansicht). */
  attackState?: StatState;
  healthState?: StatState;
  hint?: string;
  className?: string;
  /** Zusätzlicher Inhalt auf der Karte (Textfeld der Zoomkarte). */
  children?: ReactNode;
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
  const kind = handKind(def);
  // Werte haben nur Tiere und Bauten; Kniffe, Fallen und Aufgaben zeigen dort ihren Text.
  const fighter = kind === 'minion' || kind === 'building';
  const attack = fighter ? (currentAttack ?? def.attack ?? 0) : undefined;
  const health = fighter ? (currentHealth ?? def.health ?? 0) : undefined;
  const keywords = def.keywords ?? [];

  return (
    <GameCard
      ankiFront={rendered}
      foil={def.rarity === 'mythic' ? 'gold' : 'none'}
      className={`ds-combat-card-game ds-hand-card ds-hand-${kind}${keywords.length > 0 ? ' ds-hand-marked' : ''} ${className}`}
      label={`${def.name}, Kosten ${def.cost} Knappen${attack !== undefined ? `, Angriff ${attack}` : ''}${health !== undefined ? `, Leben ${health}` : ''}`}
    >
      <StatGem kind="cost" value={def.cost} size="hand" className="ds-hand-cost" />
      {attack !== undefined && <StatGem kind="attack" value={attack} state={attackState} size="hand" className="ds-hand-atk" />}
      {health !== undefined && <StatGem kind="health" value={health} state={healthState} size="hand" className="ds-hand-hp" />}
      {keywords.length > 0 && (
        <span className="ds-hand-marks">
          {keywords.slice(0, HAND_MARKS).map((keyword) => (
            <KeywordMark key={keyword} keyword={keyword} size="hand" />
          ))}
          {keywords.length > HAND_MARKS && <span className="ds-hand-more">+{keywords.length - HAND_MARKS}</span>}
        </span>
      )}
      {children}
    </GameCard>
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
const stateOf = (change: 'up' | 'down' | undefined): StatState => (change === 'up' ? 'buffed' : change === 'down' ? 'hurt' : 'base');

/**
 * Text, der in sein Feld passen muss (Zoomkarte, Heldenkarte #472): Die Schrift wird schrittweise kleiner,
 * bis nichts mehr übersteht – das Textfeld rollt nie. Untergrenze etwa die Hälfte der Ausgangsgröße.
 */
export function useFitText<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof getComputedStyle === 'undefined') return;
    const fit = () => {
      el.style.fontSize = '';
      let size = parseFloat(getComputedStyle(el).fontSize);
      const min = size * 0.5;
      while (el.scrollHeight > el.clientHeight + 1 && size > min) {
        size *= 0.93;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    // Bilder und Schrift laden nach, das Fenster ändert die Größe: neu einpassen.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(el);
    return () => observer?.disconnect();
  });
  return ref;
}

/**
 * Zoomkarte (#437, Strang #425, Glied S4): die Handkarte groß, alles steht auf der Karte: im Textfeld der
 * volle Regeltext, jede Eigenschaft mit Zeichen, Name und Beschreibung und der Spruch, unten mittig die
 * Herkunft. Ohne Fensterrahmen (`bare`), Antippen schließt. Nur aus der Sicht.
 */
function ZoomCard({ def, minion, traits, rules, origin, quote }: { def: CardDefinition; minion: Minion | null; traits: TraitInfo[]; rules?: string; origin: string; quote?: string }) {
  const textRef = useFitText<HTMLDivElement>();
  return (
    <div className="ds-zoom-card">
      <CardFace
        def={def}
        currentAttack={minion?.attack}
        currentHealth={minion?.health}
        attackState={minion ? stateOf(statChange(minion.attack, minion.baseAttack)) : undefined}
        healthState={minion ? (minion.health < minion.maxHealth ? 'hurt' : stateOf(statChange(minion.maxHealth, minion.baseHealth))) : undefined}
        className="ds-zoom-face"
      >
        <div ref={textRef} className="ds-zoom-text">
          {rules && <p className="ds-zoom-rules">{rules}</p>}
          {traits.length > 0 && (
            <ul className="ds-zoom-traits">
              {traits.map((trait) => (
                <li key={trait.id}>
                  {trait.id in KEYWORD_SYMBOLS ? (
                    <KeywordMark keyword={trait.id as KeywordId} size="zoom" />
                  ) : (
                    <span className="ds-zoom-emoji" aria-hidden="true">
                      {trait.emoji}
                    </span>
                  )}
                  <span>
                    <strong>{trait.name}:</strong> {trait.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {quote && <p className="ds-zoom-quote">„{quote}“</p>}
        </div>
        {origin && <p className="ds-zoom-origin">{origin}</p>}
      </CardFace>
    </div>
  );
}

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
  const override = cardOverrideOf(cosmetics.ankiOverrides, def.id);
  const bild = getNoteField(override, BILD_FIELD);
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
    image: art ? { src: art, largeSrc: cardArtLargeUrlFor(def.id, bild, cosmetics.mediaUrlMap), aspect: 3 / 4 } : undefined,
    emoji: def.emoji,
    stats,
    lines: def.text ? [def.text] : undefined,
    keywords: traits.map((trait) => ({ emoji: trait.emoji, name: trait.name, text: trait.description })),
    quote: quote || undefined,
    // Ein eigenes Kartenset darf den Regeltext ersetzen, wie es auch das Bild ersetzt.
    bare: true,
    body: <ZoomCard def={def} minion={minion} traits={traits} rules={plainText(getNoteField(override, RULES_FIELD)) || def.text} origin={cardOrigin(def)} quote={quote || undefined} />,
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
