import type { CardDefinition, DeckThemeId, Effect, FamilyId, KeywordId, QuestDefinition, Rarity, SchoolId, Selector, SpellTargeting, TrapDefinition, Trigger } from './types';

/**
 * Das Grundset (Phase 6 des Ausbauplans): Tiere und Zauber als reine Daten. Namen und Werte sind Vorschläge;
 * die Balance prüft die Häuser-Matrix in `test/balance.test.ts`.
 */
type House = DeckThemeId | 'neutral';

interface Extra {
  kw?: KeywordId[];
  t?: Trigger[];
  targeting?: SpellTargeting;
  rarity?: Rarity;
  spellPower?: number;
  overload?: number;
  token?: boolean;
  textName?: string;
}

const SELF = { pick: 'self' } as const;
const CHOSEN = { pick: 'chosen' } as const;
const OWN_HERO = { pick: 'hero', side: 'own' } as const;
const ALL_ENEMY = { pick: 'allMinions', side: 'enemy' } as const;
const ALL_OWN = { pick: 'allMinions', side: 'own' } as const;
const OTHERS_OWN = { pick: 'allMinions', side: 'own', exceptSelf: true } as const;

const played = (...effects: Effect[]): Trigger => ({ on: 'played', do: effects });
const combo = (...effects: Effect[]): Trigger => ({ on: 'played', if: 'combo', do: effects });
const outcast = (...effects: Effect[]): Trigger => ({ on: 'played', if: 'outcast', do: effects });
const kin = (family: FamilyId, ...effects: Effect[]): Trigger => ({ on: 'played', if: { family }, do: effects });
const death = (...effects: Effect[]): Trigger => ({ on: 'death', do: effects });
const turnEnd = (...effects: Effect[]): Trigger => ({ on: 'turnEnd', do: effects });
const afterSpell = (...effects: Effect[]): Trigger => ({ on: 'spellCast', do: effects });
const boost = (attack: number, health: number, to: Selector = SELF): Effect => ({ kind: 'buff', attack, health, to });

function animal(house: House, id: string, name: string, cost: number, attack: number, health: number, emoji: string, quote: string, family: FamilyId[], extra: Extra = {}): CardDefinition {
  const { kw, t, ...rest } = extra;
  return {
    id, name, cost, attack, health, emoji, quote, house, families: family, rarity: extra.rarity ?? 'common',
    ...(extra.rarity === 'mythic' ? { singleCopy: true } : {}),
    ...(kw ? { keywords: kw } : {}),
    ...(t ? { triggers: t } : {}),
    ...rest,
  };
}

function spell(house: House, id: string, name: string, cost: number, emoji: string, quote: string, school: SchoolId, effects: Effect[], targeting: SpellTargeting = 'none'): CardDefinition {
  return { id, name, cost, attack: 0, health: 0, emoji, quote, isSpell: true, effects, targeting, house, school, rarity: 'common' };
}

export const GRUNDSET_TOKENS: CardDefinition[] = [
  animal('neutral', 'token_treant', 'Waldkind', 2, 2, 2, '🌱', 'Wächst noch.', ['woodfolk'], { token: true, textName: 'ein Waldkind', kw: ['taunt'] }),
  animal('neutral', 'token_sardine', 'Sardine', 1, 1, 1, '🐟', 'Blubb!', ['sea'], { token: true, textName: 'eine Sardine' }),
  animal('neutral', 'token_bee', 'Biene', 1, 1, 1, '🐝', 'Summ!', ['crawlers'], { token: true, textName: 'eine Biene' }),
  animal('neutral', 'token_youngdragon', 'Drachenkind', 3, 3, 3, '🐉', 'Hicks!', ['dragons'], { token: true, textName: 'ein Drachenkind' }),
];

const F = 'forest', S = 'sea', H = 'farm', W = 'wild', B = 'bugs', N = 'neutral';

