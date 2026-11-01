import { Rng, type BotLevel, type SeatId } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { gameModule } from '../src';
import { CARDS_DB } from '../src/cards';
import { deckProblems, decodeDeck, encodeDeck } from '../src/deckcode';
import { arenaHouses, arenaOffer, arenaOver, BOOK_TASKS, emptyBook, lootOffer, mergeBooks, recordPlay, runDeckCode, sanitizeBook, startArena, startRun, takeLoot, taskDone, treasureOffer, type Book } from '../src/modes/progress';
import { LESSONS, RUN_FOES, scenarioFrom, TREASURES } from '../src/modes/scenarios';
import { mergeDecks, sanitizeDecks } from '../src/ui/deckStore';

function finish(options: Record<string, string>, seed: string, level: BotLevel = 'medium') {
  let state = gameModule.setup(2, options, seed);
  for (let step = 0; step < 1500 && !gameModule.result(state); step++) {
    const seat = gameModule.currentPlayers(state)[0] as SeatId;
    const move = gameModule.bots[0]!.chooseMove({ module: gameModule, view: gameModule.playerView(state, seat), seat, level, rng: Rng.fromSeed(`${seed}/${step}`), timeBudgetMs: 40, now: () => Date.now() });
    state = gameModule.applyMove(state, seat, move).state;
  }
  return state;
}
const play = (id: string, won: boolean, scenario = '', extra = {}) => ({ playId: id, scenario, won, house: 'farm' as const, custom: false, now: 5, ...extra });

describe('Übungsweg', () => {
  it('jede Lektion hat Hinweise und gültige Karten, beginnt mit dem Menschen und ist gegen den leichten Bot gewinnbar', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(6);
    for (const lesson of LESSONS) {
      expect(lesson.tips.length, lesson.id).toBeGreaterThan(0);
      for (const side of [lesson.scenario.me, lesson.scenario.enemy]) for (const id of [...side.deck, ...(side.board ?? []), ...(side.hand ?? [])]) expect(CARDS_DB[id], `${lesson.id}: ${id}`).toBeDefined();
      const options = { scenario: `lesson-${lesson.id}`, mulligan: 'off' };
      const start = gameModule.setup(2, options, 'x');
      expect(start.phase).toBe('play');
      expect(start.activeSeat).toBe(0);
      expect(start.players[0].mana).toBe(lesson.scenario.me.mana ?? 1);
      if (lesson.scenario.enemy.health) expect(start.players[1].health).toBe(lesson.scenario.enemy.health);
      expect(start.players[1].armor).toBe(0);
      let wins = 0;
      for (let i = 0; i < 6; i++) if (gameModule.result(finish(options, `${lesson.id}${i}`, 'hard'))?.kind === 'win' && finish(options, `${lesson.id}${i}`, 'hard').players[1].health <= 0) wins++;
      expect(wins, lesson.id).toBeGreaterThan(0);
    }
  }, 120000);

  it('die feste Starthand und das Feld stimmen, eigene Tiere dürfen sofort los', () => {
    const start = gameModule.setup(2, { scenario: 'lesson-trade' }, 'x');
    expect(start.players[0].board.map((m) => m.cardId)).toEqual(['n_heron', 'n_bison']);
    expect(gameModule.legalMoves(start, 0).some((m) => m.type === 'attack')).toBe(true);
    const mana = gameModule.setup(2, { scenario: 'lesson-mana' }, 'x');
    expect(mana.players[0].hand.slice(0, 3).map((c) => c.defId)).toEqual(['c7', 'n_kobold', 'n_crow']);
  });

  it('die Lerndecks greifen nicht vor: Bis zur letzten Lektion nachgezogene Karten haben keine Wahl und keinen Zauber', () => {
    for (const lesson of LESSONS.slice(0, -1)) {
      for (const id of lesson.scenario.me.deck) {
        const def = CARDS_DB[id]!;
        expect(def.isSpell || def.triggers?.length || def.quest || def.dormant || def.building, `${lesson.id}: ${id}`).toBeFalsy();
      }
    }
  });

  it('eine unbekannte Lektion ergibt eine gewöhnliche Partie', () => {
    expect(scenarioFrom({ scenario: 'lesson-gibtsnicht' })).toBeNull();
    expect(gameModule.setup(2, { scenario: 'quatsch' }, 'x').phase).toBe('deckSelection');
  });
});

