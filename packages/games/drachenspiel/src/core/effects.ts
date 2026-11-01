import { Rng, type GameEvent, type SeatId } from '@brett-und-blatt/engine';
import { CARDS_DB } from '../cards';
import type { CardDefinition, CardInstance, ChoiceOption, DrachenspielState, Effect, Enchantment, KeywordId, Minion, MinionKeyword, PlayerState, QueuedEffect, Selector, SpellTarget } from '../types';

export const HAND_LIMIT = 10;
export const BOARD_LIMIT = 7;
export const MAX_MANA = 10;
/** Ausgleich für den Startvorteil: gemessen mit Bots, 3 Rüstung bewegen kaum etwas, 8 sind zu viel. */
export const SECOND_SEAT_ARMOR = 5;
/** Nach so vielen Zügen endet die Partie unentschieden, damit sie nie endlos läuft. */
export const MAX_TURNS = 89;
/** Grenze gegen Endlosketten aus Effekten und Abschieden je Aktion. */
const MAX_QUEUE_STEPS = 200;

/** Fähigkeiten, die nur gesetzt werden, wenn sie zutreffen. */
/** Die Verbesserungen von „Anpassen“; drei davon stehen je Karte zur Wahl. */
const ADAPTATIONS: ChoiceOption[] = [
  { label: '+1 Angriff, +1 Leben', emoji: '💪', effects: [{ kind: 'buff', attack: 1, health: 1, to: { pick: 'self' } }] },
  { label: '+3 Leben', emoji: '🐚', effects: [{ kind: 'buff', health: 3, to: { pick: 'self' } }] },
  { label: '+2 Angriff', emoji: '🦷', effects: [{ kind: 'buff', attack: 2, to: { pick: 'self' } }] },
  { label: 'Beschützer', emoji: '🛡️', effects: [{ kind: 'grantKeyword', keyword: 'taunt', to: { pick: 'self' } }] },
  { label: 'Schutzblase', emoji: '🫧', effects: [{ kind: 'grantKeyword', keyword: 'bubble', to: { pick: 'self' } }] },
  { label: 'Giftig', emoji: '🧪', effects: [{ kind: 'grantKeyword', keyword: 'poisonous', to: { pick: 'self' } }] },
  { label: 'Lebenskraft', emoji: '💚', effects: [{ kind: 'grantKeyword', keyword: 'lifesteal', to: { pick: 'self' } }] },
  { label: 'Sprinter', emoji: '🏃', effects: [{ kind: 'grantKeyword', keyword: 'sprinter', to: { pick: 'self' } }] },
];

const OPTIONAL_KEYWORDS: MinionKeyword[] = ['sprinter', 'doubleStrike', 'lifesteal', 'frostbite', 'reborn', 'immune', 'elusive'];

/** Berechnet die Werte einer Figur aus Grundwerten, Veränderungen und Schaden neu. */
export function refreshStats(minion: Minion): void {
  minion.attack = minion.enchantments.reduce((sum, e) => sum + (e.attack ?? 0), minion.baseAttack);
  minion.maxHealth = minion.enchantments.reduce((sum, e) => sum + (e.health ?? 0), minion.baseHealth);
  minion.health = minion.maxHealth - minion.damage;
}

export function createMinion(state: DrachenspielState, def: CardDefinition, owner: SeatId): Minion {
  const has = (keyword: KeywordId) => def.keywords?.includes(keyword) ?? false;
  const entityId = state.nextEntityId++;
  return {
    id: `m_${entityId}`,
    cardId: def.id,
    owner,
    playOrder: entityId,
    name: def.name,
    emoji: def.emoji,
    cost: def.cost,
    baseAttack: def.attack,
    attack: def.attack,
    baseHealth: def.health,
    maxHealth: def.health,
    health: def.health,
    damage: 0,
    enchantments: [],
    quote: def.quote ?? null,
    sound: def.sound ?? null,
    taunt: has('taunt'),
    rush: has('rush'),
    bubble: has('bubble'),
    poisonous: has('poisonous'),
    stealth: has('stealth'),
    canAttack: has('rush') || has('sprinter'),
    hasAttacked: false,
    justPlayed: true,
    ...(def.spellPower ? { spellPower: def.spellPower } : {}),
    ...Object.fromEntries(OPTIONAL_KEYWORDS.filter(has).map((keyword) => [keyword, true])),
  };
}

