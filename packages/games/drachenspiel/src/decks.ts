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
    spellSwap: { out: ['f_jay', 'c7', 'f_badger'], in: ['s_honey', 'f_seed', 's_harvest'] },
    name: 'Wald',
    emoji: '🌳',
    description: 'Wachsen, wählen, am Ende groß. Wenig, was den Gegner direkt trifft.',
    cardIds: ['f_jay', 'f_jay', 'f_dormouse', 'f_dormouse', 'c7', 'c7', 'f_lynx', 'f_lynx', 'f_woodpecker', 'f_woodpecker', 'f_badger', 'f_badger', 'c28', 'c28', 'f_wolf', 'f_wolf', 'f_treefolk', 'f_treefolk', 'c23', 'c23', 'f_faun', 'f_faun', 'c27', 'c27', 'f_stag', 'f_stag', 'f_bear', 'f_bear', 'f_grimbart', 'c54'],
  },
  sea: {
    id: 'sea',
    spellSwap: { out: ['sea_seal', 'sea_ray', 'c17'], in: ['s_flood', 's_frost', 'sea_maelstrom'] },
    name: 'Meer',
    emoji: '🌊',
    description: 'Zäh und kalt, spät mit Wucht. Dafür etwas Glück bei den Helfern.',
    cardIds: ['sea_seal', 'sea_seal', 'sea_starfish', 'sea_starfish', 'sea_penguin', 'sea_penguin', 'c15', 'c15', 'c18', 'c18', 'sea_ray', 'sea_ray', 'sea_moray', 'sea_moray', 'sea_dolphin', 'sea_dolphin', 'c17', 'c17', 'sea_gull', 'sea_gull', 'sea_walrus', 'sea_walrus', 'sea_manta', 'sea_manta', 'sea_orca', 'sea_orca', 'sea_shark', 'sea_shark', 'sea_serpent', 'sea_whale'],
  },
  farm: {
    id: 'farm',
    spellSwap: { out: ['farm_fieldmouse', 'farm_goose', 'c22'], in: ['s_quiet', 's_growth', 'farm_march'] },
    name: 'Bauernhof',
    emoji: '🚜',
    description: 'Viele Kleine, die sich stärken. Anfällig, wenn der Gegner alle zugleich trifft.',
    cardIds: ['farm_duck', 'farm_duck', 'farm_fieldmouse', 'farm_fieldmouse', 'farm_goose', 'farm_goose', 'farm_lamb', 'farm_lamb', 'farm_hen', 'farm_hen', 'c29', 'c29', 'farm_sheepdog', 'farm_sheepdog', 'c22', 'c22', 'farm_wolfsheep', 'farm_wolfsheep', 'c35', 'c35', 'farm_cow', 'farm_cow', 'c38', 'c38', 'farm_bull', 'farm_bull', 'farm_ram', 'farm_ram', 'farm_musicians', 'c44'],
  },
  wild: {
    id: 'wild',
    spellSwap: { out: ['wild_jackal', 'wild_hyena', 'wild_ostrich'], in: ['wild_tusk', 's_whirlwind', 's_tailwind'] },
    name: 'Wildnis',
    emoji: '🌍',
    description: 'Rüstung und Tempo, der Held kämpft mit. Dafür wenig neue Karten.',
    cardIds: ['wild_meerkat', 'wild_meerkat', 'wild_jackal', 'wild_jackal', 'wild_warthog', 'wild_warthog', 'wild_hyena', 'wild_hyena', 'wild_lioncub', 'wild_lioncub', 'wild_armadillo', 'wild_armadillo', 'wild_ostrich', 'wild_ostrich', 'wild_buffalo', 'wild_buffalo', 'wild_cheetah', 'wild_cheetah', 'c43', 'c43', 'wild_gorilla', 'wild_gorilla', 'wild_tiger', 'wild_tiger', 'c47', 'c47', 'c48', 'c48', 'wild_oda', 'wild_mammoth'],
  },
  bugs: {
    id: 'bugs',
    spellSwap: { out: ['c5', 'bug_moth', 'bug_dragonfly'], in: ['s_tracks', 's_clover', 'bug_swarm'] },
    name: 'Krabbeltiere',
    emoji: '🐜',
    description: 'Billig, giftig, in Ketten stark. Aber alles zerbrechlich.',
    cardIds: ['c1', 'c1', 'c2', 'c2', 'bug_bee', 'bug_bee', 'bug_moth', 'bug_moth', 'c4', 'c4', 'c5', 'c5', 'bug_wasp', 'bug_wasp', 'c11', 'c11', 'c12', 'c12', 'bug_dragonfly', 'bug_dragonfly', 'bug_stagbeetle', 'bug_stagbeetle', 'bug_mantis', 'bug_mantis', 'bug_hornet', 'bug_hornet', 'bug_motherspider', 'bug_motherspider', 'bug_mira', 'c53'],
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