describe('Wanderschaft', () => {
  const run = () => startRun('farm', 'lauf');

  it('beginnt mit 15 erlaubten Karten, jeder Gegner lässt sich starten und die Gegner werden stärker', () => {
    expect(run().cards).toHaveLength(15);
    expect(deckProblems('farm', [...run().cards]).filter((p) => !p.includes('Karten.'))).toEqual([]);
    for (let i = 0; i < RUN_FOES.length; i++) {
      const s = gameModule.setup(2, { scenario: `run-${i}`, deckCode: runDeckCode(run()) }, 'x');
      expect(s.players[1].health).toBe(RUN_FOES[i]!.health);
      expect(s.players[0].power).toBe('farm');
      for (const id of RUN_FOES[i]!.board ?? []) expect(CARDS_DB[id], id).toBeDefined();
    }
    expect(RUN_FOES).toHaveLength(8);
    expect(RUN_FOES.map((f) => f.health)).toEqual([...RUN_FOES.map((f) => f.health)].sort((a, b) => a - b));
  });

  it('Sieg führt zur Beute, die Beute ist fest, das Deck wächst, Schatz nur an festen Stellen', () => {
    let book: Book = { ...emptyBook(), run: run() };
    book = recordPlay(book, play('a', true, 'run-0'));
    expect(book.run).toMatchObject({ fight: 1, awaitingLoot: true });
    expect(lootOffer(book.run!)).toEqual(lootOffer(book.run!));
    expect(lootOffer(book.run!)).toHaveLength(3);
    expect(treasureOffer(book.run!)).toEqual([]);
    const after = takeLoot(book.run!, 1, null);
    expect(after.cards).toHaveLength(18);
    expect(after.awaitingLoot).toBe(false);
    expect(treasureOffer({ ...after, fight: 2 })).toHaveLength(3);
  });

  it('Niederlage beendet den Lauf, ein falscher oder doppelter Kampf zählt nicht', () => {
    let book: Book = { ...emptyBook(), run: run() };
    expect(recordPlay(book, play('a', true, 'run-4')).run?.fight).toBe(0);
    book = recordPlay(book, play('b', false, 'run-0'));
    expect(book.run?.over).toBe('lost');
    expect(recordPlay(book, play('b', true, 'run-0'))).toBe(book);
    expect(recordPlay(book, play('c', true, 'run-0')).run?.over).toBe('lost');
  });

  it('der letzte Sieg beendet den Lauf als gewonnen', () => {
    const book = recordPlay({ ...emptyBook(), run: { ...run(), fight: 7 } }, play('z', true, 'run-7'));
    expect(book.run?.over).toBe('won');
    expect(book.stats.runsWon).toBe(1);
  });

  it('Schätze wirken beim Kampfstart', () => {
    const treasures = TREASURES.map((t) => t.id).join(',');
    const s = gameModule.setup(2, { scenario: 'run-0', deckCode: runDeckCode(run()), treasures }, 'x');
    expect(s.players[0].health).toBe(35);
    expect(s.players[0].armor).toBe(5);
    expect(s.players[0].mana).toBe(2);
    expect(s.players[0].board.map((m) => m.cardId)).toEqual(['token_chick', 'token_ant', 'token_ant', 'c4']);
  });

  it('der Bot spielt einen ganzen Kampf durch und bestimmt seine Stärke aus dem Szenario', () => {
    expect(gameModule.result(finish({ scenario: 'run-7', deckCode: runDeckCode(run()) }, 'k'))).not.toBeNull();
    expect(scenarioFrom({ scenario: 'run-0', deckCode: runDeckCode(run()) })!.level).toBe('easy');
    expect(scenarioFrom({ scenario: 'run-7', deckCode: runDeckCode(run()) })!.level).toBe('hard');
  });
});