export const GRUNDSET_ANIMALS: CardDefinition[] = [
  // 🌳 Wald: wachsen, wählen, viel Mana; wenig Entfernung
  animal(F, 'f_jay', 'Eichelhäher', 1, 1, 3, '🐦', 'Hier war doch eine Eichel!', ['birds'], { t: [combo({ kind: 'draw', count: 1 })] }),
  animal(F, 'f_dormouse', 'Siebenschläfer', 1, 0, 3, '😴', 'Noch fünf Minuten.', ['burrowers'], { kw: ['taunt'] }),
  animal(F, 'f_badger', 'Dachs', 2, 2, 3, '🦡', 'Mein Bau, meine Regeln.', ['burrowers'], { t: [outcast(boost(1, 1))] }),
  animal(F, 'f_woodpecker', 'Specht', 2, 2, 2, '🪶', 'Tock, tock!', ['birds'], { targeting: 'enemyAny', t: [played({ kind: 'damage', amount: 1, to: CHOSEN })] }),
  animal(F, 'f_lynx', 'Luchs', 2, 3, 1, '🐈', 'Du siehst mich nicht.', ['cats'], { kw: ['stealth'] }),
  animal(F, 'f_treefolk', 'Waldschrat', 3, 2, 5, '🌲', 'Langsam, aber stetig.', ['woodfolk'], { t: [turnEnd(boost(0, 1))] }),
  animal(F, 'f_faun', 'Faun', 3, 3, 3, '🐐', 'Was darf es sein?', ['woodfolk'], { t: [played({ kind: 'chooseOne', options: [{ label: 'Flötenton: +2 Angriff', emoji: '🎶', effects: [boost(2, 0)] }, { label: 'Waldruhe: +2 Leben', emoji: '🍃', effects: [boost(0, 2)] }] })] }),
  animal(F, 'f_boar', 'Wildschwein', 3, 4, 2, '🐗', 'Aus dem Weg!', ['herd'], { kw: ['sprinter'] }),
  animal(F, 'f_wolf', 'Wolf', 3, 3, 4, '🐺', 'Das Rudel zählt.', ['pack'], { t: [combo(boost(1, 1))] }),
  animal(F, 'f_nymph', 'Waldfrau', 4, 3, 4, '🧝', 'Ruh dich aus.', ['woodfolk'], { t: [played({ kind: 'heal', amount: 4, to: OWN_HERO })] }),
  animal(F, 'f_stag', 'Platzhirsch', 4, 4, 4, '🦌', 'Mir nach!', ['herd'], { rarity: 'rare', t: [played({ kind: 'buff', attack: 1, to: { pick: 'allMinions', side: 'own', exceptSelf: true } })] }),
  animal(F, 'f_bear', 'Braunbär', 5, 4, 6, '🐻', 'Brumm.', ['giants'], { kw: ['taunt'] }),
  animal(F, 'f_eagleowl', 'Uhu', 5, 3, 6, '🦉', 'Uhuhu!', ['birds'], { rarity: 'rare', t: [afterSpell(boost(1, 1))] }),
  animal(F, 'f_oakgiant', 'Eichenriese', 6, 5, 7, '🌳', 'Wurzeln halten.', ['woodfolk', 'giants'], { rarity: 'rare', t: [turnEnd({ kind: 'heal', amount: 2, to: OWN_HERO })] }),
  animal(F, 'f_moose', 'Elch', 7, 7, 7, '🫎', 'Platz da.', ['giants'], { t: [played({ kind: 'draw', count: 1 })] }),
  animal(F, 'f_grimbart', 'Grimbart der Alte', 8, 6, 8, '🧙', 'Der Wald erinnert sich.', ['burrowers', 'mythic'], { rarity: 'mythic', t: [played(boost(2, 2, OTHERS_OWN))] }),

  // 🌊 Meer: Zähigkeit, Kälte, Wucht am Ende; etwas Glück
  animal(S, 'sea_seal', 'Robbe', 1, 1, 1, '🦭', 'Ork, ork!', ['sea'], { kw: ['bubble'], rarity: 'rare' }),
  animal(S, 'sea_sardine', 'Sardinenschwarm', 1, 1, 1, '🐠', 'Wir sind viele.', ['sea'], { t: [played({ kind: 'summon', cardId: 'token_sardine' })] }),
  animal(S, 'sea_starfish', 'Seestern', 1, 1, 2, '⭐', 'Hält sich fest.', ['sea'], { t: [turnEnd({ kind: 'heal', amount: 1, to: OWN_HERO })] }),
  animal(S, 'sea_ray', 'Zitterrochen', 2, 2, 2, '🐟', 'Bzzt!', ['sea'], { targeting: 'enemyMinion', t: [played({ kind: 'damage', amount: 1, to: CHOSEN })] }),
  animal(S, 'sea_penguin', 'Pinguin', 2, 2, 2, '🐧', 'Ganz schön kalt hier.', ['birds', 'sea'], { kw: ['frostbite'] }),
  animal(S, 'sea_hermit', 'Einsiedlerkrebs', 2, 1, 3, '🦀', 'Zieh dich warm an.', ['sea'], { kw: ['taunt'] }),
  animal(S, 'sea_dolphin', 'Delfin', 3, 2, 2, '🐬', 'Noch einmal!', ['sea'], { kw: ['doubleStrike'] }),
  animal(S, 'sea_moray', 'Muräne', 3, 2, 2, '🐍', 'Aus der Höhle.', ['sea', 'reptiles'], { kw: ['stealth', 'poisonous'], rarity: 'rare' }),
  animal(S, 'sea_turtle', 'Meeresschildkröte', 3, 2, 5, '🐢', 'Ich komme zurück.', ['sea', 'reptiles'], { kw: ['taunt'] }),
  animal(S, 'sea_gull', 'Möwe', 3, 2, 2, '🕊️', 'Meins! Meins!', ['birds'], { t: [played({ kind: 'discover', pool: 'spell' })] }),
  animal(S, 'sea_walrus', 'Walross', 4, 3, 5, '🦭', 'Dicke Haut.', ['sea'], { kw: ['taunt'] }),
  animal(S, 'sea_manta', 'Mantarochen', 4, 4, 4, '🪽', 'Flieg unter Wasser.', ['sea'], { kw: ['elusive'] }),
  animal(S, 'sea_orca', 'Orca', 5, 3, 4, '🐋', 'Ich jage im Team.', ['sea'], { rarity: 'rare', targeting: 'enemyMinion', t: [played({ kind: 'damage', amount: 3, to: CHOSEN })] }),
  animal(S, 'sea_shark', 'Hai', 5, 6, 4, '🦈', 'Dam-dam.', ['sea'], { kw: ['sprinter'] }),
  animal(S, 'sea_narwhal', 'Narwal', 6, 5, 5, '🦄', 'Eiskalt erwischt.', ['sea'], { rarity: 'rare', t: [played({ kind: 'freeze', to: ALL_ENEMY })] }),
  animal(S, 'sea_whale', 'Blauwal', 8, 6, 8, '🐳', 'Wuuuuuh.', ['sea', 'giants'], { kw: ['taunt'], rarity: 'rare', t: [played({ kind: 'draw', count: 1 })] }),
  animal(S, 'sea_serpent', 'Seeschlange', 9, 7, 9, '🐉', 'Aus der Tiefe.', ['sea', 'mythic'], { rarity: 'mythic', t: [played({ kind: 'damage', amount: 2, to: ALL_ENEMY }, { kind: 'freeze', to: ALL_ENEMY })] }),

  // 🚜 Bauernhof: Schwarm, verstärken, schützen; anfällig für Flächen
  animal(H, 'farm_fieldmouse', 'Feldmaus', 1, 1, 1, '🐁', 'Hab was gefunden.', ['burrowers'], { t: [death({ kind: 'draw', count: 1 })] }),
  animal(H, 'farm_duck', 'Renn-Ente', 1, 2, 1, '🦆', 'Quak, los!', ['birds'], { kw: ['rush'] }),
  animal(H, 'farm_lamb', 'Lamm', 1, 0, 3, '🐑', 'Mäh?', ['herd'], { t: [played({ kind: 'heal', amount: 2, to: OWN_HERO })] }),
  animal(H, 'farm_goose', 'Gans', 2, 2, 3, '🪿', 'Zisch!', ['birds'], { kw: ['taunt'] }),
  animal(H, 'farm_cat', 'Hofkatze', 2, 2, 2, '🐈', 'Mäuse? Wo?', ['cats'], { t: [combo({ kind: 'draw', count: 1 })] }),
  animal(H, 'farm_hen', 'Henne', 4, 2, 2, '🐔', 'Gack, ein Ei!', ['birds'], { rarity: 'rare', t: [turnEnd({ kind: 'summon', cardId: 'token_chick' })] }),
  animal(H, 'farm_sheepdog', 'Hütehund', 3, 2, 3, '🐕', 'Alle zusammen!', ['pack'], { t: [played({ kind: 'buff', attack: 1, health: 1, to: { pick: 'allMinions', side: 'own', exceptSelf: true, family: 'herd' } })] }),
  animal(H, 'farm_donkey', 'Esel', 3, 2, 4, '🫏', 'Ia!', ['herd'], { kw: ['taunt'] }),
  animal(H, 'farm_wolfsheep', 'Wolf im Schafspelz', 3, 3, 3, '🐺', 'Mäh. Ganz ehrlich.', ['pack'], { kw: ['stealth'], rarity: 'rare' }),
  animal(H, 'farm_ram', 'Leithammel', 4, 3, 4, '🐏', 'Mir nach!', ['herd'], { rarity: 'rare', t: [turnEnd({ kind: 'buff', health: 1, to: { pick: 'allMinions', side: 'own', family: 'herd' } })] }),
  animal(H, 'farm_cow', 'Kuh', 4, 3, 5, '🐄', 'Muh.', ['herd'], { t: [played({ kind: 'heal', amount: 3, to: OWN_HERO })] }),
  animal(H, 'farm_bull', 'Stier', 5, 5, 4, '🐂', 'Rot? Wo?', ['herd'], { kw: ['sprinter'] }),
  animal(H, 'farm_goldgoose', 'Goldene Gans', 6, 3, 6, '🪿', 'Ein goldenes Ei!', ['birds', 'mythic'], { rarity: 'mythic', t: [turnEnd({ kind: 'draw', count: 1 })] }),
  animal(H, 'farm_coldblood', 'Kaltblut', 6, 5, 7, '🐎', 'Zieh mit.', ['herd'], { t: [played({ kind: 'buff', health: 1, to: OTHERS_OWN })] }),
  animal(H, 'farm_musicians', 'Stadtmusikanten', 7, 5, 5, '🎺', 'Etwas Besseres findest du überall.', ['herd', 'mythic'], { rarity: 'mythic', t: [played({ kind: 'summon', cardId: 'token_chick', count: 3 }, boost(1, 1, OTHERS_OWN))] }),

  // 🌍 Wildnis: Rüstung, Rüstzeug, Tempo; wenig Karten
  animal(W, 'wild_meerkat', 'Erdmännchen', 1, 1, 3, '🐿️', 'Wache steht!', ['burrowers'], { t: [played({ kind: 'armor', amount: 1 })] }),
  animal(W, 'wild_jackal', 'Schakal', 1, 2, 1, '🐕', 'Wir kommen zu zweit.', ['pack'], { t: [combo(boost(1, 0))] }),
  animal(W, 'wild_warthog', 'Warzenschwein', 2, 1, 3, '🐗', 'Dicke Schwarte.', ['herd'], { t: [played({ kind: 'armor', amount: 2 })] }),
  animal(W, 'wild_hyena', 'Hyäne', 2, 3, 2, '🐺', 'Hihihi!', ['pack'], { kw: ['sprinter'] }),
  animal(W, 'wild_gazelle', 'Gazelle', 2, 3, 1, '🦌', 'Husch!', ['herd'], { kw: ['elusive'] }),
  animal(W, 'wild_lioncub', 'Junglöwe', 2, 2, 2, '🦁', 'Rrr?', ['cats'], { t: [outcast(boost(2, 0))] }),
  animal(W, 'wild_armadillo', 'Gürteltier', 3, 2, 4, '🪨', 'Eingerollt.', ['burrowers'], { kw: ['immune'] }),
  animal(W, 'wild_ostrich', 'Strauß', 3, 3, 2, '🦤', 'Kopf hoch!', ['birds'], { kw: ['rush'] }),
  animal(W, 'wild_buffalo', 'Büffel', 4, 3, 7, '🐃', 'Standhaft.', ['herd'], { kw: ['taunt'] }),
  animal(W, 'wild_lioness', 'Löwin', 4, 4, 4, '🦁', 'Die Jagd ruft.', ['cats'], { t: [kin('cats', boost(1, 1))] }),
  animal(W, 'wild_cheetah', 'Gepard', 4, 5, 3, '🐆', 'Schon da.', ['cats'], { kw: ['rush'], rarity: 'rare' }),
  animal(W, 'wild_gorilla', 'Gorilla', 5, 5, 6, '🦍', 'Trommelwirbel!', ['giants'], { t: [played({ kind: 'armor', amount: 3 })] }),
  animal(W, 'wild_tiger', 'Tiger', 5, 6, 5, '🐅', 'Leise Pfoten.', ['cats'], { kw: ['stealth'], rarity: 'rare' }),
  animal(W, 'wild_croc', 'Krokodil', 5, 4, 4, '🐊', 'Schnapp!', ['reptiles'], { rarity: 'rare', targeting: 'enemyMinion', t: [played({ kind: 'damage', amount: 3, to: CHOSEN })] }),
  animal(W, 'wild_mammoth', 'Mammut', 8, 8, 8, '🦣', 'Aus alter Zeit.', ['giants'], { kw: ['taunt'], rarity: 'rare' }),
  animal(W, 'wild_oda', 'Elefantin Oda', 9, 7, 9, '🐘', 'Die Karawane zieht.', ['giants', 'mythic'], { rarity: 'mythic', t: [played({ kind: 'armor', amount: 8 })] }),

  // 🐜 Krabbeltiere: billig, Gift, Ketten; zerbrechlich
  animal(B, 'bug_bee', 'Honigbiene', 2, 1, 2, '🐝', 'Summ, summ!', ['crawlers'], { kw: ['poisonous'] }),
  animal(B, 'bug_moth', 'Motte', 1, 1, 2, '🦋', 'Wo ist das Licht?', ['crawlers'], { kw: ['stealth'] }),
  animal(B, 'bug_ladybug', 'Marienkäfer', 1, 1, 1, '🐞', 'Bringt Glück.', ['crawlers'], { t: [death({ kind: 'draw', count: 1 })] }),
  animal(B, 'bug_firefly', 'Glühwürmchen', 1, 1, 1, '✨', 'Leuchtet dir heim.', ['crawlers'], { t: [played({ kind: 'addToHand', cardId: 'special_star', fleeting: true })] }),
  animal(B, 'bug_wasp', 'Wespe', 2, 2, 2, '🐝', 'Bzzz!', ['crawlers'], { kw: ['rush'] }),
  animal(B, 'bug_centipede', 'Tausendfüßler', 2, 1, 3, '🐛', 'Links, rechts, links ...', ['crawlers'], { kw: ['doubleStrike'] }),
  animal(B, 'bug_dragonfly', 'Libelle', 2, 2, 2, '🪰', 'Zack, weg.', ['crawlers'], { kw: ['elusive'] }),
  animal(B, 'bug_stagbeetle', 'Hirschkäfer', 3, 2, 6, '🪲', 'Geweih voran.', ['crawlers'], { kw: ['taunt'] }),
  animal(B, 'bug_tarantula', 'Vogelspinne', 3, 2, 3, '🕷️', 'Haarig, aber nett.', ['crawlers'], { kw: ['poisonous'] }),
  animal(B, 'bug_mantis', 'Fangschrecke', 3, 3, 2, '🦗', 'Ganz still.', ['crawlers'], { kw: ['stealth'], rarity: 'rare', t: [combo(boost(1, 1))] }),
  animal(B, 'bug_queen', 'Bienenkönigin', 4, 2, 4, '👑', 'An die Arbeit!', ['crawlers'], { rarity: 'rare', t: [turnEnd({ kind: 'summon', cardId: 'token_bee' })] }),
  animal(B, 'bug_hornet', 'Hornisse', 4, 4, 3, '🐝', 'Aus dem Weg.', ['crawlers'], { t: [combo({ kind: 'draw', count: 1 })] }),
  animal(B, 'bug_motherspider', 'Mutterspinne', 5, 4, 6, '🕸️', 'Kinder, zu mir!', ['crawlers'], { rarity: 'rare', t: [death({ kind: 'summon', cardId: 'token_ant', count: 3 })] }),
  animal(B, 'bug_mira', 'Spinnfrau Mira', 7, 5, 6, '🕷️', 'Alles hängt zusammen.', ['crawlers', 'mythic'], { kw: ['poisonous'], rarity: 'mythic', t: [played({ kind: 'freeze', to: ALL_ENEMY })] }),

  // Neutral: steht allen Häusern offen
  animal(N, 'n_sparrow', 'Spatz', 1, 1, 2, '🐦', 'Tschilp!', ['birds'], { kw: ['elusive'] }),
  animal(N, 'n_kobold', 'Kobold', 1, 2, 1, '🧌', 'Hehehe.', ['woodfolk']),
  animal(N, 'n_hamster', 'Hamster', 1, 1, 2, '🐹', 'Für später.', ['burrowers'], { kw: ['tradeable'] }),
  animal(N, 'n_pigeon', 'Taube', 2, 2, 2, '🕊️', 'Frieden!', ['birds'], { t: [played({ kind: 'heal', amount: 2, to: OWN_HERO })] }),
  animal(N, 'n_crow', 'Krähe', 2, 3, 2, '🐦‍⬛', 'Krah!', ['birds']),
  animal(N, 'n_mole', 'Maulwurf', 2, 2, 3, '🕳️', 'Wo bin ich?', ['burrowers'], { kw: ['tradeable'] }),
  animal(N, 'n_weasel', 'Wiesel', 2, 3, 1, '🦦', 'Flink wie ich.', ['burrowers'], { kw: ['sprinter'] }),
  animal(N, 'n_magpie', 'Elster', 3, 2, 2, '🐦', 'Oh, was glitzert da?', ['birds'], { t: [played({ kind: 'discover', pool: 'animal' })] }),
  animal(N, 'n_heron', 'Reiher', 3, 4, 3, '🦩', 'Geduld.', ['birds']),
  animal(N, 'n_stork', 'Storch', 3, 2, 4, '🪿', 'Ich bringe etwas.', ['birds'], { t: [death({ kind: 'draw', count: 1 })] }),
  animal(N, 'n_pony', 'Pony', 3, 3, 2, '🐴', 'Hü!', ['herd'], { kw: ['rush'] }),
  animal(N, 'n_wildcat', 'Wildkatze', 3, 3, 3, '🐈‍⬛', 'Pfote drauf.', ['cats'], { kw: ['stealth'] }),
  animal(N, 'n_bison', 'Bison', 4, 4, 5, '🦬', 'Schnaub.', ['herd']),
  animal(N, 'n_eagle', 'Adler', 4, 4, 2, '🦅', 'Von oben.', ['birds'], { kw: ['rush'] }),
  animal(N, 'n_dragonling', 'Jungdrache', 4, 3, 4, '🐲', 'Ich bin schon groß.', ['dragons'], { rarity: 'rare', t: [kin('dragons', boost(2, 2))] }),
  animal(N, 'n_giant', 'Waldriese', 6, 6, 7, '🧌', 'Kleines Tier, großer Tritt.', ['woodfolk', 'giants']),
  animal(N, 'n_hippogriff', 'Hippogryph', 5, 4, 4, '🦅', 'Halb Pferd, halb Greif.', ['mythic'], { kw: ['rush'], rarity: 'mythic' }),
  animal(N, 'n_unicorn', 'Einhorn', 5, 3, 5, '🦄', 'Rein und stark.', ['mythic'], { kw: ['bubble'], rarity: 'mythic', t: [played({ kind: 'heal', amount: 5, to: OWN_HERO })] }),
  animal(N, 'n_phoenix', 'Phönix', 6, 5, 4, '🐦‍🔥', 'Ich kehre zurück.', ['birds', 'mythic'], { kw: ['reborn'], rarity: 'mythic', t: [played({ kind: 'damage', amount: 2, to: ALL_ENEMY })] }),
  animal(N, 'n_basilisk', 'Basilisk', 6, 4, 5, '🐍', 'Sieh mich nicht an.', ['reptiles', 'mythic'], { kw: ['poisonous', 'frostbite'], rarity: 'mythic' }),
  animal(N, 'n_lindworm', 'Lindwurm', 7, 6, 6, '🐉', 'Aus dem Sumpf.', ['dragons', 'mythic'], { kw: ['rush'], rarity: 'mythic' }),
  animal(N, 'n_dragonmother', 'Drachenmutter', 8, 6, 7, '🐲', 'Meine Kleinen!', ['dragons', 'mythic'], { rarity: 'mythic', t: [played({ kind: 'summon', cardId: 'token_youngdragon', count: 2 })] }),
];

