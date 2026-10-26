import { HANDS } from '../cards';
import { DREAMS, ENHANCEMENTS, FOILS, NAILS, PACK_KINDS, PACK_SIZES, SPELLS, STICKERS, TAGS, TOOLS } from '../content';
import { modDef, RARITY_INFO } from '../mods';
import type { Consumable, HandType, ModInstance, Offer, PackOffer } from '../types';

export interface Described {
  emoji: string;
  title: string;
  text: string;
  tone: string;
}

export function describeConsumable(item: Consumable): Described {
  if (item.kind === 'spell') {
    const def = SPELLS[item.key];
    return def
      ? {
          emoji: def.emoji,
          title: def.name,
          text: def.text,
          tone: 'cs-t-spell',
        }
      : { emoji: '✨', title: 'Zauberkarte', text: '', tone: 'cs-t-spell' };
  }
  if (item.kind === 'nail') {
    const def = NAILS[item.key];
    if (!def) return { emoji: '💅', title: 'Nagelstudio', text: '', tone: 'cs-t-nail' };
    const hand = HANDS[def.hand];
    return {
      emoji: def.emoji,
      title: def.name,
      text: `${hand.name}: +1 Level (+${hand.chipsPerLevel} Chips, +${hand.multPerLevel} Mult)`,
      tone: 'cs-t-nail',
    };
  }
  const def = DREAMS[item.key];
  return def ? { emoji: def.emoji, title: def.name, text: def.text, tone: 'cs-t-dream' } : { emoji: '🌙', title: 'Traumkarte', text: '', tone: 'cs-t-dream' };
}

export function describeMod(mod: Pick<ModInstance, 'key' | 'foil' | 'sticker' | 'value' | 'spent' | 'roundsLeft'>): Described {
  const def = modDef(mod.key);
  const extras: string[] = [];
  if (mod.value !== undefined && def.initial !== undefined) extras.push(`Stand: ${Math.round(mod.value * 100) / 100}`);
  if (mod.foil) extras.push(`${FOILS[mod.foil].emoji} ${FOILS[mod.foil].name}: ${FOILS[mod.foil].text}`);
  if (mod.sticker)
    extras.push(
      `${STICKERS[mod.sticker].emoji} ${STICKERS[mod.sticker].name}: ${STICKERS[mod.sticker].text}${mod.sticker === 'perishable' && mod.roundsLeft !== undefined ? ` (noch ${mod.roundsLeft})` : ''}`,
    );
  if (mod.spent) extras.push('Abgelaufen – wirkt nicht mehr');
  return {
    emoji: def.emoji,
    title: def.name,
    text: [def.text, `Seltenheit: ${RARITY_INFO[def.rarity].name}`, ...extras].join(' · '),
    tone: `cs-t-${def.rarity}`,
  };
}

export function describeOffer(offer: Offer): Described {
  if (offer.type === 'mod') return describeMod(offer);
  if (offer.type === 'consumable') return describeConsumable(offer.item);
  const card = offer.card;
  const parts = [card.enh ? ENHANCEMENTS[card.enh].name : '', card.foil ? FOILS[card.foil].name : ''].filter(Boolean);
  return {
    emoji: '🎴',
    title: 'Spielkarte',
    text: parts.join(', ') || 'Kommt ins Deck',
    tone: 'cs-t-card',
  };
}

export function describePack(pack: PackOffer): Described {
  const kind = PACK_KINDS[pack.kind];
  const size = PACK_SIZES[pack.size];
  const items = size.items[pack.kind];
  return {
    emoji: kind.emoji,
    title: `${kind.name}${size.name ? ` (${size.name})` : ''}`,
    text: `${items} Stück, ${size.picks === 1 ? 'eins' : `${size.picks}`} davon aussuchen. ${kind.text}.`,
    tone: 'cs-t-pack',
  };
}

export function describeTool(key: string): Described {
  const def = TOOLS[key]!;
  return {
    emoji: def.emoji,
    title: def.name,
    text: def.text,
    tone: 'cs-t-tool',
  };
}

export function describeTag(key: string): Described {
  const def = TAGS[key]!;
  return {
    emoji: def.emoji,
    title: def.name,
    text: def.text,
    tone: 'cs-t-tag',
  };
}

export function handName(type: HandType): string {
  return HANDS[type].name;
}

/** Zahlen kurz: 12 345 → „12.345“, sehr große mit „Mio.“. */
export function formatNumber(value: number): string {
  if (value >= 10_000_000) return `${(value / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.`;
  return Math.floor(value).toLocaleString('de-DE');
}

export function formatMult(value: number): string {
  return (Math.round(value * 100) / 100).toLocaleString('de-DE', {
    maximumFractionDigits: 2,
  });
}
