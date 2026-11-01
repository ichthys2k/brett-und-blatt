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
import { BOARD_LIMIT, MAX_MANA, SECOND_SEAT_ARMOR, canStrike, createMinion, damageHero, damageMinion, drawCard, enqueue, enqueueOwnBoard, enqueuePlayed, isOverTurnLimit, refreshStats, resolveChoice, settle, strike } from './core/effects';
import { DECK_THEMES, DECK_THEME_IDS, themeCardIds } from './decks';
import { HOUSE_POWERS, powerIsUsable } from './powers';
import { meta } from './meta';
import type {
  CardDefinition,
  CardInstance,
  DeckThemeId,
  DrachenspielMove,
  DrachenspielState,
  DrachenspielView,
  HiddenPlayerView,
  Minion,
  PendingChoice,
  PendingView,
  PlayerState,
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

function createDeck(theme: string, rng: Rng, nextId: () => number, withSpells: boolean): CardInstance[] {
  let cardIds: string[];
  if (theme in DECK_THEMES) {
    cardIds = themeCardIds(theme as DeckThemeId, withSpells);
  } else {
    // Gemischtes Deck: 30 zufällige Karten, mit Zauberkarten davon 6 Zauber. Wie in den
    // Themendecks höchstens zwei Kopien, von `singleCopy`-Karten nur eine.
    const copies = (ids: string[]) => ids.flatMap((id) => (CARDS_DB[id]?.singleCopy ? [id] : [id, id]));
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

/** Online-Räume aus der Zeit vor `ruleVersion` 4: Figuren bekommen Veränderungsliste und Schaden. */
function upgradeState(state: DrachenspielState): DrachenspielState {
  state.queue ??= [];
  for (const p of state.players) {
    // Vor `ruleVersion` 5 gab es weder Rüstung noch Hauskraft.
    p.armor ??= 0;
    p.overloadNext ??= 0;
    p.locked ??= 0;
    p.cardsPlayedThisTurn ??= 0;
    p.gear ??= null;
    p.heroAttackBonus ??= 0;
    p.heroAttacked ??= false;
    p.powerUsed ??= false;
    p.power ??= p.deckTheme && p.deckTheme !== 'mixed' ? p.deckTheme : p.deckTheme ? 'farm' : null;
    for (const m of p.board) {
      m.owner ??= p.seat;
      m.playOrder ??= 0;
      m.damage ??= m.maxHealth - m.health;
      if (!m.enchantments) {
        const attack = m.attack - m.baseAttack;
        const health = m.maxHealth - m.baseHealth;
        m.enchantments = attack || health ? [{ id: `e_alt_${m.id}`, source: 'alt', attack, health }] : [];
      }
      refreshStats(m);
    }
  }
  return state;
}

function createPlayer(seat: SeatId): PlayerState {
  return {
    seat,
    health: 30,
    maxHealth: 30,
    armor: 0,
    gear: null,
    heroAttackBonus: 0,
    heroAttacked: false,
    power: null,
    powerUsed: false,
    mana: 0,
    maxMana: 0,
    deck: [],
    hand: [],
    board: [],
    fatigue: 0,
    overloadNext: 0,
    locked: 0,
    cardsPlayedThisTurn: 0,
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
    queue: [],
    options: { ...opts },
  };

  if (deckOption !== 'inGame') {
    for (const p of state.players) {
      p.deckTheme = deckOption in DECK_THEMES ? (deckOption as DeckThemeId) : 'mixed';
      p.deck = createDeck(deckOption, rng, nextId, spellsOn(opts));
      p.power = p.deckTheme === 'mixed' ? rng.pick(DECK_THEME_IDS) : p.deckTheme;
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
  pSecond.armor = SECOND_SEAT_ARMOR;
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

  player.maxMana = Math.min(MAX_MANA, player.maxMana + 1);
  player.locked = player.overloadNext ?? 0;
  player.overloadNext = 0;
  player.mana = Math.max(0, player.maxMana - player.locked);
  player.cardsPlayedThisTurn = 0;
  player.powerUsed = false;
  player.heroAttacked = false;
  // Was „nur für diesen Zug“ galt, endet mit dem Zug des anderen.
  for (const p of state.players) p.heroAttackBonus = 0;

  for (const minion of player.board) {
    minion.canAttack = true;
    minion.hasAttacked = false;
    delete minion.attacksMade;
    delete minion.justPlayed;
    // Eingerollt hält bis zum eigenen nächsten Zug.
    delete minion.immune;
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
    return [state.pending ? state.pending.seat : state.activeSeat];
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
    if (state.pending) {
      return state.pending.seat === actor ? state.pending.options.map((_, index) => ({ type: 'choose', index })) : [];
    }
    if (actor !== state.activeSeat) return [];
    const moves: DrachenspielMove[] = [{ type: 'endTurn' }];

    // Play card
    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      const def = CARDS_DB[card.defId];
      if (!def) continue;
      if (def.cost <= player.mana) {
        if (def.isSpell || player.board.length < BOARD_LIMIT) {
          for (const target of cardTargets(state, actor, def)) {
            moves.push(target ? { type: 'playCard', handIndex: i, target } : { type: 'playCard', handIndex: i });
          }
        }
      }
    }

    const power = player.power ? HOUSE_POWERS[player.power] : undefined;
    if (power && !player.powerUsed && power.cost <= player.mana && powerIsUsable(power, player.board.length)) {
      moves.push({ type: 'heroPower' });
    }

    // Attacks
    const enemy = state.players[1 - actor];
    const targets = attackTargets(enemy);
    for (const minion of player.board) {
      if (canStrike(minion)) {
        for (const target of targets) {
          if (target.kind === 'hero' && heroOutOfReach(minion)) continue;
          moves.push({ type: 'attack', attackerId: minion.id, target });
        }
      }
    }
    for (let i = 0; i < player.hand.length; i++) {
      if (player.mana >= TRADE_COST && player.hand[i]!.fleeting !== true && CARDS_DB[player.hand[i]!.defId]?.keywords?.includes('tradeable')) {
        moves.push({ type: 'tradeCard', handIndex: i });
      }
    }
    if (heroAttackValue(player) > 0 && !player.heroAttacked) {
      for (const target of targets) moves.push({ type: 'heroAttack', target });
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
  const next: DrachenspielState = upgradeState(JSON.parse(JSON.stringify(state)));
  const player = next.players[actor];
  const enemy = next.players[1 - actor];
  const events: GameEvent[] = [];

  const nextEntityId = () => next.nextEntityId++;

  if (move.type === 'chooseDeck') {
    if (next.phase !== 'deckSelection' || player.deckTheme) {
      throw new Error('Deck-Wahl jetzt nicht erlaubt');
    }
    player.deckTheme = move.deck;
    player.power = move.deck;
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

  if (next.pending) {
    if (move.type !== 'choose' || next.pending.seat !== actor) throw new Error('Erst muss die offene Wahl getroffen werden');
    resolveChoice(next, move.index, events);
    if (next.turnEnding && !next.pending) passTurn(next, events);
    return { state: next, events };
  }

  if (next.phase !== 'play' || actor !== next.activeSeat) {
    throw new Error('Nicht an der Reihe');
  }

  if (move.type === 'endTurn') {
    endOwnTurn(player, events);
    enqueueOwnBoard(next, actor, 'turnEnd');
    next.turnEnding = true;
    settle(next, events);
    if (!next.pending) passTurn(next, events);
    return { state: next, events };
  }

  if (move.type === 'playCard') {
    const card = player.hand[move.handIndex];
    if (!card) throw new Error('Karte nicht vorhanden');
    const def = CARDS_DB[card.defId];
    if (!def) throw new Error('Unbekannte Karte');
    if (def.cost > player.mana) throw new Error('Nicht genug Mana');

    const target = move.target ?? null;
    if (!cardTargets(next, actor, def).some((t) => sameTarget(t, target))) {
      throw new Error('Ungültiges Ziel');
    }
    const conditions = { combo: player.cardsPlayedThisTurn > 0, outcast: move.handIndex === 0 || move.handIndex === player.hand.length - 1 };

    if (def.isSpell) {
      player.mana -= def.cost;
      player.overloadNext += def.overload ?? 0;
      player.cardsPlayedThisTurn++;
      player.hand.splice(move.handIndex, 1);
      events.push({ type: 'spellCast', seat: actor, card, target });
      enqueue(next, def.effects, actor, def.id, null, target);
      enqueueOwnBoard(next, actor, 'spellCast');
      settle(next, events);
      return { state: next, events };
    }

    if (player.board.length >= BOARD_LIMIT) throw new Error('Spielfeld voll');

    player.mana -= def.cost;
    player.overloadNext += def.overload ?? 0;
    player.cardsPlayedThisTurn++;
    player.hand.splice(move.handIndex, 1);

    const minion = createMinion(next, def, actor);
    player.board.push(minion);
    events.push({ type: 'cardPlayed', seat: actor, card, minion });
    enqueuePlayed(next, minion, actor, target, conditions);
    settle(next, events);
    return { state: next, events };
  }

  if (move.type === 'tradeCard') {
    const card = player.hand[move.handIndex];
    if (!card || card.fleeting || !CARDS_DB[card.defId]?.keywords?.includes('tradeable')) throw new Error('Karte lässt sich nicht tauschen');
    if (player.mana < TRADE_COST) throw new Error('Nicht genug Mana');
    player.mana -= TRADE_COST;
    player.hand.splice(move.handIndex, 1);
    const rng = partyRng(next);
    player.deck = rng.shuffle([...player.deck, card]);
    next.rng = rng.state;
    events.push({ type: 'cardTraded', seat: actor });
    drawCard(player, events);
    settle(next, events);
    return { state: next, events };
  }

  if (move.type === 'heroPower') {
    const power = player.power ? HOUSE_POWERS[player.power] : undefined;
    if (!power) throw new Error('Keine Hauskraft');
    if (player.powerUsed) throw new Error('Hauskraft in diesem Zug schon genutzt');
    if (power.cost > player.mana) throw new Error('Nicht genug Mana');
    if (!powerIsUsable(power, player.board.length)) throw new Error('Spielfeld voll');
    player.mana -= power.cost;
    player.powerUsed = true;
    events.push({ type: 'heroPowerUsed', seat: actor, power: power.id });
    enqueue(next, power.effects, actor, `power_${power.id}`, null, null);
    settle(next, events);
    return { state: next, events };
  }

  if (move.type === 'heroAttack') {
    const strength = heroAttackValue(player);
    if (strength <= 0 || player.heroAttacked) throw new Error('Held kann nicht angreifen');
    const target = move.target;
    const allowed = attackTargets(enemy).some((t) => (t.kind === 'hero' ? target.kind === 'hero' : target.kind === 'minion' && t.id === target.id));
    if (!allowed) throw new Error('Ungültiges Ziel für den Helden');

    player.heroAttacked = true;
    events.push({ type: 'heroAttack', seat: actor, target });
    if (target.kind === 'hero') {
      damageHero(enemy, strength, events);
    } else {
      const defender = enemy.board.find((m) => m.id === target.id)!;
      // Der Gegenschlag trifft den Helden; Gift wirkt nur auf Tiere.
      const counter = defender.attack;
      damageMinion(defender, strength, false, events);
      if (counter > 0) damageHero(player, counter, events);
    }
    if (player.gear) {
      player.gear.durability--;
      if (player.gear.durability <= 0) {
        events.push({ type: 'gearBroken', seat: actor, gear: player.gear });
        player.gear = null;
      }
    }
    settle(next, events);
    return { state: next, events };
  }

  if (move.type === 'attack') {
    const attacker = player.board.find((m) => m.id === move.attackerId);
    if (!attacker) throw new Error('Angreifer existiert nicht');
    if (!canStrike(attacker)) {
      throw new Error('Tier kann nicht angreifen');
    }
    if (move.target.kind === 'hero' && heroOutOfReach(attacker)) {
      throw new Error('Ein Sprinter greift im ersten Zug nur Tiere an');
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
    attacker.attacksMade = (attacker.attacksMade ?? 0) + 1;
    attacker.hasAttacked = attacker.attacksMade >= (attacker.doubleStrike ? 2 : 1);
    events.push({ type: 'attack', attackerId: attacker.id, target });

    if (target.kind === 'hero') {
      strike(attacker, player, enemy, events);
    } else {
      const defender = enemy.board.find((m) => m.id === target.id);
      if (!defender) throw new Error('Verteidiger existiert nicht');
      if (defender.stealth) throw new Error('Verstecktes Tier kann nicht angegriffen werden');

      // Beide treffen gleichzeitig: Der Angriffswert ändert sich durch den Schlag nicht.
      strike(attacker, player, defender, events);
      strike(defender, enemy, attacker, events);
    }

    settle(next, events);
    return { state: next, events };
  }

  throw new Error('Unbekannter Zug');
}

const TRADE_COST = 1;

/** Nach dem Zugende: Wer gefallen ist, beendet die Partie, sonst ist der andere dran. */
function passTurn(state: DrachenspielState, events: GameEvent[]): void {
  delete state.turnEnding;
  if (state.phase !== 'play') return;
  startTurn(state, (1 - state.activeSeat) as SeatId, events);
  settle(state, events);
}

/** Ein Sprinter darf im ersten Zug nur Tiere angreifen. */
function heroOutOfReach(minion: Minion): boolean {
  return Boolean(minion.justPlayed && minion.sprinter && !minion.rush);
}

/** Zugende: Flüchtige Karten gehen, wer ausgesetzt hat, taut auf. Wer erst nach seinem Angriff erstarrte, bleibt starr. */
function endOwnTurn(player: PlayerState, events: GameEvent[]): void {
  player.hand = player.hand.filter((card) => {
    if (!card.fleeting) return true;
    events.push({ type: 'cardFaded', seat: player.seat, card });
    return false;
  });
  for (const minion of player.board) {
    if (minion.frozen && !minion.hasAttacked) delete minion.frozen;
  }
}

/** Erlaubte Angriffsziele auf dieser Seite: Beschützer gehen vor, Versteckte sind keines. */
function attackTargets(enemy: PlayerState): Array<{ kind: 'minion'; id: string } | { kind: 'hero' }> {
  const visible = enemy.board.filter((m) => !m.stealth);
  const guards = visible.filter((m) => m.taunt);
  if (guards.length > 0) return guards.map((m) => ({ kind: 'minion', id: m.id }));
  return [{ kind: 'hero' }, ...visible.map((m) => ({ kind: 'minion' as const, id: m.id }))];
}

/** Angriff des Helden in diesem Zug: Rüstzeug plus, was nur diesen Zug gilt. */
export function heroAttackValue(player: Pick<PlayerState, 'gear' | 'heroAttackBonus'>): number {
  return (player.gear?.attack ?? 0) + (player.heroAttackBonus ?? 0);
}

// ---------------------------------------------------------------------------
// Zauberkarten
// ---------------------------------------------------------------------------

/** Ziele beim Ausspielen. Ein Auftritt ohne mögliches Ziel verpufft, das Tier lässt sich trotzdem legen. */
export function cardTargets(state: DrachenspielState, seat: SeatId, def: CardDefinition): (SpellTarget | null)[] {
  const targets = spellTargets(state, seat, def.targeting ?? 'none');
  return !def.isSpell && targets.length === 0 ? [null] : targets;
}

/** Mögliche Ziele eines Zaubers; `null` steht für „ohne Ziel“. Versteckte Gegner sind kein Ziel. */
export function spellTargets(state: DrachenspielState, seat: SeatId, targeting: SpellTargeting): (SpellTarget | null)[] {
  const me = state.players[seat];
  const enemy = state.players[1 - seat];
  const enemyMinions = enemy.board.filter((m) => !m.stealth && !m.elusive).map((m): SpellTarget => ({ kind: 'minion', id: m.id }));
  switch (targeting) {
    case 'none':
      return [null];
    case 'enemyAny':
      return [{ kind: 'hero' }, ...enemyMinions];
    case 'enemyMinion':
      return enemyMinions;
    case 'ownMinion':
      return me.board.filter((m) => !m.elusive).map((m): SpellTarget => ({ kind: 'minion', id: m.id }));
  }
}

function sameTarget(a: SpellTarget | null, b: SpellTarget | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'hero' || b.kind === 'hero') return a.kind === b.kind;
  return a.id === b.id;
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
      armor: p.armor ?? 0,
      gear: p.gear ? { ...p.gear } : null,
      heroAttackBonus: p.heroAttackBonus ?? 0,
      heroAttacked: p.heroAttacked ?? false,
      power: p.power ?? null,
      powerUsed: p.powerUsed ?? false,
      mana: p.mana,
      maxMana: p.maxMana,
      deckCount: p.deck.length,
      handCount: p.hand.length,
      hand: isOwner ? p.hand.map((c) => ({ ...c })) : null,
      board: p.board.map((m) => ({ ...m })),
      fatigue: p.fatigue,
      overloadNext: p.overloadNext ?? 0,
      locked: p.locked ?? 0,
      cardsPlayedThisTurn: p.cardsPlayedThisTurn ?? 0,
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
    ...(state.pending ? { pending: { ...state.pending, count: state.pending.options.length, options: state.pending.seat === seat ? state.pending.options : [] } } : {}),
    options: { ...state.options },
  };
}

export function result(state: DrachenspielState): Result | null {
  const p0Dead = state.players[0].health <= 0;
  const p1Dead = state.players[1].health <= 0;
  if (p0Dead && p1Dead) {
    return { kind: 'draw', reason: 'Beide Helden sind gleichzeitig gefallen.' };
  }
  if (!p0Dead && !p1Dead) {
    return isOverTurnLimit(state) ? { kind: 'draw', reason: 'Die Zuggrenze ist erreicht.' } : null;
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
  if (state.pending) return { type: 'choose', index: 0 };
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
    queue: [],
    ...(view.pending ? { pending: samplePending(view.pending) } : {}),
    options: { ...view.options },
  };
}

/** Wer nicht wählt, kennt die Möglichkeiten nicht: Platzhalter ohne Wirkung halten nur die Anzahl. */
function samplePending({ count, ...pending }: PendingView): PendingChoice {
  return pending.options.length > 0 ? pending : { ...pending, options: Array.from({ length: count }, () => ({ label: '?', emoji: '❓', effects: [] })) };
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

  // Was schon offen liegt, ist nicht mehr verdeckt; die übrigen Karten werden ohne Zurücklegen verteilt.
  const remaining = [...pool];
  const seen = [...hv.board.map((m) => m.cardId), ...(isViewer && hv.hand ? hv.hand.map((c) => c.defId) : [])];
  for (const id of seen) {
    const at = remaining.indexOf(id);
    if (at >= 0) remaining.splice(at, 1);
  }
  const shuffled = rng.shuffle(remaining);
  const nextCard = (): CardInstance => ({ uid: `c_${nextId()}`, defId: shuffled.pop() ?? rng.pick(pool) });

  const hand: CardInstance[] = isViewer && hv.hand
    ? hv.hand.map((c) => ({ ...c }))
    : Array.from({ length: hv.handCount }, nextCard);

  const deck: CardInstance[] = Array.from({ length: hv.deckCount }, nextCard);

  return {
    seat: hv.seat,
    health: hv.health,
    maxHealth: hv.maxHealth,
    armor: hv.armor,
    gear: hv.gear ? { ...hv.gear } : null,
    heroAttackBonus: hv.heroAttackBonus,
    heroAttacked: hv.heroAttacked,
    power: hv.power,
    powerUsed: hv.powerUsed,
    mana: hv.mana,
    maxMana: hv.maxMana,
    deck,
    hand,
    board: hv.board.map((m) => ({ ...m })),
    fatigue: hv.fatigue,
    overloadNext: hv.overloadNext,
    locked: hv.locked,
    cardsPlayedThisTurn: hv.cardsPlayedThisTurn,
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
  score += (me.health + me.armor - opp.health - opp.armor) * 2;
  score += (me.gear ? me.gear.attack * me.gear.durability : 0) - (opp.gear ? opp.gear.attack * opp.gear.durability : 0);
  score += (me.hand.length - opp.hand.length) * 3;

  for (const m of me.board) {
    score += m.attack * 2 + m.health;
    if (m.taunt) score += 2;
    if (m.bubble) score += 2;
    if (m.stealth) score += 1;
    if (m.doubleStrike) score += m.attack;
    if (m.lifesteal) score += 1;
    if (m.reborn) score += 2;
    if (m.frozen) score -= m.attack;
  }

  for (const m of opp.board) {
    score -= m.attack * 2 + m.health;
    if (m.taunt) score -= 2;
    if (m.bubble) score -= 2;
    if (m.doubleStrike) score -= m.attack;
    if (m.lifesteal) score -= 1;
    if (m.reborn) score -= 2;
    if (m.frozen) score += m.attack;
  }

  return score;
}

export function eventView(event: GameEvent, seat: SeatId | 'spectator'): GameEvent | null {
  if (event.type === 'cardDrawn' || event.type === 'cardFaded') {
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