/** Darf diese Figur jetzt angreifen? */
export function canStrike(minion: Minion): boolean {
  return minion.canAttack && !minion.hasAttacked && !minion.frozen && minion.attack > 0;
}

/** Zurück kommt der wirklich zugefügte Schaden: 0 bei Schutzblase oder Eingerollt. */
export function damageMinion(minion: Minion, amount: number, isPoisonous: boolean, events: GameEvent[]): number {
  if (amount <= 0) return 0;
  if (minion.immune) {
    events.push({ type: 'damageBlocked', minionId: minion.id });
    return 0;
  }
  if (minion.bubble) {
    minion.bubble = false;
    events.push({ type: 'bubblePopped', minionId: minion.id });
    return 0;
  }
  minion.damage = isPoisonous ? Math.max(minion.damage + amount, minion.maxHealth) : minion.damage + amount;
  refreshStats(minion);
  events.push({ type: 'damage', targetType: 'minion', targetId: minion.id, amount, health: minion.health });
  return amount;
}

function freezeMinion(minion: Minion, events: GameEvent[]): void {
  minion.frozen = true;
  events.push({ type: 'minionFrozen', minionId: minion.id });
}

/** Der Schlag einer Figur im Kampf: Gift, Kältestarre und Lebenskraft hängen am Treffer. */
export function strike(source: Minion, owner: PlayerState, target: Minion | PlayerState, events: GameEvent[]): void {
  const amount = source.attack;
  if (amount <= 0) return;
  let dealt: number;
  if ('board' in target) {
    damageHero(target, amount, events);
    dealt = amount;
  } else {
    dealt = damageMinion(target, amount, source.poisonous, events);
    if (dealt > 0 && source.frostbite) freezeMinion(target, events);
  }
  if (dealt > 0 && source.lifesteal) healHero(owner, dealt, events);
}

/** Was eine beruhigte Figur verliert. Leben sinken höchstens bis zum neuen Maximum, sie stirbt daran nicht. */
function silenceMinion(minion: Minion, events: GameEvent[]): void {
  const health = minion.health;
  minion.enchantments = [];
  minion.taunt = minion.rush = minion.bubble = minion.poisonous = minion.stealth = false;
  for (const keyword of OPTIONAL_KEYWORDS) delete minion[keyword as Exclude<MinionKeyword, 'taunt' | 'rush' | 'bubble' | 'poisonous' | 'stealth'>];
  delete minion.spellPower;
  delete minion.frozen;
  minion.silenced = true;
  // Wer nur dank seiner Fähigkeit sofort angreifen durfte, muss warten.
  if (minion.justPlayed) minion.canAttack = false;
  refreshStats(minion);
  minion.damage = Math.max(0, minion.maxHealth - Math.min(health, minion.maxHealth));
  refreshStats(minion);
  events.push({ type: 'minionSilenced', minionId: minion.id, attack: minion.attack, health: minion.health, maxHealth: minion.maxHealth });
}

/** Rüstung fängt Schaden zuerst ab; zurück kommt, was die Leben trifft. */
function absorb(player: PlayerState, amount: number): number {
  const blocked = Math.min(player.armor ?? 0, amount);
  player.armor = (player.armor ?? 0) - blocked;
  player.health -= amount - blocked;
  return amount - blocked;
}

export function damageHero(player: PlayerState, amount: number, events: GameEvent[]): void {
  const lost = absorb(player, amount);
  events.push({ type: 'damage', targetType: 'hero', targetSeat: player.seat, amount, lost, armor: player.armor, health: player.health });
}

/** Heilt höchstens bis zum Maximum; das Ereignis nennt die wirklich geheilte Menge. */
function healHero(player: PlayerState, amount: number, events: GameEvent[]): void {
  const healed = Math.min(player.maxHealth, player.health + amount) - player.health;
  if (healed <= 0) return;
  player.health += healed;
  events.push({ type: 'heroHealed', seat: player.seat, amount: healed, health: player.health });
}

function healMinion(minion: Minion, amount: number | 'full', events: GameEvent[]): void {
  const healed = amount === 'full' ? minion.damage : Math.min(amount, minion.damage);
  if (healed <= 0) return;
  minion.damage -= healed;
  refreshStats(minion);
  events.push({ type: 'heal', targetType: 'minion', targetId: minion.id, amount: healed, health: minion.health });
}

