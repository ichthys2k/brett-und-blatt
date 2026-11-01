import {
  Rng,
  type Actor,
  type GameEvent,
  type GameModule,
  type MoveResult,
  type Options,
  type OptionSpec,
  type Result,
  type SeatId,
  type TimePresets,
} from '@brett-und-blatt/engine';
import { ALL_CARD_IDS, ALL_SPELL_IDS, CARDS_DB, STAR_CARD } from './cards';
import { DECK_THEMES, DECK_THEME_IDS, themeCardIds } from './decks';
import { meta } from './meta';
import type {
  CardInstance,
  DeckThemeId,
  DrachenspielMove,
  DrachenspielState,
  DrachenspielView,
  HiddenPlayerView,
  Minion,
  PlayerState,
  SpellEffect,
  SpellTarget,
  SpellTargeting,
} from './types';
import { bots } from './bots';

export const options: OptionSpec[] = [
  {
    id: 'deckSelection',
    label: 'Deck-Wahl',
    choices: [
      { value: 'inGame', label: 'Im Spiel wählen (Themendecks)' },
      { value: 'forest', label: '🌳 Wald' },
      { value: 'sea', label: '🌊 Meer' },
      { value: 'farm', label: '🚜 Bauernhof' },
      { value: 'wild', label: '🌍 Wildnis' },
      { value: 'bugs', label: '🐜 Krabbeltiere' },
      { value: 'random', label: '🎲 Gemischtes Deck' },
    ],
    default: 'inGame',
  },
  {
    id: 'spells',
    label: 'Zauberkarten',
    description: 'Jedes Deck tauscht drei Tierpaare gegen drei Zauberpaare (Blitzschlag, Honigtopf, Flutwelle …).',
    choices: [
      { value: 'on', label: 'An' },
      { value: 'off', label: 'Aus (nur Tiere)' },
    ],
    default: 'on',
  },
  {
    id: 'mulligan',
    label: 'Startkarten tauschen',
    choices: [
      { value: 'on', label: 'An (Mulligan)' },
      { value: 'off', label: 'Aus' },
    ],
    default: 'on',
  },
];

export const timePresets: TimePresets = {
  relaxed: { kind: 'perMove', moveMs: 120_000, bankMs: 60_000, firstMoveMs: 60_000 },
  normal: { kind: 'perMove', moveMs: 75_000, bankMs: 30_000, firstMoveMs: 45_000 },
  fast: { kind: 'perMove', moveMs: 45_000, bankMs: 15_000, firstMoveMs: 30_000 },
};

export const spellsOn = (opts: Options) => (opts.spells ?? 'on') !== 'off';

const SINGLE_COPY_CARDS = new Set(['c53', 'c54']);

function createDeck(theme: string, rng: Rng, nextId: () => number, withSpells: boolean): CardInstance[] {
  let cardIds: string[];
  if (theme in DECK_THEMES) {
    cardIds = themeCardIds(theme as DeckThemeId, withSpells);
  } else {
    // Gemischtes Deck: 30 zufällige Karten, mit Zauberkarten davon 6 Zauber. Wie in den
    // Themendecks höchstens zwei Kopien, von Fuchs und Drache nur eine.
    const copies = (ids: string[]) => ids.flatMap((id) => (SINGLE_COPY_CARDS.has(id) ? [id] : [id, id]));
    const spells = withSpells ? 6 : 0;
    cardIds = [
      ...rng.shuffle(copies(ALL_CARD_IDS)).slice(0, 30 - spells),
      ...rng.shuffle(copies(ALL_SPELL_IDS)).slice(0, spells),
    ];
  }
  const deck: CardInstance[] = cardIds.map((defId) => ({
    uid: `c_${nextId()}`,
    defId,
  }));
  return rng.shuffle(deck);
}

/** Online-Räume aus der Zeit vor `ruleVersion` 3 haben noch keinen Zufallsstrom. */
function partyRng(state: DrachenspielState): Rng {
  return state.rng ? new Rng(state.rng) : Rng.fromSeed(`alt/${state.nextEntityId}`);
}

