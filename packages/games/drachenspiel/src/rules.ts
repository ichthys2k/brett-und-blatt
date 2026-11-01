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
import { BOARD_LIMIT, MAX_MANA, createMinion, damageHero, damageMinion, drawCard, enqueue, enqueuePlayed, isOverTurnLimit, refreshStats, settle } from './core/effects';
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
    queue: [],
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

  player.maxMana = Math.min(MAX_MANA, player.maxMana + 1);
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
        if (def.isSpell) {
          for (const target of spellTargets(state, actor, def.targeting ?? 'none')) {
            moves.push(target ? { type: 'playCard', handIndex: i, target } : { type: 'playCard', handIndex: i });
          }
        } else if (player.board.length < BOARD_LIMIT) {
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
    settle(next, events);
    return { state: next, events };
  }

  if (move.type === 'playCard') {
    const card = player.hand[move.handIndex];
    if (!card) throw new Error('Karte nicht vorhanden');
    const def = CARDS_DB[card.defId];
    if (!def) throw new Error('Unbekannte Karte');
    if (def.cost > player.mana) throw new Error('Nicht genug Mana');

    if (def.isSpell) {
      const target = move.target ?? null;
      if (!spellTargets(next, actor, def.targeting ?? 'none').some((t) => sameTarget(t, target))) {
        throw new Error('Ungültiges Ziel für den Zauber');
      }
      player.mana -= def.cost;
      player.hand.splice(move.handIndex, 1);
      events.push({ type: 'spellCast', seat: actor, card, target });
      enqueue(next, def.effects, actor, def.id, null, target);
      settle(next, events);
      return { state: next, events };
    }

    if (player.board.length >= BOARD_LIMIT) throw new Error('Spielfeld voll');

    player.mana -= def.cost;
    player.hand.splice(move.handIndex, 1);

    const minion = createMinion(next, def, actor);
    player.board.push(minion);
    events.push({ type: 'cardPlayed', seat: actor, card, minion });
    enqueuePlayed(next, minion, actor);
    settle(next, events);
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
      damageHero(enemy, attacker.attack, events);
    } else {
      const defender = enemy.board.find((m) => m.id === target.id);
      if (!defender) throw new Error('Verteidiger existiert nicht');
      if (defender.stealth) throw new Error('Verstecktes Tier kann nicht angegriffen werden');

      // Beide treffen gleichzeitig mit dem Angriffswert von vor dem Schlag.
      const dmgToDefender = attacker.attack;
      const dmgToAttacker = defender.attack;
      damageMinion(defender, dmgToDefender, attacker.poisonous, events);
      damageMinion(attacker, dmgToAttacker, defender.poisonous, events);
    }

    settle(next, events);
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