export function drawCard(player: PlayerState, events: GameEvent[]): void {
  if (player.deck.length === 0) {
    player.fatigue++;
    absorb(player, player.fatigue);
    events.push({ type: 'fatigue', seat: player.seat, damage: player.fatigue, armor: player.armor, health: player.health });
    return;
  }
  const card = player.deck.shift()!;
  if (player.hand.length >= HAND_LIMIT) {
    events.push({ type: 'cardBurned', seat: player.seat, card });
  } else {
    player.hand.push(card);
    events.push({ type: 'cardDrawn', seat: player.seat, card });
  }
}

type Resolved = { kind: 'minion'; minion: Minion } | { kind: 'hero'; player: PlayerState };

function resolve(state: DrachenspielState, frame: QueuedEffect, selector: Selector): Resolved[] {
  const own = state.players[frame.seat];
  const enemy = state.players[1 - frame.seat]!;
  switch (selector.pick) {
    case 'self': {
      const minion = [...own.board, ...enemy.board].find((m) => m.id === frame.sourceId);
      return minion ? [{ kind: 'minion', minion }] : [];
    }
    case 'chosen': {
      const target = frame.target;
      if (!target) return [];
      if (target.kind === 'hero') return [{ kind: 'hero', player: enemy }];
      const minion = [...own.board, ...enemy.board].find((m) => m.id === target.id);
      return minion ? [{ kind: 'minion', minion }] : [];
    }
    case 'hero':
      return [{ kind: 'hero', player: selector.side === 'own' ? own : enemy }];
    case 'allMinions':
      return (selector.side === 'own' ? own : enemy).board
        .filter((m) => !(selector.exceptSelf && m.id === frame.sourceId))
        .map((minion) => ({ kind: 'minion' as const, minion }));
  }
}

function summon(state: DrachenspielState, cardId: string, seat: SeatId, events: GameEvent[]): void {
  const def = CARDS_DB[cardId];
  const player = state.players[seat];
  if (!def) return;
  if (player.board.length >= BOARD_LIMIT) {
    events.push({ type: 'boardFull', seat, cardId });
    return;
  }
  const minion = createMinion(state, def, seat);
  player.board.push(minion);
  events.push({ type: 'minionSummoned', seat, minion });
}

function addEnchantment(state: DrachenspielState, minion: Minion, source: string, change: Pick<Enchantment, 'attack' | 'health'>): void {
  // Reines JSON: Nicht gesetzte Werte dürfen nicht als `undefined` im Spielstand landen.
  minion.enchantments.push({
    id: `e_${state.nextEntityId++}`,
    source,
    ...(change.attack ? { attack: change.attack } : {}),
    ...(change.health ? { health: change.health } : {}),
  });
  refreshStats(minion);
}

function returnToHand(state: DrachenspielState, minion: Minion, events: GameEvent[]): void {
  const owner = state.players.find((p) => p.board.some((m) => m.id === minion.id));
  if (!owner) return;
  owner.board = owner.board.filter((m) => m.id !== minion.id);
  events.push({ type: 'minionReturned', minionId: minion.id, name: minion.name, seat: owner.seat });
  // Spielsteine und volle Hände: Das Tier ist einfach weg.
  if (!CARDS_DB[minion.cardId]?.token && owner.hand.length < HAND_LIMIT) {
    owner.hand.push({ uid: `c_${state.nextEntityId++}`, defId: minion.cardId });
  }
}

function pick3<T>(state: DrachenspielState, items: T[]): T[] {
  const rng = new Rng(state.rng);
  const picked = rng.shuffle([...items]).slice(0, 3);
  state.rng = rng.state;
  return picked;
}

function offerChoice(state: DrachenspielState, frame: QueuedEffect, options: ChoiceOption[], events: GameEvent[]): void {
  state.pending = { seat: frame.seat, options, sourceCard: frame.sourceCard, sourceId: frame.sourceId, target: frame.target };
  events.push({ type: 'choiceOffered', seat: frame.seat });
}

/** Führt die gewählte Möglichkeit vor allem anderen aus, was noch wartet. */
export function resolveChoice(state: DrachenspielState, index: number, events: GameEvent[]): void {
  const pending = state.pending;
  const option = pending?.options[index];
  if (!pending || !option) throw new Error('Keine solche Wahl');
  delete state.pending;
  state.queue.unshift(...option.effects.map((effect) => ({ effect, seat: pending.seat, sourceCard: pending.sourceCard, sourceId: pending.sourceId, target: pending.target })));
  settle(state, events);
}