function createPlayer(seat: SeatId): PlayerState {
  return {
    seat,
    health: 30,
    maxHealth: 30,
    mana: 0,
    maxMana: 0,
    deck: [],
    hand: [],
    board: [],
    fatigue: 0,
    deckTheme: null,
    mulliganDone: false,
  };
}

export function setup(seats: number, opts: Options, seed: string): DrachenspielState {
  const rng = Rng.fromSeed(seed);
  let entityCounter = 1;
  const nextId = () => entityCounter++;

  const startingSeat = rng.int(2) as SeatId;
  const players: [PlayerState, PlayerState] = [createPlayer(0), createPlayer(1)];

  const deckOption = opts.deckSelection ?? 'inGame';
  const mulliganOption = opts.mulligan ?? 'on';

  const state: DrachenspielState = {
    phase: deckOption === 'inGame' ? 'deckSelection' : 'mulligan',
    activeSeat: startingSeat,
    turn: 0,
    players,
    startingSeat,
    nextEntityId: entityCounter,
    rng: rng.state,
    options: { ...opts },
  };

  if (deckOption !== 'inGame') {
    for (const p of state.players) {
      p.deckTheme = deckOption in DECK_THEMES ? (deckOption as DeckThemeId) : 'mixed';
      p.deck = createDeck(deckOption, rng, nextId, spellsOn(opts));
    }
    state.rng = rng.state;
    state.nextEntityId = entityCounter;
    dealStartingHands(state, mulliganOption === 'on');
  }

  return state;
}

function dealStartingHands(state: DrachenspielState, willMulligan: boolean): void {
  const pStart = state.players[state.startingSeat];
  const pSecond = state.players[1 - state.startingSeat];

  // Starting player draws 3
  for (let i = 0; i < 3; i++) {
    const card = pStart.deck.shift();
    if (card) pStart.hand.push(card);
  }

  // Second player draws 4
  for (let i = 0; i < 4; i++) {
    const card = pSecond.deck.shift();
    if (card) pSecond.hand.push(card);
  }

  if (willMulligan) {
    state.phase = 'mulligan';
  } else {
    // Second player gets Star card
    pSecond.hand.push({ uid: `star_${state.nextEntityId++}`, defId: STAR_CARD.id });
    state.phase = 'play';
    startTurn(state, state.startingSeat, []);
  }
}

function startTurn(state: DrachenspielState, seat: SeatId, events: GameEvent[]): void {
  state.turn++;
  state.activeSeat = seat;
  const player = state.players[seat];

  player.maxMana = Math.min(10, player.maxMana + 1);
  player.mana = player.maxMana;

  for (const minion of player.board) {
    minion.canAttack = true;
    minion.hasAttacked = false;
  }

  events.push({
    type: 'turnStarted',
    seat,
    turn: state.turn,
    mana: player.mana,
    maxMana: player.maxMana,
  });

  // Draw card or fatigue
  drawCard(player, events);
}

function drawCard(player: PlayerState, events: GameEvent[]): void {
  if (player.deck.length === 0) {
    player.fatigue++;
    player.health -= player.fatigue;
    events.push({
      type: 'fatigue',
      seat: player.seat,
      damage: player.fatigue,
      health: player.health,
    });
    return;
  }

  const card = player.deck.shift()!;
  if (player.hand.length >= 7) {
    events.push({
      type: 'cardBurned',
      seat: player.seat,
      card,
    });
  } else {
    player.hand.push(card);
    events.push({
      type: 'cardDrawn',
      seat: player.seat,
      card,
    });
  }
}

export function currentPlayers(state: DrachenspielState): Actor[] {
  if (state.phase === 'deckSelection') {
    const actors: Actor[] = [];
    if (!state.players[0].deckTheme) actors.push(0);
    if (!state.players[1].deckTheme) actors.push(1);
    return actors;
  }
  if (state.phase === 'mulligan') {
    const actors: Actor[] = [];
    if (!state.players[0].mulliganDone) actors.push(0);
    if (!state.players[1].mulliganDone) actors.push(1);
    return actors;
  }
  if (state.phase === 'play') {
    return [state.activeSeat];
  }
  return [];
}

