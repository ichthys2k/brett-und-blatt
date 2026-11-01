import { CARDS_DB } from '../cards';
import { effectsText } from '../core/text';
import type { CardDefinition, KeywordId, Minion, Trigger } from '../types';

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
} as const;

function keywordTrait(keyword: KeywordId): TraitInfo {
  const d = TRAIT_DEFINITIONS[keyword];
  return { id: keyword, emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` };
}

function triggerTrait(trigger: Trigger, index: number): TraitInfo {
  const description = effectsText(trigger.do, 'none', CARDS_DB);
  const [emoji, name, id] = trigger.on === 'played' ? ['🎺', 'Auftritt', 'battlecry'] : ['👋', 'Abschied', 'deathrattle'];
  return { id: `${id}_${index}`, emoji: emoji!, name: name!, description, fullTitle: `${emoji} ${name}: ${description}` };
}

/**
 * Ermittelt alle aktiven Eigenschaften eines Minions auf dem Spielfeld.
 */
export function getMinionTraits(minion: Minion): TraitInfo[] {
  const keywords = (['taunt', 'bubble', 'poisonous', 'stealth', 'rush'] as const).filter((k) => minion[k]).map(keywordTrait);
  const deaths = (CARDS_DB[minion.cardId]?.triggers ?? []).filter((t) => t.on === 'death').map(triggerTrait);
  return [...keywords, ...deaths];
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
  return [...(card.keywords ?? []).map(keywordTrait), ...(card.triggers ?? []).map(triggerTrait)];
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