function runEffect(state: DrachenspielState, frame: QueuedEffect, events: GameEvent[]): void {
  const effect: Effect = frame.effect;
  const player = state.players[frame.seat];
  switch (effect.kind) {
    case 'damage': {
      // Naturkraft zählt nur bei Zaubern.
      const bonus = CARDS_DB[frame.sourceCard]?.isSpell ? player.board.reduce((sum, m) => sum + (m.spellPower ?? 0), 0) : 0;
      for (const target of resolve(state, frame, effect.to)) {
        if (target.kind === 'hero') damageHero(target.player, effect.amount + bonus, events);
        else damageMinion(target.minion, effect.amount + bonus, false, events);
      }
      break;
    }
    case 'freeze':
      for (const target of resolve(state, frame, effect.to)) {
        if (target.kind === 'minion' && !target.minion.immune) freezeMinion(target.minion, events);
      }
      break;
    case 'silence':
      for (const target of resolve(state, frame, effect.to)) {
        if (target.kind === 'minion') silenceMinion(target.minion, events);
      }
      break;
    case 'addToHand': {
      if (player.hand.length >= HAND_LIMIT) {
        events.push({ type: 'handFull', seat: frame.seat, cardId: effect.cardId });
        break;
      }
      const card: CardInstance = { uid: `c_${state.nextEntityId++}`, defId: effect.cardId, ...(effect.fleeting ? { fleeting: true } : {}) };
      player.hand.push(card);
      events.push({ type: 'cardDrawn', seat: frame.seat, card });
      break;
    }
    case 'discover': {
      const pool = Object.values(CARDS_DB).filter((def) => !def.token && !def.singleCopy && def.id !== 'special_star' && Boolean(def.isSpell) === (effect.pool === 'spell'));
      offerChoice(state, frame, pick3(state, pool).map((def) => ({ label: def.name, emoji: def.emoji, cardId: def.id, effects: [{ kind: 'addToHand', cardId: def.id }] })), events);
      break;
    }
    case 'chooseOne':
      offerChoice(state, frame, effect.options, events);
      break;
    case 'adapt':
      // Ist das Tier schon weg, gibt es nichts mehr anzupassen.
      if (resolve(state, frame, { pick: 'self' }).length > 0) offerChoice(state, frame, pick3(state, ADAPTATIONS), events);
      break;
    case 'rebirth': {
      const def = CARDS_DB[effect.cardId];
      if (!def) break;
      if (player.board.length >= BOARD_LIMIT) {
        events.push({ type: 'boardFull', seat: frame.seat, cardId: effect.cardId });
        break;
      }
      const minion = createMinion(state, def, frame.seat);
      delete minion.reborn;
      minion.damage = minion.maxHealth - 1;
      refreshStats(minion);
      player.board.push(minion);
      events.push({ type: 'minionSummoned', seat: frame.seat, minion });
      break;
    }
    case 'heal':
      for (const target of resolve(state, frame, effect.to)) {
        if (target.kind === 'minion') healMinion(target.minion, effect.amount, events);
        else if (effect.amount !== 'full') healHero(target.player, effect.amount, events);
      }
      break;
    case 'buff':
      for (const target of resolve(state, frame, effect.to)) {
        if (target.kind !== 'minion') continue;
        addEnchantment(state, target.minion, frame.sourceCard, { attack: effect.attack, health: effect.health });
        events.push({ type: 'minionBuffed', minionId: target.minion.id, attack: target.minion.attack, health: target.minion.health });
      }
      break;
    case 'grantKeyword':
      for (const target of resolve(state, frame, effect.to)) {
        if (target.kind !== 'minion') continue;
        target.minion[effect.keyword] = true;
        // Flink und Sprinter als Geschenk: Das Tier darf sofort los.
        if (effect.keyword === 'rush' || effect.keyword === 'sprinter') target.minion.canAttack = true;
        events.push({ type: 'minionBuffed', minionId: target.minion.id, [effect.keyword]: true });
      }
      break;
    case 'ready':
      for (const target of resolve(state, frame, effect.to)) {
        if (target.kind === 'minion' && !target.minion.hasAttacked) target.minion.canAttack = true;
      }
      break;
    case 'draw':
      for (let i = 0; i < effect.count; i++) drawCard(player, events);
      break;
    case 'summon':
      for (let i = 0; i < (effect.count ?? 1); i++) summon(state, effect.cardId, frame.seat, events);
      break;
    case 'returnToHand':
      for (const target of resolve(state, frame, effect.to)) {
        if (target.kind === 'minion') returnToHand(state, target.minion, events);
      }
      break;
    case 'mana':
      // Darf über die Grenze gehen: Die Sternschnuppe gibt auch bei 10 Kristallen eine elfte Einheit.
      player.mana += effect.amount;
      break;
    case 'armor':
      player.armor += effect.amount;
      events.push({ type: 'armorGained', seat: frame.seat, amount: effect.amount, armor: player.armor });
      break;
    case 'heroAttack':
      player.heroAttackBonus += effect.amount;
      events.push({ type: 'heroAttackGained', seat: frame.seat, amount: effect.amount });
      break;
    case 'equip':
      player.gear = { ...effect.gear };
      events.push({ type: 'gearEquipped', seat: frame.seat, gear: player.gear });
      break;
    case 'summonRandom': {
      const rng = new Rng(state.rng);
      const cardId = rng.pick(effect.cardIds);
      state.rng = rng.state;
      summon(state, cardId, frame.seat, events);
      break;
    }
  }
}