export function legalMoves(state: DrachenspielState, actor: Actor): DrachenspielMove[] {
  if (typeof actor !== 'number' || actor < 0 || actor > 1) return [];
  const player = state.players[actor];

  if (state.phase === 'deckSelection') {
    if (player.deckTheme) return [];
    return DECK_THEME_IDS.map((deck) => ({ type: 'chooseDeck', deck }));
  }

  if (state.phase === 'mulligan') {
    if (player.mulliganDone) return [];
    const n = player.hand.length;
    const moves: DrachenspielMove[] = [];
    // Enumerate subsets of discard indices
    const totalSubsets = 1 << n;
    for (let mask = 0; mask < totalSubsets; mask++) {
      const discardIndices: number[] = [];
      for (let i = 0; i < n; i++) {
        if ((mask & (1 << i)) !== 0) discardIndices.push(i);
      }
      moves.push({ type: 'mulligan', discardIndices });
    }
    return moves;
  }

  if (state.phase === 'play') {
    if (actor !== state.activeSeat) return [];
    const moves: DrachenspielMove[] = [{ type: 'endTurn' }];

    // Play card
    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      const def = CARDS_DB[card.defId];
      if (!def) continue;
      if (def.cost <= player.mana) {
        if (def.spell) {
          for (const target of spellTargets(state, actor, def.targeting ?? 'none')) {
            moves.push(target ? { type: 'playCard', handIndex: i, target } : { type: 'playCard', handIndex: i });
          }
        } else if (def.isSpell || player.board.length < 7) {
          moves.push({ type: 'playCard', handIndex: i });
        }
      }
    }

    // Attacks
    const enemy = state.players[1 - actor];
    const tauntMinions = enemy.board.filter((m) => m.taunt && !m.stealth);

    for (const minion of player.board) {
      if (minion.canAttack && !minion.hasAttacked && minion.attack > 0) {
        if (tauntMinions.length > 0) {
          for (const t of tauntMinions) {
            moves.push({
              type: 'attack',
              attackerId: minion.id,
              target: { kind: 'minion', id: t.id },
            });
          }
        } else {
          // Can attack enemy hero
          moves.push({
            type: 'attack',
            attackerId: minion.id,
            target: { kind: 'hero' },
          });
          // Can attack non-stealthed enemy minions
          for (const m of enemy.board) {
            if (!m.stealth) {
              moves.push({
                type: 'attack',
                attackerId: minion.id,
                target: { kind: 'minion', id: m.id },
              });
            }
          }
        }
      }
    }

    return moves;
  }

  return [];
}

