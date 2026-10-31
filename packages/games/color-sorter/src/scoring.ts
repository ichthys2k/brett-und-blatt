import type { Rng } from '@brett-und-blatt/engine';
import { BOSSES } from './content';
import { detectHand, HAND_TYPES, handBase, hasColor, isFace, rankChips } from './cards';
import { modDef, SOLO_TABLE, type Effect, type HandContext, type TableInfo } from './mods';
import type { Card, HandType, ModInstance, RunState } from './types';

/** Ein Schritt der Wertung – die Oberfläche spielt sie nacheinander ab. */
export interface ScoreStep {
  src: 'hand' | 'card' | 'held' | 'mod';
  /** Karten-id bzw. Mod-uid. */
  id?: number;
  chips?: number;
  mult?: number;
  xmult?: number;
  tokens?: number;
  debuffed?: boolean;
  /** Stand nach dem Schritt. */
  total: { chips: number; mult: number };
}

export interface ScoreResult {
  type: HandType;
  /** ids der gewerteten Karten. */
  scoringIds: number[];
  chips: number;
  mult: number;
  score: number;
  tokens: number;
  steps: ScoreStep[];
  /** Blondierte Karten, die sich aufgelöst haben. */
  broken: number[];
  mods: ModInstance[];
  /** Dauerhafte Chip-Boni (Wanderer) je Karten-id. */
  bonus: Record<number, number>;
}

/** Zählt eine Karte in dieser Runde nicht (Boss)? */
export function isDebuffed(card: Card, run: RunState): boolean {
  const round = run.current;
  if (!round) return false;
  if (round.silenced) return true;
  const boss = round.boss ? BOSSES[round.boss] : undefined;
  if (!boss) return false;
  if (boss.debuffColor && card.enh !== 'granite' && card.enh !== 'ombre' && card.color === boss.debuffColor) return true;
  if (boss.key === 'guardian' && card.enh !== 'granite' && isFace(card.rank)) return true;
  if (boss.key === 'golem' && run.playedThisLevel.includes(card.id)) return true;
  return false;
}

/** Meistgespielte Kombi (für den Drachen); bei Gleichstand die stärkere. */
export function favoriteHand(run: RunState): HandType | null {
  let best: HandType | null = null;
  for (const [type, count] of Object.entries(run.handPlays) as [HandType, number][]) {
    if (count > 0 && (best === null || count >= run.handPlays[best])) best = type;
  }
  return best;
}

/**
 * Wertet eine gespielte Hand: Grundwert der Kombi, dann jede gewertete Karte,
 * dann die Karten in der Hand, dann die Mods von links nach rechts.
 */
