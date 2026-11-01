import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import { CARDS_DB } from '../cards';
import { HOUSE_POWERS } from '../powers';
import type { CardInstance, DeckThemeId, DrachenspielView, Gear, Minion, SpellTarget } from '../types';

/** Eine aufsteigende Anzeige über einem Tier oder Helden. Schlüssel: Tier-Kennung oder `hero-<Platz>`. */
export interface Float {
  target: string;
  text: string;
  kind: 'damage' | 'heal' | 'fx';
}

export interface ShownMinion {
  minion: Minion;
  dying: boolean;
  /** Erscheint in diesem Schritt neu. */
  fresh: boolean;
}

/** Ein Schritt der Animationsreihe: So sieht das Feld währenddessen aus. */
export interface Beat {
  durationMs: number;
  boards: [ShownMinion[], ShownMinion[]];
  heroes: [number, number];
  armor: [number, number];
  floats: Float[];
  attack: { attackerId: string; target: string } | null;
  impacted: string[];
  log: string[];
  notices: string[];
  /** Tierstimmen, die zu Beginn des Schritts erklingen. */
  calls: Array<{ name: string; kind: 'play' | 'attack' | 'death'; sound?: string | null }>;
}

type Category = 'quiet' | 'lunge' | 'hit' | 'death' | 'enter' | 'change';

const DURATION: Record<Category, number> = { quiet: 0, lunge: 560, hit: 340, death: 400, enter: 300, change: 280 };
/** Lange Ketten laufen schneller, damit der Gegner nicht ewig zuschauen muss. */
const LONGEST_RUN_MS = 2200;
const REDUCED_MOTION_FACTOR = 0.4;

const CATEGORY: Record<string, Category> = {
  attack: 'lunge',
  heroAttack: 'lunge',
  damage: 'hit',
  bubblePopped: 'hit',
  damageBlocked: 'hit',
  fatigue: 'hit',
  heal: 'change',
  heroHealed: 'change',
  armorGained: 'change',
  heroAttackGained: 'change',
  gearEquipped: 'change',
  gearBroken: 'change',
  minionBuffed: 'change',
  minionFrozen: 'change',
  minionSilenced: 'change',
  minionLeft: 'death',
  minionReturned: 'change',
  cardPlayed: 'enter',
  spellCast: 'enter',
  heroPowerUsed: 'enter',
  minionSummoned: 'enter',
};

function freshBeat(previous: Beat | null, before: DrachenspielView): Beat {
  const fromBoard = (seat: 0 | 1) =>
    previous
      ? previous.boards[seat].filter((s) => !s.dying).map((s) => ({ ...s, fresh: false }))
      : before.players[seat].board.map((minion) => ({ minion, dying: false, fresh: false }));
  return {
    durationMs: 0,
    boards: [fromBoard(0), fromBoard(1)],
    heroes: previous ? [...previous.heroes] : [before.players[0].health, before.players[1].health],
    armor: previous ? [...previous.armor] : [before.players[0].armor, before.players[1].armor],
    floats: [],
    attack: null,
    impacted: [],
    log: [],
    notices: [],
    calls: [],
  };
}

function findShown(beat: Beat, id: string): ShownMinion | undefined {
  return beat.boards[0].find((s) => s.minion.id === id) ?? beat.boards[1].find((s) => s.minion.id === id);
}

/**
 * Zerlegt die Ereignisse eines Zugs in nacheinander gezeigte Schritte. Der letzte Schritt muss nicht
 * genau dem Endstand entsprechen: Danach zeigt die Oberfläche wieder die echte Sicht.
 */