describe('Turnier', () => {
  it('Kartenwahl ergibt ein gültiges Deck aus 30 Karten, fest und ohne Überschreiten der Kopien', () => {
    let arena = startArena('t');
    expect(arenaHouses(arena)).toHaveLength(3);
    arena = { ...arena, house: arenaHouses(arena)[0]! };
    for (let i = 0; i < 30; i++) {
      const offer = arenaOffer(arena);
      expect(offer).toEqual(arenaOffer(arena));
      expect(offer).toHaveLength(3);
      arena = { ...arena, cards: [...arena.cards, offer[0]!] };
    }
    expect(deckProblems(arena.house!, arena.cards)).toEqual([]);
    expect(arenaOffer(arena)).toEqual([]);
    const code = encodeDeck(arena.house!, arena.cards);
    expect(decodeDeck(code)).not.toBeNull();
    expect(scenarioFrom({ scenario: 'arena-3-sea', deckCode: code })).toMatchObject({ level: 'hard' });
  });

  it('endet bei 5 Siegen oder 2 Niederlagen', () => {
    let book: Book = { ...emptyBook(), arena: { ...startArena('t'), house: 'farm' } };
    book = recordPlay(book, play('a', false, 'arena-0-sea'));
    expect(arenaOver(book.arena!)).toBe(false);
    book = recordPlay(book, play('b', false, 'arena-0-sea'));
    expect(arenaOver(book.arena!)).toBe(true);
    book = recordPlay(book, play('c', true, 'arena-0-sea'));
    expect(book.arena!.wins).toBe(0);
  });
});

describe('Turnierbuch und Sicherung', () => {
  it('zählt jede Partie einmal und merkt sich Häuser, eigene Decks und Lektionen', () => {
    let book = recordPlay(emptyBook(), play('a', true, '', { custom: true }));
    book = recordPlay(book, play('a', true, '', { custom: true }));
    book = recordPlay(book, play('b', false));
    book = recordPlay(book, play('c', true, 'lesson-mana', { house: 'forest' }));
    expect(book.stats).toMatchObject({ wins: 2, customWins: 1, winsByHouse: { farm: 1, forest: 1 } });
    expect(book.lessons).toEqual(['mana']);
    expect(taskDone(BOOK_TASKS.find((t) => t.id === 'baumeister')!, book)).toBe(true);
  });

  it('Belohnungen sind nur Rahmen und Wappen', () => {
    expect(BOOK_TASKS.every((t) => t.reward.kind === 'frame' || t.reward.kind === 'crest')).toBe(true);
  });

  it('Zusammenführen behält Bestwerte, Lektionen und nimmt den jüngsten Lauf, in beide Richtungen gleich', () => {
    const a: Book = { ...emptyBook(), lessons: ['mana'], run: startRun('farm', 'alt'), updatedAt: 1, stats: { ...emptyBook().stats, wins: 4, bestArena: 1 } };
    const b: Book = { ...emptyBook(), lessons: ['trade'], run: startRun('sea', 'neu'), updatedAt: 9, stats: { ...emptyBook().stats, wins: 2, bestArena: 3 } };
    for (const m of [mergeBooks(a, b), mergeBooks(b, a)]) {
      expect(m.stats).toMatchObject({ wins: 4, bestArena: 3 });
      expect(m.lessons.sort()).toEqual(['mana', 'trade']);
      expect(m.run?.seed).toBe('neu');
    }
  });

  it('fremde Daten werden bereinigt, eine Sicherung aus Phase 8 ohne Buch bleibt lesbar', () => {
    expect(sanitizeBook({ stats: { wins: 'x', bestRunFight: 99 }, lessons: ['böse'], run: { house: 'mond', seed: 's' }, plays: [1] })).toMatchObject({ stats: { wins: 0, bestRunFight: 8 }, lessons: [], run: null, plays: [] });
    const old = sanitizeDecks({ decks: {} });
    expect(old.book?.stats.wins).toBe(0);
    expect(mergeDecks(old, { decks: {} }).book?.stats.wins).toBe(0);
  });

  it('auch mit vollem Lauf und Turnier bleibt das Buch klein', () => {
    const book: Book = { ...emptyBook(), run: { ...startRun('farm', 'x'), cards: Array(40).fill('farm_coldblood') }, arena: { ...startArena('y'), house: 'farm', cards: Array(30).fill('farm_coldblood') }, plays: Array.from({ length: 60 }, (_, i) => `${'p'.repeat(20)}${i}`) };
    expect(JSON.stringify(sanitizeBook(book)).length).toBeLessThan(4000);
  });
});
