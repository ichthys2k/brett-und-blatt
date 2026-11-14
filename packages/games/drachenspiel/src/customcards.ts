/**
 * Eigene Karten aus Anki im Drachenspiel (#270, #277): Prüfung beim Spielstart. Die Engine liefert
 * mit `sanitizeCustomCardCatalog` schon begrenzte Werte; Auslöser und Effekte kommen dort nur roh an.
 * Hier wird ihre Form gegen die Effektarten des Spiels geprüft: nur bekannte Arten, Zahlen in festen
 * Grenzen, Karten-ids nur aus dem Grundspiel. Was nicht passt, fällt weg – nie ein Fehler, nie ein
 * Effekt, den es im Spiel nicht gibt. Neue Karten (Kennung nicht im Grundspiel) werden einfache
 * Begleiter mit Werten, Schlüsselwörtern und geprüften Auslösern.
 */
import type { CustomCardCatalog } from '@brett-und-blatt/engine';
import { CARDS_DB } from './cards';
import type { CustomCard } from './carddefs';
import { DECK_THEME_IDS } from './decks';
import type { ChoiceOption, Effect, FamilyId, KeywordId, MinionKeyword, Selector, SpellTargeting, Trigger } from './types';

const MINION_KEYWORDS: MinionKeyword[] = ['taunt', 'rush', 'bubble', 'poisonous', 'stealth', 'sprinter', 'doubleStrike', 'lifesteal', 'frostbite', 'reborn', 'immune', 'elusive'];
const KEYWORDS: KeywordId[] = [...MINION_KEYWORDS, 'tradeable'];
const FAMILIES: FamilyId[] = ['pack', 'cats', 'herd', 'birds', 'burrowers', 'crawlers', 'reptiles', 'sea', 'giants', 'mythic', 'dragons', 'woodfolk', 'buildings'];
const TARGETING: SpellTargeting[] = ['none', 'enemyAny', 'enemyMinion', 'ownMinion', 'trigger'];
const SIDES = ['own', 'enemy'] as const;
/** Höchstens so viele neue Karten je Kartenset. */
export const MAX_NEW_CARDS = 60;
const MAX_EFFECTS = 6;
const MAX_TRIGGERS = 4;

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const int = (value: unknown, min: number, max: number): number | null => (typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : null);
const oneOf = <T extends string>(value: unknown, list: readonly T[]): T | null => (typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : null);
const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim() ? value.slice(0, max) : null);
/** Nur Karten des Grundspiels – keine Spielsteine aus eigenen Karten, keine Schleifen. */
const knownCard = (value: unknown): string | null => (typeof value === 'string' && CARDS_DB[value] ? value : null);

export function sanitizeSelector(raw: unknown): Selector | null {
  if (!isRecord(raw)) return null;
  switch (raw.pick) {
    case 'chosen':
    case 'self':
      return { pick: raw.pick };
    case 'hero': {
      const side = oneOf(raw.side, SIDES);
      return side ? { pick: 'hero', side } : null;
    }
    case 'random': {
      const side = oneOf(raw.side, SIDES);
      return side ? { pick: 'random', side } : null;
    }
    case 'allMinions': {
      const side = oneOf(raw.side, SIDES);
      if (!side) return null;
      const family = raw.family === undefined ? null : oneOf(raw.family, FAMILIES);
      if (raw.family !== undefined && !family) return null;
      return { pick: 'allMinions', side, ...(raw.exceptSelf === true ? { exceptSelf: true } : {}), ...(family ? { family } : {}) };
    }
  }
  return null;
}