export const GRUNDSET_SPELLS: CardDefinition[] = [
  spell(F, 'f_seed', 'Saatkorn', 1, '🌱', 'Klein fängt es an.', 'growth', [{ kind: 'mana', amount: 2 }]),
  spell(F, 'f_blossom', 'Blütenregen', 3, '🌸', 'Tief durchatmen.', 'herbs', [{ kind: 'heal', amount: 4, to: OWN_HERO }, { kind: 'draw', count: 1 }]),
  spell(F, 'f_call', 'Waldruf', 5, '📯', 'Der Wald antwortet.', 'growth', [{ kind: 'summon', cardId: 'token_treant', count: 2 }, { kind: 'draw', count: 1 }]),
  spell(S, 'sea_tide', 'Gezeitenwechsel', 2, '🌊', 'Ebbe, Flut, Ebbe.', 'water', [{ kind: 'heal', amount: 2, to: OWN_HERO }, { kind: 'draw', count: 1 }]),
  spell(S, 'sea_maelstrom', 'Strudel', 3, '🌀', 'Festhalten!', 'water', [{ kind: 'damage', amount: 2, to: ALL_ENEMY }]),
  spell(H, 'farm_march', 'Gänsemarsch', 3, '🐥', 'Eins, zwei, drei!', 'growth', [{ kind: 'summon', cardId: 'token_chick', count: 3 }]),
  spell(H, 'farm_harvest', 'Erntedank', 4, '🌾', 'Für alle reicht es.', 'growth', [{ kind: 'buff', attack: 1, health: 2, to: ALL_OWN }]),
  spell(H, 'farm_hay', 'Heuballen', 1, '🌾', 'Weich gelandet.', 'light', [{ kind: 'grantKeyword', keyword: 'taunt', to: CHOSEN }, { kind: 'buff', health: 2, to: CHOSEN }], 'ownMinion'),
  spell(W, 'wild_tusk', 'Stoßzahn', 3, '🦷', 'Für die Lanze.', 'storm', [{ kind: 'equip', gear: { name: 'Stoßzahn', emoji: '🦷', attack: 3, durability: 2 } }]),
  spell(W, 'wild_grassfire', 'Steppenwind', 5, '💨', 'Alles in Bewegung.', 'storm', [{ kind: 'damage', amount: 3, to: ALL_ENEMY }]),
  spell(W, 'wild_shield', 'Dicker Panzer', 1, '🛡️', 'Besser ist das.', 'light', [{ kind: 'armor', amount: 4 }]),
  spell(B, 'bug_swarm', 'Schwarmruf', 2, '🐜', 'Alle Mann!', 'moon', [{ kind: 'summon', cardId: 'token_ant', count: 2 }]),
  spell(B, 'bug_fog', 'Giftnebel', 3, '🌫️', 'Bitte nicht einatmen.', 'herbs', [{ kind: 'damage', amount: 2, to: ALL_ENEMY }]),
  spell(N, 'n_ballbolt', 'Kugelblitz', 3, '⚡', 'Wohin rollt er?', 'storm', [{ kind: 'damage', amount: 2, to: { pick: 'random', side: 'enemy' } }, { kind: 'damage', amount: 2, to: { pick: 'random', side: 'enemy' } }]),
  spell(N, 'n_dragonbreath', 'Drachenatem', 4, '🔥', 'Heiße Luft.', 'ember', [{ kind: 'damage', amount: 5, to: CHOSEN }], 'enemyAny'),
];

