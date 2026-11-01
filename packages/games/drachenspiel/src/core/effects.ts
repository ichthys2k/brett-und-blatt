import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { CARDS_DB } from '../cards';
import type { CardDefinition, DrachenspielState, Effect, Enchantment, Minion, PlayerState, QueuedEffect, Selector, SpellTarget } from '../types';

export const HAND_LIMIT = 7;
export const BOARD_LIMIT = 7;
export const MAX_MANA = 10;
/** Nach so vielen Zügen endet die Partie unentschieden, damit sie nie endlos läuft. */
export const MAX_TURNS = 89;
/** Grenze gegen Endlosketten aus Effekten und Abschieden je Aktion. */
const MAX_QUEUE_STEPS = 200;

/** Berechnet die Werte einer Figur aus Grundwerten, Veränderungen und Schaden neu. */
export function refreshStats(minion: Minion): void {
  minion.attack = minion.enchantments.reduce((sum, e) => sum + (e.attack ?? 0), minion.baseAttack);
  minion.maxHealth = minion.enchantments.reduce((sum, e) => sum + (e.health ?? 0), minion.baseHealth);
  minion.health = minion.maxHealth - minion.damage;
}

export function createMinion(state: DrachenspielState, def: CardDefinition, owner: SeatId): Minion {
  const has = (keyword: 'taunt' | 'rush' | 'bubble' | 'poisonous' | 'stealth') => def.keywords?.includes(keyword) ?? false;
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
    canAttack: has('rush'),
    hasAttacked: false,
  };
}

export function damageMinion(minion: Minion, amount: number, isPoisonous: boolean, events: GameEvent[]): void {
  if (amount <= 0) return;
  if (minion.bubble) {
    minion.bubble = false;
    events.push({ type: 'bubblePopped', minionId: minion.id });
    return;
  }
  minion.damage = isPoisonous ? Math.max(minion.damage + amount, minion.maxHealth) : minion.damage + amount;
  refreshStats(minion);
  events.push({ type: 'damage', targetType: 'minion', targetId: minion.id, amount, health: minion.health });
}

export function damageHero(player: PlayerState, amount: number, events: GameEvent[]): void {
  player.health -= amount;
  events.push({ type: 'damage', targetType: 'hero', targetSeat: player.seat, amount, health: player.health });
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
    player.health -= player.fatigue;
    events.push({ type: 'fatigue', seat: player.seat, damage: player.fatigue, health: player.health });
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

function runEffect(state: DrachenspielState, frame: QueuedEffect, events: GameEvent[]): void {
  const effect: Effect = frame.effect;
  const player = state.players[frame.seat];
  switch (effect.kind) {
    case 'damage':
      for (const target of resolve(state, frame, effect.to)) {
        if (target.kind === 'hero') damageHero(target.player, effect.amount, events);
        else damageMinion(target.minion, effect.amount, false, events);
      }
      break;
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
      player.mana = Math.min(MAX_MANA, player.mana + effect.amount);
      break;
  }
}

export function enqueue(state: DrachenspielState, effects: Effect[] | undefined, seat: SeatId, sourceCard: string, sourceId: string | null, target: SpellTarget | null): void {
  for (const effect of effects ?? []) state.queue.push({ effect, seat, sourceCard, sourceId, target });
}

function triggered(cardId: string, on: 'played' | 'death'): Effect[] {
  return (CARDS_DB[cardId]?.triggers ?? []).filter((t) => t.on === on).flatMap((t) => t.do);
}

export function enqueuePlayed(state: DrachenspielState, minion: Minion, seat: SeatId): void {
  enqueue(state, triggered(minion.cardId, 'played'), seat, minion.cardId, minion.id, null);
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
    enqueue(state, triggered(minion.cardId, 'death'), seat, minion.cardId, null, null);
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
      if (++steps > MAX_QUEUE_STEPS) {
        state.queue = [];
        break;
      }
      runEffect(state, state.queue.shift()!, events);
    }
  } while (deathPhase(state, events) || state.queue.length > 0);
  checkGameOver(state, events);
}
