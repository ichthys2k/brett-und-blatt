import type { CardDefinition, Effect, FamilyId, KeywordId, SchoolId, Selector, SpellTargeting } from '../types';

export const KEYWORD_NAMES: Record<KeywordId, string> = {
  taunt: 'Beschützer',
  rush: 'Flink',
  bubble: 'Schutzblase',
  poisonous: 'Giftig',
  stealth: 'Versteckt',
  sprinter: 'Sprinter',
  doubleStrike: 'Doppelschlag',
  lifesteal: 'Lebenskraft',
  frostbite: 'Kältestarre',
  reborn: 'Zweite Chance',
  immune: 'Eingerollt',
  elusive: 'Scheu',
  tradeable: 'Tauschen',
};

export const FAMILY_NAMES: Record<FamilyId, string> = {
  pack: 'Rudel',
  cats: 'Katzen',
  herd: 'Herde',
  birds: 'Vögel',
  burrowers: 'Gräber',
  crawlers: 'Krabbler',
  reptiles: 'Kriechtiere',
  sea: 'Meerestiere',
  giants: 'Riesen',
  mythic: 'Sagentiere',
  dragons: 'Drachen',
  woodfolk: 'Waldvolk',
  buildings: 'Bauten',
};

export const SCHOOL_NAMES: Record<SchoolId, string> = {
  storm: '⚡ Sturm',
  frost: '❄️ Frost',
  water: '🌊 Wasser',
  herbs: '🌿 Kräuter',
  growth: '🌱 Wachstum',
  light: '☀️ Licht',
  moon: '🌙 Mond',
  ember: '🔥 Glut',
};

const CHOSEN: Record<SpellTargeting, string> = {
  none: 'dem Ziel',
  enemyAny: 'einem gegnerischen Tier oder Helden',
  enemyMinion: 'einem gegnerischen Tier',
  ownMinion: 'einem eigenen Tier',
  trigger: 'dem auslösenden Tier',
};

function dative(selector: Selector, targeting: SpellTargeting): string {
  switch (selector.pick) {
    case 'chosen':
      return CHOSEN[targeting];
    case 'self':
      return 'sich';
    case 'hero':
      return selector.side === 'own' ? 'deinem Helden' : 'dem gegnerischen Helden';
    case 'allMinions':
      return `allen ${selector.exceptSelf ? 'anderen ' : ''}${selector.side === 'own' ? 'eigenen' : 'gegnerischen'} Tieren${selector.family ? ` der Familie ${FAMILY_NAMES[selector.family]}` : ''}`;
    case 'random':
      return `einem zufälligen ${selector.side === 'own' ? 'eigenen' : 'gegnerischen'} Tier`;
  }
}

function accusative(selector: Selector, targeting: SpellTargeting): string {
  if (selector.pick === 'self') return 'sich';
  if (selector.pick === 'hero') return selector.side === 'own' ? 'deinen Helden' : 'den gegnerischen Helden';
  if (selector.pick === 'allMinions') return `alle ${selector.exceptSelf ? 'anderen ' : ''}${selector.side === 'own' ? 'eigenen' : 'gegnerischen'} Tiere${selector.family ? ` der Familie ${FAMILY_NAMES[selector.family]}` : ''}`;
  if (selector.pick === 'random') return `ein zufälliges ${selector.side === 'own' ? 'eigenes' : 'gegnerisches'} Tier`;
  return CHOSEN[targeting].replace('einem gegnerischen', 'ein gegnerisches').replace('einem eigenen', 'ein eigenes').replace('dem auslösenden', 'das auslösende');
}

function buffText(attack?: number, health?: number): string {
  return [attack ? `+${attack} Angriff` : '', health ? `+${health} Leben` : ''].filter(Boolean).join(' und ');
}

function summonText(def: CardDefinition | undefined): string {
  if (!def) return 'ein Tier';
  const keywords = (def.keywords ?? []).map((k) => KEYWORD_NAMES[k]);
  return `${def.textName ?? def.name} (${def.attack}/${def.health}${keywords.length ? ` mit ${keywords.join(', ')}` : ''})`;
}