export function enqueue(state: DrachenspielState, effects: Effect[] | undefined, seat: SeatId, sourceCard: string, sourceId: string | null, target: SpellTarget | null): void {
  for (const effect of effects ?? []) state.queue.push({ effect, seat, sourceCard, sourceId, target });
}

function triggered(cardId: string, on: 'played' | 'death', holds: (condition: 'combo' | 'outcast') => boolean = () => false): Effect[] {
  return (CARDS_DB[cardId]?.triggers ?? []).filter((t) => t.on === on && (!t.if || holds(t.if))).flatMap((t) => t.do);
}

/** `combo` und `outcast` werden beim Ausspielen geprüft, bevor die Karte mitzählt oder die Hand verlässt. */
export function enqueuePlayed(state: DrachenspielState, minion: Minion, seat: SeatId, target: SpellTarget | null, conditions: { combo: boolean; outcast: boolean }): void {
  enqueue(state, triggered(minion.cardId, 'played', (condition) => conditions[condition]), seat, minion.cardId, minion.id, target);
}

/** Alle Figuren ohne Leben gehen gleichzeitig vom Feld; Abschiede folgen in Spielreihenfolge. */
function deathPhase(state: DrachenspielState, events: GameEvent[]): boolean {
  const dead = state.players
    .flatMap((p) => p.board.filter((m) => m.health <= 0).map((minion) => ({ minion, seat: p.seat })))
    .sort((a, b) => a.minion.playOrder - b.minion.playOrder);
  if (dead.length === 0) return false;
  for (const p of state.players) p.board = p.board.filter((m) => m.health > 0);
  for (const { minion, seat } of dead) {
    events.push({ type: 'minionLeft', minionId: minion.id, name: minion.name });
    if (!minion.silenced) enqueue(state, triggered(minion.cardId, 'death'), seat, minion.cardId, null, null);
    if (minion.reborn) enqueue(state, [{ kind: 'rebirth', cardId: minion.cardId }], seat, minion.cardId, null, null);
  }
  return true;
}

export function isOverTurnLimit(state: DrachenspielState): boolean {
  return state.turn > MAX_TURNS;
}

function checkGameOver(state: DrachenspielState, events: GameEvent[]): void {
  const p0Dead = state.players[0].health <= 0;
  const p1Dead = state.players[1].health <= 0;
  const timeUp = isOverTurnLimit(state);
  if (p0Dead || p1Dead || timeUp) {
    state.phase = 'ended';
    events.push({ type: 'gameOver', winner: p0Dead === p1Dead ? undefined : p0Dead ? 1 : 0 });
  }
}

/** Arbeitet die Warteschlange ab, dann Tod bis zur Ruhe; der Sieg wird nur hier geprüft. */
export function settle(state: DrachenspielState, events: GameEvent[]): void {
  let steps = 0;
  do {
    while (state.queue.length > 0) {
      // Eine offene Wahl hält alles an, `resolveChoice` macht danach weiter.
      if (state.pending) return;
      if (++steps > MAX_QUEUE_STEPS) {
        state.queue = [];
        break;
      }
      runEffect(state, state.queue.shift()!, events);
    }
    if (state.pending) return;
  } while (deathPhase(state, events) || state.queue.length > 0);
  checkGameOver(state, events);
}