export function applyMove(
  state: DrachenspielState,
  actor: Actor,
  move: DrachenspielMove,
): MoveResult<DrachenspielState> {
  if (typeof actor !== 'number' || actor < 0 || actor > 1) {
    throw new Error('Ungültiger Akteur');
  }

  // Deep clone state
  const next: DrachenspielState = JSON.parse(JSON.stringify(state));
  const player = next.players[actor];
  const enemy = next.players[1 - actor];
  const events: GameEvent[] = [];

  const nextEntityId = () => next.nextEntityId++;

  if (move.type === 'chooseDeck') {
    if (next.phase !== 'deckSelection' || player.deckTheme) {
      throw new Error('Deck-Wahl jetzt nicht erlaubt');
    }
    player.deckTheme = move.deck;
    const rng = partyRng(next);
    player.deck = createDeck(move.deck, rng, nextEntityId, spellsOn(next.options));
    next.rng = rng.state;

    events.push({ type: 'deckChosen', seat: actor, deck: move.deck });

    // Check if both have chosen
    if (next.players[0].deckTheme && next.players[1].deckTheme) {
      const willMulligan = (next.options.mulligan ?? 'on') === 'on';
      dealStartingHands(next, willMulligan);
    }
    return { state: next, events };
  }

  if (move.type === 'mulligan') {
    if (next.phase !== 'mulligan' || player.mulliganDone) {
      throw new Error('Mulligan jetzt nicht erlaubt');
    }
    const toDiscard = [...new Set(move.discardIndices)].sort((a, b) => b - a);
    const discardedCards: CardInstance[] = [];

    for (const idx of toDiscard) {
      if (idx >= 0 && idx < player.hand.length) {
        discardedCards.push(player.hand.splice(idx, 1)[0]);
      }
    }

    // Draw replacements
    for (let i = 0; i < discardedCards.length; i++) {
      const newCard = player.deck.shift();
      if (newCard) player.hand.push(newCard);
    }

    // Shuffle discarded back into deck
    player.deck.push(...discardedCards);
    const rng = partyRng(next);
    player.deck = rng.shuffle(player.deck);
    next.rng = rng.state;

    player.mulliganDone = true;
    events.push({ type: 'mulliganDone', seat: actor, count: discardedCards.length });

    if (next.players[0].mulliganDone && next.players[1].mulliganDone) {
      const pSecond = next.players[1 - next.startingSeat];
      pSecond.hand.push({ uid: `star_${nextEntityId()}`, defId: STAR_CARD.id });
      next.phase = 'play';
      startTurn(next, next.startingSeat, events);
    }
    return { state: next, events };
  }

  if (next.phase !== 'play' || actor !== next.activeSeat) {
    throw new Error('Nicht an der Reihe');
  }

  if (move.type === 'endTurn') {
    startTurn(next, (1 - next.activeSeat) as SeatId, events);
    checkGameOver(next, events);
    return { state: next, events };
  }

  if (move.type === 'playCard') {
    const card = player.hand[move.handIndex];
    if (!card) throw new Error('Karte nicht vorhanden');
    const def = CARDS_DB[card.defId];
    if (!def) throw new Error('Unbekannte Karte');
    if (def.cost > player.mana) throw new Error('Nicht genug Mana');

    if (def.spell) {
      const targets = spellTargets(next, actor, def.targeting ?? 'none');
      const target = move.target ?? null;
      if (!targets.some((t) => sameTarget(t, target))) throw new Error('Ungültiges Ziel für den Zauber');
      player.mana -= def.cost;
      player.hand.splice(move.handIndex, 1);
      events.push({ type: 'spellCast', seat: actor, card, spell: def.spell, target });
      castSpell(next, actor, def.spell, target, events);
      checkGameOver(next, events);
      return { state: next, events };
    }

    if (def.isSpell) {
      player.mana -= def.cost;
      player.hand.splice(move.handIndex, 1);
      player.mana = Math.min(10, player.mana + 1);
      events.push({ type: 'starPlayed', seat: actor });
      return { state: next, events };
    }

    if (player.board.length >= 7) throw new Error('Spielfeld voll');

    player.mana -= def.cost;
    player.hand.splice(move.handIndex, 1);

    const hasTaunt = def.abilities?.some((a) => a.type === 'taunt') ?? false;
    const hasRush = def.abilities?.some((a) => a.type === 'rush') ?? false;
    const hasBubble = def.abilities?.some((a) => a.type === 'bubble') ?? false;
    const hasPoisonous = def.abilities?.some((a) => a.type === 'poisonous') ?? false;
    const hasStealth = def.abilities?.some((a) => a.type === 'stealth') ?? false;
    const deathrattle = def.abilities?.find((a) => a.type === 'deathrattle') as
      | { type: 'deathrattle'; effect: any }
      | undefined;

    const minion: Minion = {
      id: `m_${nextEntityId()}`,
      cardId: def.id,
      name: def.name,
      emoji: def.emoji,
      cost: def.cost,
      baseAttack: def.attack,
      attack: def.attack,
      baseHealth: def.health,
      maxHealth: def.health,
      health: def.health,
      quote: def.quote ?? null,
      sound: def.sound ?? null,
      taunt: hasTaunt,
      rush: hasRush,
      bubble: hasBubble,
      poisonous: hasPoisonous,
      stealth: hasStealth,
      canAttack: hasRush,
      hasAttacked: false,
      deathrattle: deathrattle?.effect ?? null,
    };

    player.board.push(minion);
    events.push({ type: 'cardPlayed', seat: actor, card, minion });

    // Battlecries
    const battlecry = def.abilities?.find((a) => a.type === 'battlecry') as
      | { type: 'battlecry'; effect: any }
      | undefined;

    if (battlecry) {
      if (battlecry.effect === 'summon_ant') {
        if (player.board.length < 7) {
          const antMinion: Minion = {
            id: `m_${nextEntityId()}`,
            cardId: 'token_ant',
            name: 'Ameisen-Soldat',
            emoji: '🐜',
            cost: 1,
            baseAttack: 1,
            attack: 1,
            baseHealth: 1,
            maxHealth: 1,
            health: 1,
            quote: 'Zu Befehl!',
            sound: 'ameise.mp3',
            taunt: false,
            rush: false,
            bubble: false,
            poisonous: false,
            stealth: false,
            canAttack: false,
            hasAttacked: false,
            deathrattle: null,
          };
          player.board.push(antMinion);
          events.push({ type: 'minionSummoned', seat: actor, minion: antMinion });
        }
      } else if (battlecry.effect === 'buff_allies_attack_1') {
        for (const m of player.board) {
          if (m.id !== minion.id) {
            m.attack += 1;
            events.push({ type: 'minionBuffed', minionId: m.id, attack: m.attack });
          }
        }
      } else if (battlecry.effect === 'heal_hero_3') {
        healHero(player, 3, events);
      } else if (battlecry.effect === 'dragon_breath') {
        for (const enemyMinion of enemy.board) {
          applyDamageToMinion(enemyMinion, 2, false, events);
        }
        cleanupDeadMinions(next, events);
      }
    }

    checkGameOver(next, events);
    return { state: next, events };
  }

  if (move.type === 'attack') {
    const attacker = player.board.find((m) => m.id === move.attackerId);
    if (!attacker) throw new Error('Angreifer existiert nicht');
    if (!attacker.canAttack || attacker.hasAttacked || attacker.attack <= 0) {
      throw new Error('Tier kann nicht angreifen');
    }

    const target = move.target;

    // Check taunt
    const tauntMinions = enemy.board.filter((m) => m.taunt && !m.stealth);
    if (tauntMinions.length > 0) {
      if (target.kind === 'hero') throw new Error('Beschützer muss zuerst angegriffen werden');
      const isTargetTaunt = tauntMinions.some((m) => m.id === target.id);
      if (!isTargetTaunt) throw new Error('Beschützer muss zuerst angegriffen werden');
    }

    attacker.stealth = false;
    attacker.hasAttacked = true;
    events.push({ type: 'attack', attackerId: attacker.id, target });

    if (target.kind === 'hero') {
      enemy.health -= attacker.attack;
      events.push({
        type: 'damage',
        targetType: 'hero',
        targetSeat: enemy.seat,
        amount: attacker.attack,
        health: enemy.health,
      });
    } else {
      const defender = enemy.board.find((m) => m.id === target.id);
      if (!defender) throw new Error('Verteidiger existiert nicht');
      if (defender.stealth) throw new Error('Verstecktes Tier kann nicht angegriffen werden');

      // Simultaneous damage exchange
      const dmgToDefender = attacker.attack;
      const dmgToAttacker = defender.attack;

      applyDamageToMinion(defender, dmgToDefender, attacker.poisonous, events);
      applyDamageToMinion(attacker, dmgToAttacker, defender.poisonous, events);

      cleanupDeadMinions(next, events);
    }

    checkGameOver(next, events);
    return { state: next, events };
  }

  throw new Error('Unbekannter Zug');
}