const CHOSEN_T = { pick: 'chosen' } as const;
function building(house: House, id: string, name: string, cost: number, health: number, emoji: string, quote: string, effects: Effect[]): CardDefinition {
  return { id, name, cost, attack: 0, health, emoji, quote, house, families: ['buildings'], rarity: 'rare', building: effects };
}
function sleeper(house: House, id: string, name: string, cost: number, attack: number, health: number, emoji: string, quote: string, family: FamilyId[], turns: number, hatchesInto?: string): CardDefinition {
  return { id, name, cost, attack, health, emoji, quote, house, families: family, rarity: 'rare', dormant: turns, ...(hatchesInto ? { hatchesInto } : {}) };
}
function trap(house: House, id: string, name: string, cost: number, emoji: string, quote: string, on: TrapDefinition['on'], effects: Effect[]): CardDefinition {
  return { id, name, cost, attack: 0, health: 0, emoji, quote, isSpell: true, targeting: 'none', house, school: 'moon', rarity: 'common', trap: { on, do: effects } };
}
function questCard(house: House, id: string, name: string, emoji: string, quote: string, goal: QuestDefinition['goal'], count: number, reward: string): CardDefinition {
  return { id, name, cost: 1, attack: 0, health: 0, emoji, quote, house, rarity: 'rare', quest: { goal, count, reward } };
}

