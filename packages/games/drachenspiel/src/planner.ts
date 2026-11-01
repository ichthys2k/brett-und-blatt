import type { SeatId } from '@brett-und-blatt/engine';
import { CARDS_DB } from './cards';
import { applyMove, evaluate, legalMoves } from './rules';
import type { DrachenspielMove, DrachenspielState, Effect, Minion, PlayerState } from './types';

/** Wie gründlich eine Stufe plant. */
export interface PlanSettings {
  /** Zwischenstellungen, die je Schritt weiterverfolgt werden. */
  beam: number;
  /** Höchstzahl der Aktionen in einem Zug. */
  depth: number;
  /** So viele beste Pläne werden gegen eine Antwort des Gegners geprüft; 0 = keine Antwort. */
  replies: number;
  value: (state: DrachenspielState, seat: SeatId) => number;
}

const WIN = 10_000;
const REPLY_STEPS = 10;

/** Was ein Abschied wert ist: aus den Kartendaten abgeleitet, neue Karten brauchen keinen Eintrag. */
function effectValue(effect: Effect): number {
  switch (effect.kind) {
    case 'summon': {
      const def = CARDS_DB[effect.cardId];
      return def ? (effect.count ?? 1) * (def.attack * 1.4 + def.health) : 0;
    }
    case 'draw':
      return effect.count * 2.2;
    case 'damage':
      return effect.amount * (effect.to.pick === 'allMinions' ? 1.5 : 1);
    case 'heal':
      return effect.amount === 'full' ? 3 : effect.amount * 0.5;
    case 'buff':
      return (effect.attack ?? 0) + (effect.health ?? 0);
    case 'grantKeyword':
      return 1.5;
    case 'mana':
    case 'armor':
    case 'heroAttack':
      return effect.amount;
    case 'equip':
      return effect.gear.attack * effect.gear.durability;
    case 'summonRandom':
      return 2.5;
    case 'ready':
    case 'returnToHand':
      return 1;
  }
}

function minionValue(minion: Minion): number {
  let value = minion.attack * 1.4 + minion.health;
  if (minion.taunt) value += 1.5;
  if (minion.bubble) value += 1 + minion.attack * 0.5;
  if (minion.poisonous && minion.attack > 0) value += 3;
  if (minion.stealth) value += 1;
  for (const trigger of CARDS_DB[minion.cardId]?.triggers ?? []) {
    if (trigger.on === 'death') value += trigger.do.reduce((sum, effect) => sum + effectValue(effect), 0) * 0.7;
  }
  return value;
}

/** Leben zählen mehr, je weniger davon übrig sind. */
function heroValue(health: number): number {
  return health * 1.2 + Math.min(0, health - 12) * 0.8;
}

function gearValue(player: PlayerState): number {
  return player.gear ? player.gear.attack * player.gear.durability * 1.2 : 0;
}

/** Was im nächsten Zug den Helden erreichen kann: Beschützer fangen je einen Angreifer ab. */
function reachingDamage(attackers: Minion[], defenders: Minion[]): number {
  const guards = defenders.filter((m) => m.taunt && !m.stealth).length;
  const attacks = attackers.map((m) => m.attack).sort((a, b) => b - a);
  return attacks.slice(guards).reduce((sum, attack) => sum + attack, 0);
}

/** Bewertung für den Planer der Stufe „schwer“. */
export function positionValue(state: DrachenspielState, seat: SeatId): number {
  const me = state.players[seat];
  const opp = state.players[1 - seat]!;
  if (opp.health <= 0 && me.health > 0) return WIN;
  if (me.health <= 0) return -WIN;

  let score = heroValue(me.health) + me.armor - heroValue(opp.health) - opp.armor;
  score += gearValue(me) - gearValue(opp);
  score += (me.hand.length - opp.hand.length) * 2.2;
  for (const minion of me.board) score += minionValue(minion);
  for (const minion of opp.board) score -= minionValue(minion);

  if (reachingDamage(opp.board, me.board) + (opp.gear?.attack ?? 0) >= me.health + me.armor) score -= 40;
  if (reachingDamage(me.board, opp.board) + (me.gear?.attack ?? 0) >= opp.health + opp.armor) score += 15;
  // Ungenutztes Mana ist im eigenen Zug verschenkt.
  if (state.activeSeat === seat) score -= me.mana * 0.5;
  return score;
}

interface Node {
  state: DrachenspielState;
  first: DrachenspielMove | null;
  value: number;
}

