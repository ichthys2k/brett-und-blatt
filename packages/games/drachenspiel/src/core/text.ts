import type { CardDefinition, Effect, KeywordId, Selector, SpellTargeting } from '../types';

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

const CHOSEN: Record<SpellTargeting, string> = {
  none: 'dem Ziel',
  enemyAny: 'einem gegnerischen Tier oder Helden',
  enemyMinion: 'einem gegnerischen Tier',
  ownMinion: 'einem eigenen Tier',
};

function dative(selector: Selector, targeting: SpellTargeting): string {
  switch (selector.pick) {
    case 'chosen':
      return CHOSEN[targeting];
    case 'hero':
      return selector.side === 'own' ? 'deinem Helden' : 'dem gegnerischen Helden';
    case 'allMinions':
      return `allen ${selector.exceptSelf ? 'anderen ' : ''}${selector.side === 'own' ? 'eigenen' : 'gegnerischen'} Tieren`;
  }
}

function accusative(selector: Selector, targeting: SpellTargeting): string {
  if (selector.pick === 'hero') return selector.side === 'own' ? 'deinen Helden' : 'den gegnerischen Helden';
  if (selector.pick === 'allMinions') return `alle ${selector.exceptSelf ? 'anderen ' : ''}${selector.side === 'own' ? 'eigenen' : 'gegnerischen'} Tiere`;
  return CHOSEN[targeting].replace('einem gegnerischen', 'ein gegnerisches').replace('einem eigenen', 'ein eigenes');
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
      return `Ruft ${summonText(lookup[effect.cardId])} herbei.`;
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

/** Der Regeltext entsteht aus den Daten, damit Text und Wirkung nie auseinanderlaufen. */
export function effectsText(effects: Effect[], targeting: SpellTargeting, lookup: Record<string, CardDefinition>): string {
  return effects.map((e) => effectText(e, targeting, lookup)).join(' ');
}