/** Phase 7: Spielsteine, die Eier und Aufgaben hervorbringen. */
export const PHASE7_TOKENS: CardDefinition[] = [
  animal(N, 'token_eggdragon', 'Eidrache', 6, 7, 7, '🐉', 'Endlich draußen!', ['dragons'], { token: true, textName: 'einen Eidrachen' }),
  animal(H, 'token_hen', 'Junghenne', 2, 3, 3, '🐔', 'Schon groß!', ['birds'], { token: true, textName: 'eine Junghenne' }),
  animal(B, 'token_bigmoth', 'Falter', 3, 4, 4, '🦋', 'Endlich Flügel!', ['crawlers'], { token: true, textName: 'einen Falter', kw: ['elusive'] }),
  animal(F, 'token_elder', 'Wächter des Hains', 5, 7, 7, '🌳', 'Der Wald dankt.', ['woodfolk'], { token: true, textName: 'einen Wächter', kw: ['taunt'] }),
  animal(S, 'token_krake', 'Riesenkrake', 5, 6, 8, '🐙', 'Viele Arme, viel Arbeit.', ['sea', 'giants'], { token: true, textName: 'eine Riesenkrake', t: [played({ kind: 'freeze', to: ALL_ENEMY })] }),
  animal(H, 'token_prize', 'Preisbulle', 5, 8, 6, '🐂', 'Erster Platz!', ['herd'], { token: true, textName: 'einen Preisbullen', kw: ['sprinter'] }),
  animal(W, 'token_warlord', 'Herrin der Steppe', 5, 7, 7, '🦁', 'Die Karawane siegt.', ['cats'], { token: true, textName: 'die Herrin der Steppe', kw: ['rush'] }),
  animal(B, 'token_swarmqueen', 'Schwarmkönigin', 5, 5, 6, '👑', 'Alle zu mir!', ['crawlers'], { token: true, textName: 'die Schwarmkönigin', kw: ['poisonous'], t: [played({ kind: 'summon', cardId: 'token_bee', count: 3 })] }),
];