/** Tauschen zwei Angriffe nur die Reihenfolge, entsteht dieselbe Stellung: Sie wird nur einmal verfolgt. */
function positionKey(state: DrachenspielState): string {
  const sides = state.players.map((p) => {
    const board = p.board.map((m) => `${m.id}:${m.attack}:${m.health}:${m.hasAttacked ? 1 : 0}:${m.bubble ? 1 : 0}`);
    const hero = `${p.armor}:${p.gear?.durability ?? 0}:${p.heroAttackBonus}:${p.heroAttacked ? 1 : 0}:${p.powerUsed ? 1 : 0}`;
    return `${p.health}|${hero}|${p.mana}|${p.hand.map((c) => c.uid).join()}|${board.join()}`;
  });
  return sides.join('/');
}

/** Spielt für den Gegner nach dem Zugende einen einfachen Zug durch und bewertet das Ergebnis. */
function afterReply(start: DrachenspielState, seat: SeatId, value: PlanSettings['value']): number {
  const opp = (1 - seat) as SeatId;
  // Ein Plan kann die Partie schon beenden, etwa wenn der Held am Gegenschlag fällt.
  if (start.phase !== 'play') return value(start, seat);
  let state = applyMove(start, seat, { type: 'endTurn' }).state;
  if (state.phase !== 'play') return value(state, seat);
  for (let step = 0; step < REPLY_STEPS; step++) {
    let best: DrachenspielState | null = null;
    let bestScore = value(state, opp);
    for (const move of legalMoves(state, opp)) {
      if (move.type === 'endTurn') continue;
      const child = applyMove(state, opp, move).state;
      const score = value(child, opp);
      if (score > bestScore) {
        best = child;
        bestScore = score;
      }
    }
    if (!best) break;
    state = best;
    if (state.phase !== 'play') break;
  }
  return value(state, seat);
}

/**
 * Strahlsuche über den ganzen eigenen Zug. Liefert je möglichem ersten Zug den besten Wert,
 * den ein Plan damit erreicht. `outOfTime` beendet die Suche vorzeitig mit dem bisherigen Stand.
 */
export function planTurn(
  root: DrachenspielState,
  seat: SeatId,
  settings: PlanSettings,
  outOfTime: () => boolean,
): Map<string, { move: DrachenspielMove; value: number }> {
  const endTurn: DrachenspielMove = { type: 'endTurn' };
  const plans: Node[] = [{ state: root, first: endTurn, value: settings.value(root, seat) }];
  let frontier: Node[] = [{ state: root, first: null, value: 0 }];
  const seen = new Set<string>();

  for (let depth = 0; depth < settings.depth && frontier.length > 0; depth++) {
    const children: Node[] = [];
    for (const node of frontier) {
      for (const move of legalMoves(node.state, seat)) {
        if (move.type === 'endTurn') continue;
        if (depth > 0 && outOfTime()) break;
        const state = applyMove(node.state, seat, move).state;
        const key = positionKey(state);
        if (seen.has(key)) continue;
        seen.add(key);
        children.push({ state, first: node.first ?? move, value: settings.value(state, seat) });
      }
    }
    children.sort((a, b) => b.value - a.value);
    frontier = children.slice(0, settings.beam);
    plans.push(...frontier);
    if (frontier[0] && frontier[0].value >= WIN) break;
  }

  plans.sort((a, b) => b.value - a.value);
  if (settings.replies > 0 && plans[0]!.value < WIN) {
    for (const plan of plans.slice(0, settings.replies)) {
      if (outOfTime()) break;
      plan.value = afterReply(plan.state, seat, settings.value);
    }
    // Ungeprüfte Pläne dürfen geprüfte nicht überholen, nur weil niemand auf sie geantwortet hat.
    for (const plan of plans.slice(settings.replies)) plan.value = -Infinity;
  }

  const byFirst = new Map<string, { move: DrachenspielMove; value: number }>();
  for (const plan of plans) {
    const key = JSON.stringify(plan.first);
    const known = byFirst.get(key);
    if (!known || plan.value > known.value) byFirst.set(key, { move: plan.first!, value: plan.value });
  }
  return byFirst;
}

export const MEDIUM_PLAN: PlanSettings = { beam: 4, depth: 8, replies: 0, value: evaluate };
export const HARD_PLAN: PlanSettings = { beam: 12, depth: 12, replies: 5, value: positionValue };