function effectText(effect: Effect, targeting: SpellTargeting, lookup: Record<string, CardDefinition>): string {
  switch (effect.kind) {
    case 'damage':
      return `Fügt ${dative(effect.to, targeting)} ${effect.amount} Schaden zu.`;
    case 'heal':
      return effect.amount === 'full' ? `Heilt ${accusative(effect.to, targeting)} ganz.` : `Heilt ${accusative(effect.to, targeting)} um ${effect.amount} Leben.`;
    case 'buff':
      return `Verleiht ${dative(effect.to, targeting)} ${buffText(effect.attack, effect.health)}.`;
    case 'grantKeyword':
      return `Verleiht ${dative(effect.to, targeting)} ${KEYWORD_NAMES[effect.keyword]}.`;
    case 'ready':
      return 'Es darf sofort angreifen.';
    case 'draw':
      return effect.count === 1 ? 'Ziehe eine Karte.' : `Ziehe ${effect.count} Karten.`;
    case 'summon':
      return `Ruft ${(effect.count ?? 1) > 1 ? `${effect.count}× ` : ''}${summonText(lookup[effect.cardId])} herbei.`;
    case 'returnToHand':
      return `Spült ${accusative(effect.to, targeting)} zurück auf die Hand (Spielsteine und bei voller Hand: weg).`;
    case 'mana':
      return `+${effect.amount} Mana in dieser Runde.`;
    case 'freeze':
      return `Versetzt ${accusative(effect.to, targeting)} in Kältestarre: Der nächste Angriff fällt aus.`;
    case 'silence':
      return `Beruhigt ${accusative(effect.to, targeting)}: Verstärkungen und Fähigkeiten sind weg.`;
    case 'addToHand':
      return `Gibt dir ${effect.fleeting ? 'flüchtig (nur in diesem Zug) ' : ''}${lookup[effect.cardId]?.name ?? 'eine Karte'} auf die Hand.`;
    case 'rebirth':
      return 'Kehrt mit 1 Leben zurück.';
    case 'discover':
      return `Fährte suchen: Wähle aus 3 zufälligen ${effect.pool === 'spell' ? 'Zaubern' : 'Tieren'} eine Karte für deine Hand.`;
    case 'chooseOne':
      return `Wähle: ${effect.options.map((option) => option.label).join(' oder ')}.`;
    case 'adapt':
      return 'Anpassen: Wähle aus 3 zufälligen Verbesserungen eine.';
    case 'armor':
      return `+${effect.amount} Rüstung.`;
    case 'heroAttack':
      return `Dein Held hat in diesem Zug +${effect.amount} Angriff.`;
    case 'equip':
      return `Rüstzeug für deinen Helden: ${effect.gear.name} (${effect.gear.attack} Angriff, hält ${effect.gear.durability} Angriffe).`;
    case 'summonRandom':
      return `Ruft zufällig ${effect.cardIds.map((id) => summonText(lookup[id])).join(', ').replace(/, ([^,]*)$/, ' oder $1')} herbei.`;
  }
}

const TRAP_WHEN = {
  heroAttacked: 'Greift ein Tier deinen Helden an',
  minionPlayed: 'Spielt der Gegner ein Tier',
  spellCast: 'Wirkt der Gegner einen Zauber',
};

/** Regeltext der besonderen Kartentypen, aus denselben Daten wie ihre Wirkung. */
export function specialCardText(def: CardDefinition, lookup: Record<string, CardDefinition>): string | undefined {
  if (def.trap) return `Falle: ${TRAP_WHEN[def.trap.on]}: ${effectsText(def.trap.do, 'trigger', lookup)}`;
  if (def.building) return `Bau, einmal je Zug nutzbar (kostet 1 Leben): ${effectsText(def.building, 'none', lookup)}`;
  if (def.quest) {
    const { goal, count, reward } = def.quest;
    const what = goal.kind === 'playFamily' ? `Spiele ${count} Tiere der Familie ${FAMILY_NAMES[goal.family]}` : goal.kind === 'playSpells' ? `Wirke ${count} Zauber` : `Sammle ${count} Rüstung`;
    return `Aufgabe: ${what}. Belohnung: ${lookup[reward]?.name ?? 'eine Karte'}.`;
  }
  if (def.dormant) {
    const into = def.hatchesInto ? lookup[def.hatchesInto] : undefined;
    return `Winterschlaf: Unangreifbar für ${def.dormant} ${def.dormant === 1 ? 'Zug' : 'Züge'}, dann ${into ? `schlüpft daraus: ${into.name} (${into.attack}/${into.health})` : 'erwacht es'}.`;
  }
  return undefined;
}

/** Der Regeltext entsteht aus den Daten, damit Text und Wirkung nie auseinanderlaufen. */
export function effectsText(effects: Effect[], targeting: SpellTargeting, lookup: Record<string, CardDefinition>): string {
  return effects.map((e) => effectText(e, targeting, lookup)).join(' ');
}