export const PHASE7_CARDS: CardDefinition[] = [
  building(F, 'f_dam', 'Biberdamm', 3, 4, '🪵', 'Hält dicht.', [{ kind: 'armor', amount: 3 }]),
  building(S, 'sea_reef', 'Korallenriff', 3, 4, '🪸', 'Hier ist Platz für alle.', [{ kind: 'heal', amount: 2, to: ALL_OWN }, { kind: 'heal', amount: 1, to: OWN_HERO }]),
  building(H, 'farm_nest', 'Nest', 3, 3, '🪺', 'Es piept darin.', [{ kind: 'summon', cardId: 'token_chick' }]),
  building(W, 'wild_pool', 'Wasserloch', 3, 3, '💧', 'Alle kommen hierher.', [{ kind: 'heal', amount: 3, to: OWN_HERO }]),
  building(B, 'bug_hive', 'Bienenstock', 3, 4, '🍯', 'Es summt.', [{ kind: 'summon', cardId: 'token_bee' }]),
  building(N, 'n_tower', 'Turm', 4, 5, '🏰', 'Von oben sieht man alles.', [{ kind: 'damage', amount: 1, to: { pick: 'random', side: 'enemy' } }]),
  sleeper(F, 'f_marmot', 'Murmeltier', 2, 3, 4, '🦫', 'Schon Frühling?', ['burrowers'], 1),
  sleeper(S, 'sea_urchin', 'Seeigelei', 1, 3, 3, '🥚', 'Blubb, gleich!', ['sea'], 2),
  sleeper(H, 'farm_egg', 'Hühnerei', 1, 0, 1, '🥚', 'Es wackelt.', ['birds'], 2, 'token_hen'),
  sleeper(W, 'wild_cub', 'Bärenjunges', 2, 3, 3, '🧸', 'Noch fünf Minuten.', ['giants'], 2),
  sleeper(B, 'bug_cocoon', 'Kokon', 2, 0, 1, '🐛', 'Bitte nicht stören.', ['crawlers'], 1, 'token_bigmoth'),
  sleeper(N, 'n_dragonegg', 'Drachenei', 4, 0, 1, '🥚', 'Es wird warm.', ['dragons'], 3, 'token_eggdragon'),
  trap(F, 'f_roottrap', 'Wurzelfalle', 2, '🌿', 'Da war doch eine Wurzel.', 'heroAttacked', [{ kind: 'freeze', to: CHOSEN_T }, { kind: 'armor', amount: 3 }]),
  trap(S, 'sea_net', 'Treibnetz', 3, '🕸️', 'Zurück zum Absender.', 'heroAttacked', [{ kind: 'returnToHand', to: CHOSEN_T }]),
  trap(H, 'farm_alarm', 'Falscher Alarm', 3, '🔔', 'Alle raus!', 'minionPlayed', [{ kind: 'summon', cardId: 'token_chick', count: 2 }]),
  trap(W, 'wild_pit', 'Fallgrube', 2, '🕳️', 'Vorsicht, Stufe.', 'heroAttacked', [{ kind: 'damage', amount: 3, to: CHOSEN_T }]),
  trap(B, 'bug_sticky', 'Klebefalle', 2, '🍯', 'Pappt.', 'minionPlayed', [{ kind: 'freeze', to: CHOSEN_T }, { kind: 'damage', amount: 1, to: CHOSEN_T }]),
  trap(N, 'n_mask', 'Maskerade', 2, '🎭', 'Hab ich es doch gewusst.', 'spellCast', [{ kind: 'draw', count: 2 }]),
  questCard(F, 'f_quest', 'Versammlung im Bau', '📜', 'Alle unter die Erde!', { kind: 'playFamily', family: 'burrowers' }, 4, 'token_elder'),
  questCard(S, 'sea_quest', 'Ruf der Tiefe', '📜', 'Hört ihr das?', { kind: 'playFamily', family: 'sea' }, 6, 'token_krake'),
  questCard(H, 'farm_quest', 'Viehmarkt', '📜', 'Wer bietet mehr?', { kind: 'playFamily', family: 'herd' }, 4, 'token_prize'),
  questCard(W, 'wild_quest', 'Dickes Fell', '📜', 'Noch eine Schicht.', { kind: 'gainArmor' }, 8, 'token_warlord'),
  questCard(B, 'bug_quest', 'Großes Krabbeln', '📜', 'Es werden immer mehr.', { kind: 'playFamily', family: 'crawlers' }, 7, 'token_swarmqueen'),
];