// ---------------------------------------------------------------------------
// Zauberkarten
// ---------------------------------------------------------------------------

/** Mögliche Ziele eines Zaubers; `null` steht für „ohne Ziel“. Versteckte Gegner sind kein Ziel. */
export function spellTargets(state: DrachenspielState, seat: SeatId, targeting: SpellTargeting): (SpellTarget | null)[] {
  const me = state.players[seat];
  const enemy = state.players[1 - seat];
  const enemyMinions = enemy.board.filter((m) => !m.stealth).map((m): SpellTarget => ({ kind: 'minion', id: m.id }));
  switch (targeting) {
    case 'none':
      return [null];
    case 'enemyAny':
      return [{ kind: 'hero' }, ...enemyMinions];
    case 'enemyMinion':
      return enemyMinions;
    case 'ownMinion':
      return me.board.map((m): SpellTarget => ({ kind: 'minion', id: m.id }));
  }
}

function sameTarget(a: SpellTarget | null, b: SpellTarget | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'hero' || b.kind === 'hero') return a.kind === b.kind;
  return a.id === b.id;
}

function castSpell(state: DrachenspielState, seat: SeatId, spell: SpellEffect, target: SpellTarget | null, events: GameEvent[]): void {
  const me = state.players[seat];
  const enemy = state.players[1 - seat];
  const targetMinion = target?.kind === 'minion' ? [...me.board, ...enemy.board].find((m) => m.id === target.id) : undefined;
  switch (spell) {
    case 'lightning':
      if (target?.kind === 'hero') {
        enemy.health -= 3;
        events.push({ type: 'damage', targetType: 'hero', targetSeat: enemy.seat, amount: 3, health: enemy.health });
      } else if (targetMinion) {
        applyDamageToMinion(targetMinion, 3, false, events);
        cleanupDeadMinions(state, events);
      }
      break;
    case 'honey':
      if (targetMinion) {
        targetMinion.attack += 2;
        targetMinion.maxHealth += 2;
        targetMinion.health += 2;
        events.push({ type: 'minionBuffed', minionId: targetMinion.id, attack: targetMinion.attack, health: targetMinion.health });
      }
      break;
    case 'tailwind':
      if (targetMinion) {
        targetMinion.attack += 1;
        if (!targetMinion.hasAttacked) targetMinion.canAttack = true;
        events.push({ type: 'minionBuffed', minionId: targetMinion.id, attack: targetMinion.attack });
      }
      break;
    case 'soapBubble':
      if (targetMinion) {
        targetMinion.bubble = true;
        events.push({ type: 'minionBuffed', minionId: targetMinion.id, bubble: true });
      }
      break;
    case 'growth':
      for (const m of me.board) {
        m.attack += 1;
        m.maxHealth += 1;
        m.health += 1;
        events.push({ type: 'minionBuffed', minionId: m.id, attack: m.attack, health: m.health });
      }
      break;
    case 'summerRain': {
      const healed = Math.min(me.maxHealth, me.health + 3) - me.health;
      me.health += healed;
      if (healed > 0) events.push({ type: 'heal', targetType: 'hero', targetSeat: seat, amount: healed, health: me.health });
      for (const m of me.board) {
        if (m.health < m.maxHealth) {
          events.push({ type: 'heal', targetType: 'minion', targetId: m.id, amount: m.maxHealth - m.health, health: m.maxHealth });
          m.health = m.maxHealth;
        }
      }
      break;
    }
    case 'clover':
      drawCard(me, events);
      drawCard(me, events);
      break;
    case 'flood':
      if (targetMinion) {
        enemy.board = enemy.board.filter((m) => m.id !== targetMinion.id);
        events.push({ type: 'minionReturned', minionId: targetMinion.id, name: targetMinion.name, seat: enemy.seat });
        // Spielsteine (z. B. Ameisen-Soldat) und volle Hände: Das Tier ist einfach weg.
        if (CARDS_DB[targetMinion.cardId] && !targetMinion.cardId.startsWith('token_') && enemy.hand.length < 7) {
          enemy.hand.push({ uid: `c_${state.nextEntityId++}`, defId: targetMinion.cardId });
        }
      }
      break;
    case 'whirlwind':
      for (const m of enemy.board) applyDamageToMinion(m, 2, false, events);
      cleanupDeadMinions(state, events);
      break;
  }
}

