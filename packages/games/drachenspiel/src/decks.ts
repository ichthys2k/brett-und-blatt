import type { DeckThemeId } from './types';

export interface DeckThemeInfo {
  id: DeckThemeId;
  name: string;
  emoji: string;
  description: string;
  cardIds: string[]; // exactly 30 card def IDs
  /** Mit Zauberkarten: diese drei Tierpaare weichen je einem Zauberpaar. */
  spellSwap: { out: [string, string, string]; in: [string, string, string] };
}

export const DECK_THEMES: Record<DeckThemeId, DeckThemeInfo> = {
  forest: {
    id: 'forest',
    spellSwap: { out: ['c4', 'c7', 'c26'], in: ['s_honey', 's_growth', 's_clover'] },
    name: 'Wald',
    emoji: '🌳',
    description: 'Ausgewogen und anpassungsfähig mit Igel, Biber und Drache.',
    cardIds: [
      'c51', 'c51', // Raupe
      'c4',  'c4',  // Käfer
      'c7',  'c7',  // Maus
      'c21', 'c21', // Hase
      'c23', 'c23', // Biber
      'c24', 'c24', // Eichhörnchen
      'c25', 'c25', // Igel
      'c27', 'c27', // Eule
      'c28', 'c28', // Katze
      'c26', 'c26', // Fledermaus
      'c40', 'c40', // Hirsch
      'c5',  'c5',  // Schmetterling
      'c8',  'c8',  // Frosch
      'c29', 'c29', // Hund
      'c53',        // Fuchs
      'c54',        // Drache
    ],
  },
  sea: {
    id: 'sea',
    spellSwap: { out: ['c19', 'c11', 'c46'], in: ['s_soapBubble', 's_flood', 's_frost'] },
    name: 'Meer',
    emoji: '🌊',
    description: 'Zähigkeit, Schutzblasen und Gegenangriffe.',
    cardIds: [
      'c5',  'c5',  // Schmetterling
      'c10', 'c10', // Schnecke
      'c15', 'c15', // Krabbe
      'c16', 'c16', // Hummer
      'c17', 'c17', // Tintenfisch
      'c18', 'c18', // Krake
      'c19', 'c19', // Fisch
      'c20', 'c20', // Kugelfisch
      'c32', 'c32', // Otter
      'c13', 'c13', // Schildkröte
      'c11', 'c11', // Spinne
      'c14', 'c14', // Schlange
      'c50', 'c50', // Nilpferd
      'c46', 'c46', // Kamel
      'c53',        // Fuchs
      'c54',        // Drache
    ],
  },
  farm: {
    id: 'farm',
    spellSwap: { out: ['c3', 'c6', 'c36'], in: ['s_quiet', 's_honey', 's_growth'] },
    name: 'Bauernhof',
    emoji: '🚜',
    description: 'Gemeinsam stark: Schnelle Tiere und gegenseitige Verstärkung.',
    cardIds: [
      'c1',  'c1',  // Ameise
      'c2',  'c2',  // Mücke
      'c3',  'c3',  // Fliege
      'c6',  'c6',  // Ratte
      'c22', 'c22', // Kaninchen
      'c29', 'c29', // Hund
      'c35', 'c35', // Hahn
      'c36', 'c36', // Truthahn
      'c37', 'c37', // Schaf
      'c38', 'c38', // Ziege
      'c39', 'c39', // Schwein
      'c44', 'c44', // Pferd
      'c45', 'c45', // Ochse
      'c52', 'c52', // Grille
      'c7',         // Maus
      'c54',        // Drache
    ],
  },
  wild: {
    id: 'wild',
    spellSwap: { out: ['c9', 'c41', 'c43'], in: ['s_lightning', 's_tailwind', 's_whirlwind'] },
    name: 'Wildnis',
    emoji: '🌍',
    description: 'Große, kraftvolle Giganten für die späten Runden.',
    cardIds: [
      'c9',  'c9',  // Eidechse
      'c12', 'c12', // Skorpion
      'c14', 'c14', // Schlange
      'c34', 'c34', // Affe
      'c41', 'c41', // Lama
      'c42', 'c42', // Känguru
      'c43', 'c43', // Zebra
      'c46', 'c46', // Kamel
      'c47', 'c47', // Giraffe
      'c48', 'c48', // Elefant
      'c49', 'c49', // Nashorn
      'c50', 'c50', // Nilpferd
      'c13', 'c13', // Schildkröte
      'c40', 'c40', // Hirsch
      'c53',        // Fuchs
      'c54',        // Drache
    ],
  },
  bugs: {
    id: 'bugs',
    spellSwap: { out: ['c3', 'c10', 'c15'], in: ['s_tailwind', 's_clover', 's_lightning'] },
    name: 'Krabbeltiere',
    emoji: '🐜',
    description: 'Giftig, flink und unberechenbar im Schwarm.',
    cardIds: [
      'c1',  'c1',  // Ameise
      'c2',  'c2',  // Mücke
      'c3',  'c3',  // Fliege
      'c4',  'c4',  // Käfer
      'c5',  'c5',  // Schmetterling
      'c10', 'c10', // Schnecke
      'c51', 'c51', // Raupe
      'c52', 'c52', // Grille
      'c11', 'c11', // Spinne
      'c12', 'c12', // Skorpion
      'c14', 'c14', // Schlange
      'c15', 'c15', // Krabbe
      'c25', 'c25', // Igel
      'c8',  'c8',  // Frosch
      'c53',        // Fuchs
      'c54',        // Drache
    ],
  },
};

export const DECK_THEME_IDS: DeckThemeId[] = ['forest', 'sea', 'farm', 'wild', 'bugs'];

/** Kartenliste eines Themendecks, mit Zauberkarten nach `spellSwap`. */
export function themeCardIds(theme: DeckThemeId, withSpells: boolean): string[] {
  const info = DECK_THEMES[theme];
  if (!withSpells) return [...info.cardIds];
  return info.cardIds.map((id) => {
    const i = info.spellSwap.out.indexOf(id);
    return i < 0 ? id : info.spellSwap.in[i]!;
  });
}