/** Herkunft der älteren Karten: Haus, Familien, Seltenheit oder Zauberschule. */
const OLD_ANIMALS: Record<string, [House, FamilyId[], Rarity?]> = {
  c7: [F, ['burrowers']], c21: [F, ['burrowers']], c23: [F, ['burrowers']], c24: [F, ['burrowers']], c25: [F, ['burrowers']], c26: [F, ['birds']], c27: [F, ['birds'], 'rare'], c28: [F, ['cats']], c40: [F, ['herd']],
  c13: [S, ['reptiles', 'sea']], c15: [S, ['sea']], c16: [S, ['sea']], c17: [S, ['sea']], c18: [S, ['sea'], 'rare'], c19: [S, ['sea']], c20: [S, ['sea']], c32: [S, ['sea']],
  c6: [H, ['burrowers']], c22: [H, ['burrowers']], c29: [H, ['pack']], c35: [H, ['birds'], 'rare'], c36: [H, ['birds']], c37: [H, ['herd'], 'rare'], c38: [H, ['herd']], c39: [H, ['herd']], c44: [H, ['herd']], c45: [H, ['herd']],
  c34: [W, ['giants']], c41: [W, ['herd']], c42: [W, ['herd']], c43: [W, ['herd']], c46: [W, ['herd']], c47: [W, ['giants']], c48: [W, ['giants'], 'rare'], c49: [W, ['giants']], c50: [W, ['giants']],
  c1: [B, ['crawlers']], c2: [B, ['crawlers']], c3: [B, ['crawlers']], c4: [B, ['crawlers']], c5: [B, ['crawlers']], c8: [B, ['reptiles']], c10: [B, ['crawlers']], c11: [B, ['crawlers']], c12: [B, ['crawlers'], 'rare'], c14: [B, ['reptiles']], c51: [B, ['crawlers']], c52: [B, ['crawlers']],
  c9: [N, ['reptiles']], c30: [N, ['burrowers']], c31: [N, ['burrowers']], c33: [N, ['giants']], c53: [N, ['pack'], 'mythic'], c54: [N, ['dragons', 'mythic'], 'mythic'],
};