/** Heilt höchstens bis zum Maximum; das Ereignis nennt die wirklich geheilte Menge. */
function healHero(player: PlayerState, amount: number, events: GameEvent[]): void {
  const healed = Math.min(player.maxHealth, player.health + amount) - player.health;
  if (healed <= 0) return;
  player.health += healed;
  events.push({ type: 'heroHealed', seat: player.seat, amount: healed, health: player.health });
}

function applyDamageToMinion(
  minion: Minion,
  amount: number,
  isPoisonous: boolean,
  events: GameEvent[],
): void {
  if (amount <= 0) return;
  if (minion.bubble) {
    minion.bubble = false;
    events.push({ type: 'bubblePopped', minionId: minion.id });
    return;
  }
  minion.health -= amount;
  if (isPoisonous) {
    minion.health = 0;
  }
  events.push({
    type: 'damage',
    targetType: 'minion',
    targetId: minion.id,
    amount,
    health: minion.health,
  });
}

function cleanupDeadMinions(state: DrachenspielState, events: GameEvent[]): void {
  for (const p of state.players) {
    const dead: Minion[] = [];
    p.board = p.board.filter((m) => {
      if (m.health <= 0) {
        dead.push(m);
        return false;
      }
      return true;
    });

    for (const m of dead) {
      events.push({ type: 'minionLeft', minionId: m.id, name: m.name });
      // Trigger deathrattles
      if (m.deathrattle === 'butterfly') {
        if (p.board.length < 7) {
          const butterfly: Minion = {
            id: `m_${state.nextEntityId++}`,
            cardId: 'token_butterfly',
            name: 'Schmetterling',
            emoji: '🦋',
            cost: 1,
            baseAttack: 1,
            attack: 1,
            baseHealth: 2,
            maxHealth: 2,
            health: 2,
            quote: 'Frei wie der Wind!',
            sound: 'schmetterling.mp3',
            taunt: false,
            rush: false,
            bubble: true,
            poisonous: false,
            stealth: false,
            canAttack: false,
            hasAttacked: false,
            deathrattle: null,
          };
          p.board.push(butterfly);
          events.push({ type: 'minionSummoned', seat: p.seat, minion: butterfly });
        }
      } else if (m.deathrattle === 'explode_1') {
        const enemy = state.players[1 - p.seat];
        for (const enemyMinion of enemy.board) {
          applyDamageToMinion(enemyMinion, 1, false, events);
        }
      } else if (m.deathrattle === 'heal_hero_2') {
        healHero(p, 2, events);
      }
    }
  }

  // Second pass in case explode_1 caused deaths
  let anySecondaryDead = false;
  for (const p of state.players) {
    if (p.board.some((m) => m.health <= 0)) {
      anySecondaryDead = true;
      break;
    }
  }
  if (anySecondaryDead) {
    cleanupDeadMinions(state, events);
  }
}