export function sanitizeEffect(raw: unknown, depth = 0): Effect | null {
  if (!isRecord(raw)) return null;
  const to = () => sanitizeSelector(raw.to);
  switch (raw.kind) {
    case 'damage': {
      const amount = int(raw.amount, 0, 20);
      const target = to();
      return amount !== null && target ? { kind: 'damage', amount, to: target } : null;
    }
    case 'heal': {
      const amount = raw.amount === 'full' ? 'full' : int(raw.amount, 0, 30);
      const target = to();
      return amount !== null && target ? { kind: 'heal', amount, to: target } : null;
    }
    case 'buff': {
      const attack = raw.attack === undefined ? undefined : int(raw.attack, -10, 20);
      const health = raw.health === undefined ? undefined : int(raw.health, -10, 20);
      const target = to();
      if (!target || attack === null || health === null || (attack === undefined && health === undefined)) return null;
      return { kind: 'buff', ...(attack !== undefined ? { attack } : {}), ...(health !== undefined ? { health } : {}), to: target };
    }
    case 'grantKeyword': {
      const keyword = oneOf(raw.keyword, MINION_KEYWORDS);
      const target = to();
      return keyword && target ? { kind: 'grantKeyword', keyword, to: target } : null;
    }
    case 'ready':
    case 'returnToHand':
    case 'freeze':
    case 'silence': {
      const target = to();
      return target ? { kind: raw.kind, to: target } : null;
    }
    case 'draw': {
      const count = int(raw.count, 1, 5);
      return count !== null ? { kind: 'draw', count } : null;
    }
    case 'summon': {
      const cardId = knownCard(raw.cardId);
      const count = raw.count === undefined ? undefined : int(raw.count, 1, 3);
      return cardId && count !== null ? { kind: 'summon', cardId, ...(count !== undefined ? { count } : {}) } : null;
    }
    case 'mana':
    case 'armor':
    case 'heroAttack': {
      const amount = int(raw.amount, raw.kind === 'mana' ? -5 : 0, raw.kind === 'armor' ? 20 : raw.kind === 'mana' ? 5 : 10);
      return amount !== null ? { kind: raw.kind, amount } : null;
    }
    case 'equip': {
      const gear = isRecord(raw.gear) ? raw.gear : null;
      const attack = gear ? int(gear.attack, 0, 10) : null;
      const durability = gear ? int(gear.durability, 1, 5) : null;
      if (!gear || attack === null || durability === null) return null;
      return { kind: 'equip', gear: { name: text(gear.name, 40) ?? 'Ausrüstung', emoji: text(gear.emoji, 16) ?? '🗡️', attack, durability } };
    }
    case 'summonRandom': {
      const cardIds = Array.isArray(raw.cardIds) ? raw.cardIds.map(knownCard).filter((id): id is string => id !== null).slice(0, 10) : [];
      return cardIds.length ? { kind: 'summonRandom', cardIds } : null;
    }
    case 'addToHand': {
      const cardId = knownCard(raw.cardId);
      return cardId ? { kind: 'addToHand', cardId, ...(raw.fleeting === true ? { fleeting: true } : {}) } : null;
    }
    case 'rebirth': {
      const cardId = knownCard(raw.cardId);
      return cardId ? { kind: 'rebirth', cardId } : null;
    }
    case 'discover': {
      const pool = oneOf(raw.pool, ['spell', 'animal'] as const);
      return pool ? { kind: 'discover', pool } : null;
    }
    case 'chooseOne': {
      if (depth > 0 || !Array.isArray(raw.options)) return null;
      const options: ChoiceOption[] = raw.options.slice(0, 3).flatMap((option): ChoiceOption[] => {
        if (!isRecord(option)) return [];
        const effects = sanitizeEffects(option.effects, depth + 1);
        if (effects.length === 0) return [];
        const cardId = option.cardId === undefined ? undefined : knownCard(option.cardId);
        return [{ label: text(option.label, 40) ?? 'Wahl', emoji: text(option.emoji, 16) ?? '✨', ...(cardId ? { cardId } : {}), effects }];
      });
      return options.length >= 2 ? { kind: 'chooseOne', options } : null;
    }
    case 'adapt':
      return { kind: 'adapt' };
  }
  return null;
}

export function sanitizeEffects(raw: unknown, depth = 0): Effect[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_EFFECTS)
    .map((effect) => sanitizeEffect(effect, depth))
    .filter((effect): effect is Effect => effect !== null);
}

export function sanitizeTriggers(raw: unknown): Trigger[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_TRIGGERS).flatMap((trigger): Trigger[] => {
    if (!isRecord(trigger)) return [];
    const on = oneOf(trigger.on, ['played', 'death', 'turnEnd', 'spellCast'] as const);
    const effects = sanitizeEffects(trigger.do);
    if (!on || effects.length === 0) return [];
    let condition: Trigger['if'] | undefined;
    if (trigger.if === 'combo' || trigger.if === 'outcast') condition = trigger.if;
    else if (isRecord(trigger.if)) {
      const family = oneOf(trigger.if.family, FAMILIES);
      if (!family) return [];
      condition = { family };
    } else if (trigger.if !== undefined) return [];
    return [{ on, ...(condition ? { if: condition } : {}), do: effects }];
  });
}

/** Die Karten eines Kartensets für das Drachenspiel: geänderte Grundkarten und neue Begleiter. */
export function drachenspielCustomCards(catalog: CustomCardCatalog | null): Record<string, CustomCard> | undefined {
  if (!catalog) return undefined;
  const cards: Record<string, CustomCard> = {};
  let fresh = 0;
  for (const [id, raw] of Object.entries(catalog.combatCards)) {
    const card = raw as unknown as Raw;
    const base = CARDS_DB[id];
    const keywords = Array.isArray(card.keywords) ? (card.keywords.filter((k) => (KEYWORDS as string[]).includes(k as string)) as KeywordId[]) : undefined;
    const common: CustomCard = {
      ...(typeof card.name === 'string' ? { name: card.name } : {}),
      ...(typeof card.cost === 'number' ? { cost: card.cost } : {}),
      ...(typeof card.attack === 'number' ? { attack: card.attack } : {}),
      ...(typeof card.health === 'number' ? { health: card.health } : {}),
      ...(keywords ? { keywords } : {}),
      ...(typeof card.emoji === 'string' ? { emoji: card.emoji } : {}),
      ...(typeof card.quote === 'string' ? { quote: card.quote } : {}),
      ...(typeof card.text === 'string' ? { text: card.text } : {}),
    };
    const triggers = card.triggers === undefined ? undefined : sanitizeTriggers(card.triggers);
    if (base) {
      // Grundkarte: Kartenart bleibt; Zauber bekommen geprüfte Effekte, Tiere geprüfte Auslöser.
      if (base.isSpell) {
        const effects = card.effects === undefined ? undefined : sanitizeEffects(card.effects);
        if (effects?.length) common.effects = effects;
        const targeting = oneOf(card.targeting, TARGETING);
        if (targeting && effects?.length) common.targeting = targeting;
      } else if (triggers?.length) common.triggers = triggers;
      if (Object.keys(common).length) cards[id] = common;
      continue;
    }
    // Neue Karte: nur als Begleiter, mit gültiger Kennung und in begrenzter Zahl.
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(id) || fresh >= MAX_NEW_CARDS) continue;
    fresh++;
    const house = card.house === 'neutral' ? 'neutral' : (oneOf(card.house, DECK_THEME_IDS) ?? 'neutral');
    cards[id] = { ...common, custom: true, house, ...(triggers?.length ? { triggers } : {}) };
  }
  return Object.keys(cards).length ? cards : undefined;
}