export function scoreHand(run: RunState, played: Card[], held: Card[], rng: Rng, table: TableInfo = SOLO_TABLE): ScoreResult {
  const detected = detectHand(
    played,
    run.mods.some((m) => m.key === 'unicorn' && !m.spent),
  );
  const type = detected.type;
  const scoring = detected.scoring.map((i) => played[i]!);
  const boss = run.current?.boss ? BOSSES[run.current.boss] : undefined;
  // Lügenbaron: Grundwert der nächsthöheren Kombi (mit deren Stufe).
  const boast = run.mods.some((m) => !m.spent && modDef(m.key).boastful);
  const baseType = boast ? (HAND_TYPES[Math.min(HAND_TYPES.length - 1, HAND_TYPES.indexOf(type) + 1)] ?? type) : type;
  const base = handBase(baseType, run.handLevels[baseType]);
  let chips = base.chips;
  let mult = base.mult;
  if (boss?.key === 'ape') {
    chips = Math.floor(chips / 2);
    mult = Math.max(1, Math.floor(mult / 2));
  }
  let tokens = 0;
  const steps: ScoreStep[] = [{ src: 'hand', chips, mult, total: { chips, mult } }];
  const mods = run.mods.map((m) => ({ ...m }));
  const active = mods.filter((m) => !m.spent);
  const ctx: HandContext = {
    run,
    played,
    scoring,
    held,
    type,
    random: () => rng.next(),
    table,
  };
  const bonus: Record<number, number> = {};
  const broken: number[] = [];

  const apply = (src: ScoreStep['src'], id: number | undefined, effect: Effect | null) => {
    if (!effect) return;
    if (effect.chips) chips += effect.chips;
    if (effect.mult) mult += effect.mult;
    if (effect.xmult !== undefined) mult *= effect.xmult;
    if (effect.tokens) tokens += effect.tokens;
    if (!effect.chips && !effect.mult && effect.xmult === undefined && !effect.tokens) return;
    steps.push({ src, id, ...effect, total: { chips, mult } });
  };

  for (const card of scoring) {
    // Merkenau, die Krähe: Die erste gewertete Karte zählt nicht.
    if (isDebuffed(card, run) || (boss?.key === 'crow' && card === scoring[0])) {
      steps.push({
        src: 'card',
        id: card.id,
        debuffed: true,
        total: { chips, mult },
      });
      continue;
    }
    let triggers = 1 + (card.seal === 'red' ? 1 : 0);
    for (const mod of active) triggers += modDef(mod.key).retrigger?.(card, ctx) ?? 0;
    for (let t = 0; t < triggers; t++) {
      apply('card', card.id, {
        chips: boss?.key === 'iceQueen' ? 0 : card.enh === 'granite' ? 50 : rankChips(card.rank) + (card.bonus ?? 0),
      });
      if (card.enh === 'volume') apply('card', card.id, { chips: 30 });
      if (card.enh === 'gloss') apply('card', card.id, { mult: 4 });
      if (card.enh === 'blond') apply('card', card.id, { xmult: 2 });
      if (card.enh === 'star') {
        if (rng.chance(1 / 5)) apply('card', card.id, { mult: 20 });
        if (rng.chance(1 / 15)) apply('card', card.id, { tokens: 20 });
      }
      if (card.foil === 'hot') apply('card', card.id, { chips: 50 });
      if (card.foil === 'holo') apply('card', card.id, { mult: 10 });
      if (card.foil === 'iris') apply('card', card.id, { xmult: 1.5 });
      if (card.seal === 'gold') apply('card', card.id, { tokens: 3 });
      if (boss?.key === 'ratKing') apply('card', card.id, { tokens: -1 });
      for (const mod of active) apply('card', card.id, modDef(mod.key).onCard?.(card, ctx, mod) ?? null);
    }
    if (card.enh === 'blond' && rng.chance(1 / 4)) broken.push(card.id);
  }

  for (const card of held) {
    if (isDebuffed(card, run)) continue;
    const triggers = 1 + (card.seal === 'red' ? 1 : 0);
    for (let t = 0; t < triggers; t++) {
      if (card.enh === 'keratin') apply('held', card.id, { xmult: 1.5 });
      for (const mod of active) apply('held', card.id, modDef(mod.key).onHeld?.(card, ctx, mod) ?? null);
    }
  }

  for (const mod of active) {
    if (mod.foil === 'hot') apply('mod', mod.uid, { chips: 50 });
    if (mod.foil === 'holo') apply('mod', mod.uid, { mult: 10 });
    apply('mod', mod.uid, modDef(mod.key).onHand?.(ctx, mod) ?? null);
    if (mod.foil === 'iris') apply('mod', mod.uid, { xmult: 1.5 });
  }

  // Zähler fortschreiben (Eiswaffel schmilzt, Busfahrt zählt weiter …).
  const after: ModInstance[] = [];
  for (const mod of mods) {
    const def = modDef(mod.key);
    if (mod.spent || !def.afterHand) {
      after.push(mod);
      continue;
    }
    const next = def.afterHand(mod, ctx);
    if (next) after.push(next);
  }

  mult = Math.round(mult * 100) / 100;
  let score = Math.floor(chips * mult);
  if (boss?.key === 'dragon' && favoriteHand(run) === type) score = 0;
  // Abt Esel: mehr als drei Karten bringen nichts; Kämmerer Faultier: erste Vorführung halb.
  if (boss?.key === 'donkey' && played.length > 3) score = 0;
  if (boss?.key === 'sloth' && run.current && !run.current.firstDone) score = Math.floor(score / 2);
  return {
    type,
    scoringIds: scoring.map((c) => c.id),
    chips,
    mult,
    score,
    tokens,
    steps,
    broken,
    mods: after,
    bonus,
  };
}

/** Schnelle Schätzung ohne Zufall (für Bots und die Vorschau). */
export function previewHand(run: RunState, played: Card[], held: Card[], table: TableInfo = SOLO_TABLE): { type: HandType; score: number; chips: number; mult: number } {
  const fixed = { next: () => 0.5, chance: () => false } as unknown as Rng;
  const result = scoreHand(run, played, held, fixed, table);
  return {
    type: result.type,
    score: result.score,
    chips: result.chips,
    mult: result.mult,
  };
}

export { hasColor };
