import type { BattlecryEffect, CardDefinition, DeathrattleEffect, Minion } from '../types';

export interface TraitInfo {
  id: string;
  emoji: string;
  name: string;
  description: string;
  fullTitle: string;
}

export const DEATHRATTLE_EFFECT_TEXTS: Record<DeathrattleEffect, string> = {
  butterfly: 'Ruft einen Schmetterling (1/2 mit Schutzblase) herbei.',
  explode_1: 'Fügt allen gegnerischen Tieren 1 Schaden zu.',
  heal_hero_2: 'Heilt deinen Helden um 2 Leben.',
};

export const BATTLECRY_EFFECT_TEXTS: Record<BattlecryEffect, string> = {
  summon_ant: 'Ruft einen Ameisen-Soldaten (1/1) herbei.',
  buff_allies_attack_1: 'Verleiht allen befreundeten Tieren +1 Angriff.',
  heal_hero_3: 'Heilt deinen Helden um 3 Leben.',
  dragon_breath: 'Fügt allen gegnerischen Tieren 2 Schaden zu.',
};

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

/**
 * Ermittelt alle aktiven Eigenschaften eines Minions auf dem Spielfeld.
 */
export function getMinionTraits(minion: Minion): TraitInfo[] {
  const traits: TraitInfo[] = [];

  if (minion.taunt) {
    const d = TRAIT_DEFINITIONS.taunt;
    traits.push({ id: 'taunt', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
  }

  if (minion.bubble) {
    const d = TRAIT_DEFINITIONS.bubble;
    traits.push({ id: 'bubble', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
  }

  if (minion.poisonous) {
    const d = TRAIT_DEFINITIONS.poisonous;
    traits.push({ id: 'poisonous', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
  }

  if (minion.stealth) {
    const d = TRAIT_DEFINITIONS.stealth;
    traits.push({ id: 'stealth', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
  }

  if (minion.rush) {
    const d = TRAIT_DEFINITIONS.rush;
    traits.push({ id: 'rush', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
  }

  if (minion.deathrattle) {
    const effectDesc = DEATHRATTLE_EFFECT_TEXTS[minion.deathrattle] ?? 'Löst einen Abschiedseffekt aus.';
    const desc = `Abschied: ${effectDesc}`;
    traits.push({
      id: 'deathrattle',
      emoji: '👋',
      name: 'Abschied',
      description: effectDesc,
      fullTitle: `👋 ${desc}`,
    });
  }

  return traits;
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
  if (!card.abilities || card.abilities.length === 0) return [];

  const traits: TraitInfo[] = [];

  for (const ab of card.abilities) {
    if (ab.type === 'taunt') {
      const d = TRAIT_DEFINITIONS.taunt;
      traits.push({ id: 'taunt', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
    } else if (ab.type === 'stealth') {
      const d = TRAIT_DEFINITIONS.stealth;
      traits.push({ id: 'stealth', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
    } else if (ab.type === 'bubble') {
      const d = TRAIT_DEFINITIONS.bubble;
      traits.push({ id: 'bubble', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
    } else if (ab.type === 'poisonous') {
      const d = TRAIT_DEFINITIONS.poisonous;
      traits.push({ id: 'poisonous', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
    } else if (ab.type === 'rush') {
      const d = TRAIT_DEFINITIONS.rush;
      traits.push({ id: 'rush', emoji: d.emoji, name: d.name, description: d.description, fullTitle: `${d.emoji} ${d.name}: ${d.description}` });
    } else if (ab.type === 'battlecry') {
      const effectDesc = BATTLECRY_EFFECT_TEXTS[ab.effect] ?? 'Löst einen Soforteffekt aus.';
      traits.push({
        id: `battlecry_${ab.effect}`,
        emoji: '🎺',
        name: 'Auftritt',
        description: effectDesc,
        fullTitle: `🎺 Auftritt: ${effectDesc}`,
      });
    } else if (ab.type === 'deathrattle') {
      const effectDesc = DEATHRATTLE_EFFECT_TEXTS[ab.effect] ?? 'Löst einen Abschiedseffekt aus.';
      traits.push({
        id: `deathrattle_${ab.effect}`,
        emoji: '👋',
        name: 'Abschied',
        description: effectDesc,
        fullTitle: `👋 Abschied: ${effectDesc}`,
      });
    }
  }

  return traits;
}

/**
 * Vollständiger Tooltip-Text für eine Karte (Hand / Mulligan).
 */
export function getCardFullTitle(card: CardDefinition): string {
  const lines: string[] = [card.spell ? `${card.name} (Zauber)` : card.name];
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
