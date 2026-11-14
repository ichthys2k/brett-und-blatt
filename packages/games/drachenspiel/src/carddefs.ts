import { CARDS_DB } from './cards';
import type { CardDefinition } from './types';

/**
 * Die eine Quelle für Kartendefinitionen in den Regeln (#277, K7): Grundkarten aus `CARDS_DB`,
 * überlagert von Anki-Werten aus `state.customCards`. Neue Karten aus Anki (`custom: true`) sind
 * einfache Begleiter mit Werten, Schlüsselwörtern und geprüften Auslösern (#270). Alles in
 * `customCards` ist beim Spielstart von `sanitizeDrachenspielCatalog` geprüft worden.
 */
export type CustomCard = Partial<CardDefinition> & { custom?: true };

export function cardDefOf(state: { customCards?: Record<string, CustomCard> }, id: string): CardDefinition | undefined {
  const base = CARDS_DB[id];
  const override = state.customCards?.[id];
  if (!base) {
    if (!override?.custom) return undefined;
    return {
      id,
      name: override.name ?? id,
      cost: override.cost ?? 1,
      attack: override.attack ?? 1,
      health: override.health ?? 1,
      emoji: override.emoji ?? '🐾',
      quote: override.quote ?? '',
      house: override.house ?? 'neutral',
      rarity: 'common',
      families: [],
      ...(override.keywords ? { keywords: override.keywords } : {}),
      ...(override.triggers ? { triggers: override.triggers } : {}),
      ...(override.text ? { text: override.text } : {}),
    };
  }
  if (!override) return base;
  const { custom: _custom, ...rest } = override;
  return { ...base, ...rest };
}