function checkGameOver(state: DrachenspielState, events: GameEvent[]): void {
  const p0Dead = state.players[0].health <= 0;
  const p1Dead = state.players[1].health <= 0;
  if (p0Dead || p1Dead) {
    state.phase = 'ended';
    events.push({
      type: 'gameOver',
      winner: p0Dead && p1Dead ? undefined : p0Dead ? 1 : 0,
    });
  }
}

export function playerView(
  state: DrachenspielState,
  seat: SeatId | 'spectator',
): DrachenspielView {
  const mapPlayer = (p: PlayerState): HiddenPlayerView => {
    const isOwner = seat === p.seat;
    return {
      seat: p.seat,
      health: p.health,
      maxHealth: p.maxHealth,
      mana: p.mana,
      maxMana: p.maxMana,
      deckCount: p.deck.length,
      handCount: p.hand.length,
      hand: isOwner ? p.hand.map((c) => ({ ...c })) : null,
      board: p.board.map((m) => ({ ...m })),
      fatigue: p.fatigue,
      deckTheme: p.deckTheme ?? null,
      mulliganDone: p.mulliganDone,
    };
  };

  return {
    phase: state.phase,
    activeSeat: state.activeSeat,
    turn: state.turn,
    players: [mapPlayer(state.players[0]), mapPlayer(state.players[1])],
    startingSeat: state.startingSeat,
    viewerSeat: seat,
    options: { ...state.options },
  };
}