const OLD_SPELLS: Record<string, [House, SchoolId]> = {
  s_honey: [F, 'growth'], s_harvest: [F, 'moon'], s_growth: [H, 'growth'], s_summerRain: [H, 'herbs'], s_quiet: [H, 'light'],
  s_soapBubble: [S, 'water'], s_flood: [S, 'water'], s_frost: [S, 'frost'],
  s_whirlwind: [W, 'storm'], s_tailwind: [W, 'storm'],
  s_tracks: [B, 'moon'], s_clover: [B, 'growth'],
  s_lightning: [N, 'storm'],
};

/** Trägt Haus, Familien und Schule in die älteren Karten ein. */
export function tagOldCards(db: Record<string, CardDefinition>): void {
  for (const [id, [house, families, rarity]] of Object.entries(OLD_ANIMALS)) Object.assign(db[id]!, { house, families, rarity: rarity ?? 'common' });
  for (const [id, families] of Object.entries({ token_butterfly: ['crawlers'], token_ant: ['crawlers'], token_chick: ['birds'], token_mussel: ['sea'], token_shrimp: ['sea'], token_seahorse: ['sea'] } as Record<string, FamilyId[]>)) {
    Object.assign(db[id]!, { house: 'neutral', families });
  }
  for (const [id, [house, school]] of Object.entries(OLD_SPELLS)) Object.assign(db[id]!, { house, school, rarity: 'common' });
}
