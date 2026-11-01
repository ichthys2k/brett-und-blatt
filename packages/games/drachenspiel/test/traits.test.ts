import { describe, expect, it } from 'vitest';
import { CARDS_DB } from '../src/cards';
import type { Minion } from '../src/types';
import { getCardFullTitle, getCardTraits, getMinionFullTitle, getMinionTraits } from '../src/ui/traits';

describe('Drachenspiel Minion- & Karten-Eigenschaften (traits)', () => {
  const dummyMinion: Minion = {
    id: 'm_1',
    cardId: 'c13',
    name: 'Schildkröte',
    emoji: '🐢',
    cost: 2,
    baseAttack: 1,
    attack: 1,
    baseHealth: 5,
    maxHealth: 5,
    health: 5,
    quote: 'Langsam aber sicher.',
    sound: 'schildkroete.mp3',
    taunt: true,
    rush: false,
    bubble: false,
    poisonous: false,
    stealth: false,
    canAttack: false,
    hasAttacked: false,
    deathrattle: null,
  };

  it('erkennt 🛡️ Beschützer auf einem Minion', () => {
    const traits = getMinionTraits(dummyMinion);
    expect(traits).toHaveLength(1);
    expect(traits[0].emoji).toBe('🛡️');
    expect(traits[0].name).toBe('Beschützer');
    expect(traits[0].description).toContain('Muss angegriffen werden');
  });

  it('erkennt 🌙 Versteckt und 🧪 Giftig', () => {
    const stealthPoisonMinion: Minion = {
      ...dummyMinion,
      taunt: false,
      stealth: true,
      poisonous: true,
    };
    const traits = getMinionTraits(stealthPoisonMinion);
    expect(traits.map((t) => t.id)).toEqual(['poisonous', 'stealth']);
    expect(traits.find((t) => t.id === 'stealth')?.emoji).toBe('🌙');
    expect(traits.find((t) => t.id === 'poisonous')?.emoji).toBe('🧪');
  });

  it('erkennt 🫧 Schutzblase und ⚡ Flink', () => {
    const bubbleRushMinion: Minion = {
      ...dummyMinion,
      taunt: false,
      bubble: true,
      rush: true,
    };
    const traits = getMinionTraits(bubbleRushMinion);
    expect(traits.map((t) => t.id)).toEqual(['bubble', 'rush']);
    expect(traits.find((t) => t.id === 'bubble')?.emoji).toBe('🫧');
    expect(traits.find((t) => t.id === 'rush')?.emoji).toBe('⚡');
  });

  it('erkennt 👋 Abschied mit spezifischem Effekt', () => {
    const deathrattleMinion: Minion = {
      ...dummyMinion,
      taunt: false,
      deathrattle: 'explode_1',
    };
    const traits = getMinionTraits(deathrattleMinion);
    expect(traits).toHaveLength(1);
    expect(traits[0].emoji).toBe('👋');
    expect(traits[0].description).toBe('Fügt allen gegnerischen Tieren 1 Schaden zu.');
  });

  it('erzeugt vollständige Titel mit Spruch und allen Eigenschaften', () => {
    const fullMinion: Minion = {
      ...dummyMinion,
      taunt: true,
      stealth: true,
    };
    const full = getMinionFullTitle(fullMinion);
    expect(full).toContain('Schildkröte (1/5)');
    expect(full).toContain('„Langsam aber sicher.“');
    expect(full).toContain('🛡️ Beschützer:');
    expect(full).toContain('🌙 Versteckt:');
  });

  it('erkennt Auftritt 🎺 und Abschied 👋 auf Kartendefinitionen', () => {
    const antDef = CARDS_DB['c1'];
    expect(antDef).toBeDefined();
    const antTraits = getCardTraits(antDef);
    expect(antTraits).toHaveLength(1);
    expect(antTraits[0].emoji).toBe('🎺');
    expect(antTraits[0].name).toBe('Auftritt');
    expect(antTraits[0].description).toContain('Ameisen-Soldaten');

    const pufferDef = CARDS_DB['c20'];
    expect(pufferDef).toBeDefined();
    const pufferTraits = getCardTraits(pufferDef);
    expect(pufferTraits).toHaveLength(1);
    expect(pufferTraits[0].emoji).toBe('👋');
    expect(pufferTraits[0].description).toContain('allen gegnerischen Tieren 1 Schaden');

    const cardTitle = getCardFullTitle(pufferDef);
    expect(cardTitle).toContain('Kugelfisch');
    expect(cardTitle).toContain('👋 Abschied:');
  });
});