export function result(state: DrachenspielState): Result | null {
  const p0Dead = state.players[0].health <= 0;
  const p1Dead = state.players[1].health <= 0;
  if (!p0Dead && !p1Dead) return null;
  if (p0Dead && p1Dead) {
    return { kind: 'draw', reason: 'Beide Helden sind gleichzeitig gefallen.' };
  }
  if (p0Dead) {
    return { kind: 'win', winners: [1], reason: 'Held von Platz 2 hat gewonnen!' };
  }
  return { kind: 'win', winners: [0], reason: 'Held von Platz 1 hat gewonnen!' };
}

export function timeoutMove(state: DrachenspielState, actor: SeatId): DrachenspielMove {
  if (state.phase === 'deckSelection') {
    return { type: 'chooseDeck', deck: 'forest' };
  }
  if (state.phase === 'mulligan') {
    return { type: 'mulligan', discardIndices: [] };
  }
  return { type: 'endTurn' };
}

export function sampleHidden(
  view: DrachenspielView,
  seat: SeatId,
  rng: Rng,
): DrachenspielState {
  let counter = 1000;
  const nextId = () => counter++;

  const players: [PlayerState, PlayerState] = [
    reconstructPlayer(view.players[0], seat === 0, rng, nextId, spellsOn(view.options)),
    reconstructPlayer(view.players[1], seat === 1, rng, nextId, spellsOn(view.options)),
  ];

  return {
    phase: view.phase,
    activeSeat: view.activeSeat,
    turn: view.turn,
    players,
    startingSeat: view.startingSeat,
    nextEntityId: counter,
    rng: rng.state,
    options: { ...view.options },
  };
}

function reconstructPlayer(
  hv: HiddenPlayerView,
  isViewer: boolean,
  rng: Rng,
  nextId: () => number,
  withSpells: boolean,
): PlayerState {
  const pool = hv.deckTheme && hv.deckTheme !== 'mixed'
    ? themeCardIds(hv.deckTheme, withSpells)
    : [...ALL_CARD_IDS, ...(withSpells ? ALL_SPELL_IDS : [])];

  const hand: CardInstance[] = isViewer && hv.hand
    ? hv.hand.map((c) => ({ ...c }))
    : Array.from({ length: hv.handCount }, () => ({
        uid: `c_${nextId()}`,
        defId: rng.pick(pool),
      }));

  const deck: CardInstance[] = Array.from({ length: hv.deckCount }, () => ({
    uid: `c_${nextId()}`,
    defId: rng.pick(pool),
  }));

  return {
    seat: hv.seat,
    health: hv.health,
    maxHealth: hv.maxHealth,
    mana: hv.mana,
    maxMana: hv.maxMana,
    deck,
    hand,
    board: hv.board.map((m) => ({ ...m })),
    fatigue: hv.fatigue,
    deckTheme: hv.deckTheme,
    mulliganDone: hv.mulliganDone,
  };
}

export function evaluate(state: DrachenspielState, seat: SeatId): number {
  const me = state.players[seat];
  const opp = state.players[1 - seat];

  if (opp.health <= 0) return 10_000;
  if (me.health <= 0) return -10_000;

  let score = 0;
  score += (me.health - opp.health) * 2;
  score += (me.hand.length - opp.hand.length) * 3;

  for (const m of me.board) {
    score += m.attack * 2 + m.health;
    if (m.taunt) score += 2;
    if (m.bubble) score += 2;
    if (m.stealth) score += 1;
  }

  for (const m of opp.board) {
    score -= m.attack * 2 + m.health;
    if (m.taunt) score -= 2;
    if (m.bubble) score -= 2;
  }

  return score;
}

export function eventView(event: GameEvent, seat: SeatId | 'spectator'): GameEvent | null {
  if (event.type === 'cardDrawn') {
    if (event.seat !== seat) {
      return { ...event, card: undefined };
    }
  }
  return event;
}

export const drachenspiel: GameModule<DrachenspielState, DrachenspielMove, DrachenspielView> = {
  info: meta,
  options,
  timePresets,
  setup,
  currentPlayers,
  legalMoves,
  applyMove,
  playerView,
  result,
  timeoutMove,
  sampleHidden,
  evaluate,
  eventView,
  bots,
};
