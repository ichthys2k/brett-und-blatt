import { CARDS_DB } from '../cards';
import { effectsText } from '../core/text';
import type { CardDefinition, KeywordId, Minion, SpellTargeting, Trigger } from '../types';

export interface TraitInfo {
  id: string;
  emoji: string;
  name: string;
  description: string;
  fullTitle: string;
}

export const TRAIT_DEFINITIONS = {
  taunt: {
    emoji: '🛡️',
    name: 'Beschützer',
    description: 'Muss angegriffen werden, bevor andere Ziele gewählt werden dürfen.',
  },
  stealth: {
    emoji: '🌙',
    name: 'Versteckt',
    description: 'Kann nicht als Ziel gewählt werden, bis es selbst einmal angreift.',
  },
  bubble: {
    emoji: '🫧',
    name: 'Schutzblase',
    description: 'Verhindert die nächste Schadensinstanz komplett und platzt danach.',
  },
  poisonous: {
    emoji: '🧪',
    name: 'Giftig',
    description: 'Jedes Tier, das von diesem Tier Schaden nimmt, scheidet sofort aus.',
  },
  rush: {
    emoji: '⚡',
    name: 'Flink',
    description: 'Darf direkt in der Runde des Ausspielens angreifen, auch den gegnerischen Helden.',
  },
  sprinter: {
    emoji: '🏃',
    name: 'Sprinter',
    description: 'Darf sofort angreifen, im ersten Zug aber nur Tiere.',
  },
  doubleStrike: {
    emoji: '✌️',
    name: 'Doppelschlag',
    description: 'Darf in jedem Zug zweimal angreifen.',
  },
  lifesteal: {
    emoji: '💚',
    name: 'Lebenskraft',
    description: 'Schaden, den dieses Tier im Kampf zufügt, heilt deinen Helden.',
  },
  frostbite: {
    emoji: '❄️',
    name: 'Kältestarre',
    description: 'Wen dieses Tier trifft, der setzt seinen nächsten Angriff aus.',
  },
  reborn: {
    emoji: '🌱',
    name: 'Zweite Chance',
    description: 'Kehrt beim ersten Mal, wenn es vom Feld geht, mit 1 Leben zurück.',
  },
  immune: {
    emoji: '🌀',
    name: 'Eingerollt',
    description: 'Nimmt bis zu deinem nächsten Zug keinen Schaden.',
  },
  elusive: {
    emoji: '🍃',
    name: 'Scheu',
    description: 'Zauber und Auftritte können es nicht als Ziel wählen. Flächenzauber treffen es trotzdem.',
  },
  tradeable: {
    emoji: '🔄',
    name: 'Tauschen',
    description: 'Auf der Hand: Für 1 Mana zurück ins Deck mischen und neu ziehen.',
  },
} as const;

function keywordTrait(keyword: KeywordId): TraitInfo {
  const d = TRAIT_DEFINITIONS[keyword];
  return { id: keyword, emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` };
}

function stateTrait(id: string, emoji: string, name: string, description: string): TraitInfo {
  return { id, emoji, name, description, fullTitle: `${emoji} ${name}: ${description}` };
}

function natureTrait(amount: number): TraitInfo {
  return stateTrait('spellPower', '🌿', `Naturkraft +${amount}`, `Deine Zauber machen ${amount} Schaden mehr.`);
}

function triggerTrait(trigger: Trigger, index: number, targeting: SpellTargeting = 'none'): TraitInfo {
  const text = effectsText(trigger.do, targeting, CARDS_DB);
  const [emoji, name, id] =
    trigger.if === 'combo' ? ['🐺', 'Rudeltaktik', 'combo'] : trigger.if === 'outcast' ? ['🦡', 'Einzelgänger', 'outcast'] : trigger.on === 'played' ? ['🎺', 'Auftritt', 'battlecry'] : ['👋', 'Abschied', 'deathrattle'];
  const condition = trigger.if === 'combo' ? 'Hast du in diesem Zug schon eine Karte gespielt: ' : trigger.if === 'outcast' ? 'Lag die Karte ganz links oder rechts auf der Hand: ' : '';
  const description = condition + text;
  return { id: `${id}_${index}`, emoji: emoji!, name: name!, description, fullTitle: `${emoji} ${name}: ${description}` };
}

/**
 * Ermittelt alle aktiven Eigenschaften eines Minions auf dem Spielfeld.
 */
export function getMinionTraits(minion: Minion): TraitInfo[] {
  const keywords = (['taunt', 'bubble', 'poisonous', 'stealth', 'rush', 'sprinter', 'doubleStrike', 'lifesteal', 'frostbite', 'reborn', 'immune', 'elusive'] as const)
    .filter((k) => minion[k])
    .map(keywordTrait);
  const deaths = minion.silenced ? [] : (CARDS_DB[minion.cardId]?.triggers ?? []).filter((t) => t.on === 'death').map((trigger, index) => triggerTrait(trigger, index));
  const states = [
    ...(minion.spellPower ? [natureTrait(minion.spellPower)] : []),
    ...(minion.frozen ? [stateTrait('frozen', '🧊', 'Erstarrt', 'Setzt den nächsten Angriff aus.')] : []),
    ...(minion.silenced ? [stateTrait('silenced', '😌', 'Beruhigt', 'Hat seine Fähigkeiten verloren.')] : []),
  ];
  return [...keywords, ...deaths, ...states];
}

/**
 * Vollständiger Tooltip-Text für das Minion (z. B. für das native title-Attribut).
 */
export function getMinionFullTitle(minion: Minion): string {
  const lines: string[] = [`${minion.name} (${minion.attack}/${minion.health})`];
  if (minion.quote) {
    lines.push(`„${minion.quote}“`);
  }
  const traits = getMinionTraits(minion);
  for (const t of traits) {
    lines.push(t.fullTitle);
  }
  return lines.join('\n');
}

/**
 * Ermittelt alle Eigenschaften einer Kartendefinition (Handkarten / Mulligan).
 */
export function getCardTraits(card: CardDefinition): TraitInfo[] {
  return [
    ...(card.keywords ?? []).map(keywordTrait),
    ...(card.spellPower ? [natureTrait(card.spellPower)] : []),
    ...(card.overload ? [stateTrait('overload', '🔒', `Erschöpfung ${card.overload}`, `Im nächsten Zug fehlen dir ${card.overload} Mana.`)] : []),
    ...(card.triggers ?? []).map((trigger, index) => triggerTrait(trigger, index, card.targeting)),
  ];
}

/**
 * Vollständiger Tooltip-Text für eine Karte (Hand / Mulligan).
 */
export function getCardFullTitle(card: CardDefinition): string {
  const lines: string[] = [card.isSpell ? `${card.name} (Zauber)` : card.name];
  if (card.text) lines.push(card.text);
  if (card.quote) {
    lines.push(`„${card.quote}“`);
  }
  const traits = getCardTraits(card);
  for (const t of traits) {
    lines.push(t.fullTitle);
  }
  return lines.join('\n');
}