export function buildBeats(
  events: GameEvent[],
  before: DrachenspielView,
  nameOf: (seat: SeatId) => string,
  reducedMotion = false,
): Beat[] {
  const beats: Beat[] = [];
  let beat: Beat | null = null;
  let category: Category = 'quiet';
  const names = new Map<string, string>();
  for (const player of before.players) for (const minion of player.board) names.set(minion.id, minion.name);
  const nameOfMinion = (id: string) => names.get(id) ?? 'Tier';

  const open = (next: Category): Beat => {
    // Ein Angriff und sein Treffer gehören in denselben Schritt, ebenso alles Gleichartige einer Kette.
    const merges = beat !== null && (next === 'quiet' || next === category || (category === 'lunge' && next === 'hit') || (category === 'quiet' && beat.durationMs === 0));
    if (merges && beat) {
      if (next !== 'quiet') {
        if (category === 'quiet') category = next;
        beat.durationMs = Math.max(beat.durationMs, DURATION[next]);
      }
      return beat;
    }
    beat = freshBeat(beat, before);
    beat.durationMs = DURATION[next];
    beats.push(beat);
    category = next;
    return beat;
  };

  for (const event of events) {
    const current = open(CATEGORY[event.type] ?? 'quiet');
    switch (event.type) {
      case 'turnStarted': {
        const { seat } = event as unknown as { seat: SeatId };
        current.log.push(`➡️ ${nameOf(seat)} ist am Zug`);
        break;
      }
      case 'cardPlayed': {
        const { seat, card, minion } = event as unknown as { seat: SeatId; card: CardInstance; minion?: Minion };
        const def = CARDS_DB[card.defId];
        current.log.push(`🎴 ${nameOf(seat)} legt ${def?.emoji ?? ''} ${def?.name ?? 'eine Karte'}`);
        if (def && !def.isSpell) current.calls.push({ name: def.name, kind: 'play', sound: def.sound });
        if (minion) {
          names.set(minion.id, minion.name);
          current.boards[seat]!.push({ minion, dying: false, fresh: true });
        }
        break;
      }
      case 'spellCast': {
        const { seat, card, target } = event as unknown as { seat: SeatId; card: CardInstance; target: SpellTarget | null };
        const def = CARDS_DB[card.defId];
        const on = target?.kind === 'minion' ? ` auf ${nameOfMinion(target.id)}` : target?.kind === 'hero' ? ` auf den Helden von ${nameOf((1 - seat) as SeatId)}` : '';
        current.log.push(`✨ ${nameOf(seat)} wirkt ${def?.emoji ?? ''} ${def?.name ?? 'einen Zauber'}${on}`);
        current.floats.push({ target: `hero-${seat}`, text: def?.emoji ?? '✨', kind: 'fx' });
        break;
      }
      case 'attack': {
        const { attackerId, target } = event as unknown as { attackerId: string; target: { kind: 'minion'; id: string } | { kind: 'hero' } };
        const attacker = findShown(current, attackerId);
        const owner = attacker?.minion.owner ?? (0 as SeatId);
        const targetKey = target.kind === 'minion' ? target.id : `hero-${(1 - owner) as SeatId}`;
        current.attack = { attackerId, target: targetKey };
        current.impacted.push(targetKey);
        const victim = target.kind === 'minion' ? nameOfMinion(target.id) : `den Helden von ${nameOf((1 - owner) as SeatId)}`;
        current.log.push(`⚔️ ${nameOfMinion(attackerId)} greift ${victim} an`);
        if (attacker) current.calls.push({ name: attacker.minion.name, kind: 'attack', sound: attacker.minion.sound });
        break;
      }
      case 'heroPowerUsed': {
        const { seat, power } = event as unknown as { seat: SeatId; power: DeckThemeId };
        const def = HOUSE_POWERS[power];
        current.floats.push({ target: `hero-${seat}`, text: def.emoji, kind: 'fx' });
        current.log.push(`${def.emoji} ${nameOf(seat)} nutzt ${def.name}`);
        break;
      }
      case 'heroAttack': {
        const { seat, target } = event as unknown as { seat: SeatId; target: { kind: 'minion'; id: string } | { kind: 'hero' } };
        const targetKey = target.kind === 'minion' ? target.id : `hero-${(1 - seat) as SeatId}`;
        current.attack = { attackerId: `hero-${seat}`, target: targetKey };
        current.impacted.push(targetKey);
        const victim = target.kind === 'minion' ? nameOfMinion(target.id) : `den Helden von ${nameOf((1 - seat) as SeatId)}`;
        current.log.push(`⚔️ ${nameOf(seat)} greift ${victim} an`);
        break;
      }
      case 'armorGained': {
        const { seat, amount, armor } = event as unknown as { seat: SeatId; amount: number; armor: number };
        current.floats.push({ target: `hero-${seat}`, text: `+${amount} 🛡️`, kind: 'fx' });
        current.armor[seat] = armor;
        current.log.push(`🛡️ ${nameOf(seat)} bekommt ${amount} Rüstung`);
        break;
      }
      case 'heroAttackGained': {
        const { seat, amount } = event as unknown as { seat: SeatId; amount: number };
        current.floats.push({ target: `hero-${seat}`, text: `+${amount} ⚔️`, kind: 'fx' });
        current.log.push(`⚔️ ${nameOf(seat)} hat in diesem Zug +${amount} Angriff`);
        break;
      }
      case 'gearEquipped': {
        const { seat, gear } = event as unknown as { seat: SeatId; gear: Gear };
        current.floats.push({ target: `hero-${seat}`, text: gear.emoji, kind: 'fx' });
        current.log.push(`${gear.emoji} ${nameOf(seat)} rüstet sich mit Rüstzeug: ${gear.name}`);
        break;
      }
      case 'gearBroken': {
        const { seat, gear } = event as unknown as { seat: SeatId; gear: Gear };
        current.log.push(`💔 ${nameOf(seat)}: ${gear.name} ist abgenutzt`);
        break;
      }
      case 'damage': {
        const hit = event as unknown as { targetType: 'hero' | 'minion'; targetSeat?: SeatId; targetId?: string; amount: number; health: number; lost?: number; armor?: number };
        if (hit.targetType === 'minion' && hit.targetId) {
          current.floats.push({ target: hit.targetId, text: `-${hit.amount}`, kind: 'damage' });
          current.impacted.push(hit.targetId);
          const shown = findShown(current, hit.targetId);
          if (shown) shown.minion = { ...shown.minion, health: hit.health };
          current.log.push(`💥 ${nameOfMinion(hit.targetId)} nimmt ${hit.amount} Schaden`);
        } else if (hit.targetSeat !== undefined) {
          current.floats.push({ target: `hero-${hit.targetSeat}`, text: `-${hit.amount}`, kind: 'damage' });
          current.impacted.push(`hero-${hit.targetSeat}`);
          current.heroes[hit.targetSeat] = hit.health;
          if (hit.armor !== undefined) current.armor[hit.targetSeat] = hit.armor;
          const lost = hit.lost ?? hit.amount;
          const blocked = hit.amount - lost;
          current.log.push(blocked > 0 ? `🛡️ ${nameOf(hit.targetSeat)}: Rüstung fängt ${blocked} ab, ${lost} Leben verloren` : `💥 ${nameOf(hit.targetSeat)} verliert ${lost} Leben`);
        }
        break;
      }
      case 'fatigue': {
        const { seat, damage, health, armor } = event as unknown as { seat: SeatId; damage: number; health: number; armor?: number };
        current.floats.push({ target: `hero-${seat}`, text: `-${damage}`, kind: 'damage' });
        current.impacted.push(`hero-${seat}`);
        current.heroes[seat] = health;
        if (armor !== undefined) current.armor[seat] = armor;
        const text = `😴 ${nameOf(seat)}: Deck leer, ${damage} Müdigkeits-Schaden`;
        current.log.push(text);
        current.notices.push(text);
        break;
      }
      case 'heal': {
        const heal = event as unknown as { targetId?: string; amount: number; health: number };
        if (heal.targetId) {
          current.floats.push({ target: heal.targetId, text: `+${heal.amount}`, kind: 'heal' });
          const shown = findShown(current, heal.targetId);
          if (shown) shown.minion = { ...shown.minion, health: heal.health };
          current.log.push(`💚 ${nameOfMinion(heal.targetId)} heilt ${heal.amount}`);
        }
        break;
      }
      case 'heroHealed': {
        const { seat, amount, health } = event as unknown as { seat: SeatId; amount: number; health: number };
        current.floats.push({ target: `hero-${seat}`, text: `+${amount}`, kind: 'heal' });
        current.heroes[seat] = health;
        current.log.push(`💚 ${nameOf(seat)} heilt ${amount} Leben`);
        break;
      }
      case 'bubblePopped': {
        const { minionId } = event as unknown as { minionId: string };
        current.impacted.push(minionId);
        current.floats.push({ target: minionId, text: '🫧', kind: 'fx' });
        const shown = findShown(current, minionId);
        if (shown) shown.minion = { ...shown.minion, bubble: false };
        current.log.push(`🫧 Die Schutzblase von ${nameOfMinion(minionId)} platzt`);
        break;
      }
      case 'damageBlocked': {
        const { minionId } = event as unknown as { minionId: string };
        current.floats.push({ target: minionId, text: '🌀', kind: 'fx' });
        current.log.push(`🌀 ${nameOfMinion(minionId)} ist eingerollt und bleibt heil`);
        break;
      }
      case 'minionFrozen': {
        const { minionId } = event as unknown as { minionId: string };
        current.floats.push({ target: minionId, text: '🧊', kind: 'fx' });
        const shown = findShown(current, minionId);
        if (shown) shown.minion = { ...shown.minion, frozen: true };
        current.log.push(`🧊 ${nameOfMinion(minionId)} erstarrt`);
        break;
      }
      case 'minionSilenced': {
        const { minionId, attack, health, maxHealth } = event as unknown as { minionId: string; attack: number; health: number; maxHealth: number };
        current.floats.push({ target: minionId, text: '😌', kind: 'fx' });
        const shown = findShown(current, minionId);
        if (shown) {
          const { sprinter: _a, doubleStrike: _b, lifesteal: _c, frostbite: _d, reborn: _e, immune: _f, elusive: _g, spellPower: _h, frozen: _i, ...rest } = shown.minion;
          shown.minion = { ...rest, attack, health, maxHealth, taunt: false, rush: false, bubble: false, poisonous: false, stealth: false, silenced: true };
        }
        current.log.push(`😌 ${nameOfMinion(minionId)} wird beruhigt`);
        break;
      }
      case 'cardTraded': {
        const { seat } = event as unknown as { seat: SeatId };
        current.log.push(`🔄 ${nameOf(seat)} tauscht eine Karte`);
        break;
      }
      case 'cardFaded': {
        const { seat } = event as unknown as { seat: SeatId };
        current.log.push(`⏳ ${nameOf(seat)}: Eine flüchtige Karte verschwindet`);
        break;
      }
      case 'handFull': {
        const { seat, cardId } = event as unknown as { seat: SeatId; cardId: string };
        const text = `🚫 ${nameOf(seat)}: Hand voll, ${CARDS_DB[cardId]?.name ?? 'Karte'} geht verloren`;
        current.log.push(text);
        current.notices.push(text);
        break;
      }
      case 'minionBuffed': {
        const { minionId, ...changes } = event as unknown as { minionId: string; type: string } & Partial<Minion>;
        current.floats.push({ target: minionId, text: '✨', kind: 'fx' });
        const shown = findShown(current, minionId);
        if (shown) {
          const { type: _type, ...fields } = changes;
          shown.minion = { ...shown.minion, ...fields };
        }
        current.log.push(`✨ ${nameOfMinion(minionId)} wird verstärkt`);
        break;
      }
      case 'minionSummoned': {
        const { seat, minion } = event as unknown as { seat: SeatId; minion: Minion };
        names.set(minion.id, minion.name);
        current.boards[seat]!.push({ minion, dying: false, fresh: true });
        current.floats.push({ target: minion.id, text: '🐣', kind: 'fx' });
        current.log.push(`🐣 ${minion.emoji} ${minion.name} erscheint`);
        break;
      }
      case 'minionReturned': {
        const { minionId, seat } = event as unknown as { minionId: string; seat: SeatId };
        current.boards[seat] = current.boards[seat]!.filter((s) => s.minion.id !== minionId) as ShownMinion[];
        current.log.push(`🌊 ${nameOfMinion(minionId)} kehrt auf die Hand zurück`);
        break;
      }
      case 'minionLeft': {
        const { minionId, name } = event as unknown as { minionId: string; name: string };
        const shown = findShown(current, minionId);
        if (shown) shown.dying = true;
        current.calls.push({ name, kind: 'death' });
        current.log.push(`💀 ${name} geht vom Feld`);
        break;
      }
      case 'boardFull': {
        const { seat, cardId } = event as unknown as { seat: SeatId; cardId: string };
        const text = `🚫 ${nameOf(seat)}: Feld voll, ${CARDS_DB[cardId]?.name ?? 'Tier'} kommt nicht aufs Feld`;
        current.log.push(text);
        current.notices.push(text);
        break;
      }
      case 'cardBurned': {
        const { seat, card } = event as unknown as { seat: SeatId; card: CardInstance };
        const text = `🔥 ${nameOf(seat)}: Hand voll, ${CARDS_DB[card.defId]?.name ?? 'Karte'} verbrennt`;
        current.log.push(text);
        current.notices.push(text);
        break;
      }
      default:
        break;
    }
  }

  const total = beats.reduce((sum, b) => sum + b.durationMs, 0);
  const factor = Math.min(1, LONGEST_RUN_MS / Math.max(total, 1)) * (reducedMotion ? REDUCED_MOTION_FACTOR : 1);
  for (const b of beats) b.durationMs = Math.round(b.durationMs * factor);
  return beats;
}
