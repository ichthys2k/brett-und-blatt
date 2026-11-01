import { Rng, isLegalMove } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { drachenspiel, gameModule } from '../src';
import { buildableCards, decodeDeck, DECK_CODE_MAX, DECK_CODE_PATTERN, deckProblems, encodeDeck, fillDeck, parseDeckCode, PRESET_DECKS } from '../src/deckcode';
import { DECK_THEME_IDS, themeCardIds } from '../src/decks';
import { mergeDecks, sanitizeDecks, type DeckStore } from '../src/ui/deckStore';

const pick = (rng: Rng) => (size: number) => rng.int(size);
const legalDeck = (seed = 'd') => fillDeck('forest', [], pick(Rng.fromSeed(seed)));

describe('Deck-Regeln', () => {
  it('erlauben 30 Karten aus einem Haus und neutrale, höchstens zwei Kopien, Sagentiere einmal', () => {
    const deck = legalDeck();
    expect(deck).toHaveLength(30);
    expect(deckProblems('forest', deck)).toEqual([]);
    expect(deckProblems('forest', deck.slice(1))[0]).toContain('29');
    expect(deckProblems('forest', [...deck.slice(3), 'f_jay', 'f_jay', 'f_jay']).join()).toContain('höchstens 2');
    expect(deckProblems('forest', [...deck.slice(2), 'f_grimbart', 'f_grimbart']).join()).toContain('höchstens 1');
    expect(deckProblems('forest', [...deck.slice(1), 'sea_seal']).join()).toContain('anderen Haus');
    expect(deckProblems('forest', [...deck.slice(1), 'token_chick']).join()).toContain('nicht im Deckbau');
    expect(deckProblems('forest', [...deck.slice(1), 'special_star']).join()).toContain('nicht im Deckbau');
    expect(deckProblems('forest', [...deck.slice(1), 'gibtsnicht']).join()).toContain('nicht im Deckbau');
  });

  it('jedes Haus kann alle Karten frei nutzen, ohne Spielsteine', () => {
    for (const house of DECK_THEME_IDS) {
      const cards = buildableCards(house);
      expect(cards.length).toBeGreaterThan(50);
      expect(cards.every((def) => !def.token && (def.house === house || def.house === 'neutral'))).toBe(true);
    }
  });

  it('Auffüllen ergibt immer ein gültiges Deck und behält die gewählten Karten', () => {
    for (const house of DECK_THEME_IDS) {
      for (let i = 0; i < 20; i++) {
        const start = buildableCards(house).slice(0, i % 5).map((def) => def.id);
        const deck = fillDeck(house, start, pick(Rng.fromSeed(`${house}${i}`)));
        expect(deckProblems(house, deck), `${house}${i}`).toEqual([]);
        for (const id of start) expect(deck).toContain(id);
      }
    }
  });

  it('der Code übersteht Hin und Zurück, unabhängig von der Reihenfolge, und passt in die Grenzen', () => {
    for (const house of DECK_THEME_IDS) {
      const deck = themeCardIds(house, true);
      const code = encodeDeck(house, deck);
      expect(code.length).toBeLessThan(DECK_CODE_MAX);
      expect(code).toMatch(new RegExp(`^${DECK_CODE_PATTERN}$`));
      expect(decodeDeck(code)!.cardIds.sort()).toEqual([...deck].sort());
      expect(encodeDeck(house, [...deck].reverse())).toBe(code);
      expect(parseDeckCode(code)?.house).toBe(house);
    }
  });

  it('lehnt kaputte oder unerlaubte Codes ab', () => {
    for (const bad of ['', 'forest', 'mond:c1*30', 'forest:c1*30', 'forest:c7*0', 'forest:<script>', 'forest:c7*99', `forest:${'c7,'.repeat(400)}c7`]) expect(parseDeckCode(bad), bad).toBeNull();
  });

  it('alle Vorschlagsdecks sind gültig, je Haus eines', () => {
    expect(PRESET_DECKS.map((p) => p.house).sort()).toEqual([...DECK_THEME_IDS].sort());
    for (const preset of PRESET_DECKS) expect(deckProblems(preset.house, decodeDeck(preset.code)!.cardIds), preset.name).toEqual([]);
  });
});

describe('Eigenes Deck im Spiel', () => {
  const start = () => drachenspiel.setup(2, { deckSelection: 'inGame', mulligan: 'off' }, 'bau');
  const code = encodeDeck('forest', legalDeck());

  it('gilt nur mit gültigem Code zum genannten Haus', () => {
    const s = start();
    expect(isLegalMove(gameModule, s, 0, { type: 'chooseDeck', deck: 'forest', code })).toBe(true);
    expect(isLegalMove(gameModule, s, 0, { type: 'chooseDeck', deck: 'sea', code })).toBe(false);
    expect(isLegalMove(gameModule, s, 0, { type: 'chooseDeck', deck: 'forest', code: 'forest:c7*2' })).toBe(false);
    expect(isLegalMove(gameModule, s, 0, { type: 'chooseDeck', deck: 'forest', code: 5 as unknown as string })).toBe(false);
    expect(isLegalMove(gameModule, s, 0, { type: 'chooseDeck', deck: 'forest' })).toBe(true);
    expect(() => drachenspiel.applyMove(s, 0, { type: 'chooseDeck', deck: 'forest', code: 'forest:c7*2' })).toThrow();
  });

  it('das Deck enthält genau diese Karten, die Hauskraft stimmt, der Gegner sieht es nicht', () => {
    let s = drachenspiel.applyMove(start(), 0, { type: 'chooseDeck', deck: 'forest', code }).state;
    const res = drachenspiel.applyMove(s, 1, { type: 'chooseDeck', deck: 'sea' });
    s = res.state;
    const own = [...s.players[0].deck, ...s.players[0].hand].map((c) => c.defId).filter((id) => id !== 'special_star').sort();
    expect(own).toEqual(decodeDeck(code)!.cardIds.sort());
    expect(s.players[0].power).toBe('forest');
    expect(drachenspiel.playerView(s, 0).players[0].customDeck).toHaveLength(30);
    expect(drachenspiel.playerView(s, 1).players[0].customDeck).toBeNull();
    expect(JSON.stringify(res.events)).not.toContain('f_');
  });

  it('der Bot rechnet beim eigenen Deck damit und die Partie läuft durch', () => {
    let s = drachenspiel.setup(2, { deckSelection: 'code', deckCode: code, mulligan: 'off' }, 'klasse');
    expect(s.players[0].deckTheme).toBe('forest');
    expect(s.players[1].customDeck).toHaveLength(30);
    for (let step = 0; step < 1200 && !gameModule.result(s); step++) {
      const seat = gameModule.currentPlayers(s)[0] as 0 | 1;
      const move = gameModule.bots[0]!.chooseMove({ module: gameModule, view: gameModule.playerView(s, seat), seat, level: 'medium', rng: Rng.fromSeed(`b${step}`), timeBudgetMs: 30, now: () => Date.now() });
      s = gameModule.applyMove(s, seat, move).state;
    }
    expect(gameModule.result(s)).not.toBeNull();
  });

  it('ein ungültiger vorgegebener Code führt zur Wahl im Spiel', () => {
    expect(drachenspiel.setup(2, { deckSelection: 'code', deckCode: 'kaputt', mulligan: 'off' }, 'x').phase).toBe('deckSelection');
    expect(drachenspiel.setup(2, { deckSelection: 'code', mulligan: 'off' }, 'x').phase).toBe('deckSelection');
  });
});

describe('Decks zusammenführen', () => {
  const code = encodeDeck('forest', legalDeck());
  const deck = (id: string, updatedAt: number, name = id) => ({ id, name, code, updatedAt });

  it('die jüngste Änderung gewinnt, in beide Richtungen gleich', () => {
    const a: DeckStore = { decks: { x: deck('x', 5, 'alt'), y: deck('y', 1) } };
    const b: DeckStore = { decks: { x: deck('x', 9, 'neu'), z: deck('z', 2) } };
    expect(mergeDecks(a, b).decks.x!.name).toBe('neu');
    expect(mergeDecks(b, a).decks.x!.name).toBe('neu');
    expect(Object.keys(mergeDecks(a, b).decks).sort()).toEqual(['x', 'y', 'z']);
  });

  it('ein Löschvermerk hält ein Deck fern, eine spätere Änderung holt es zurück', () => {
    const gone: DeckStore = { decks: { x: { id: 'x', name: '', code: '', updatedAt: 7, deleted: true } } };
    expect(mergeDecks(gone, { decks: { x: deck('x', 5) } }).decks.x!.deleted).toBe(true);
    expect(mergeDecks({ decks: { x: deck('x', 5) } }, gone).decks.x!.deleted).toBe(true);
    expect(mergeDecks(gone, { decks: { x: deck('x', 8) } }).decks.x!.deleted).toBeUndefined();
  });

  it('fremde Daten werden bereinigt, die Menge begrenzt und der Block bleibt unter 64 KB', () => {
    expect(sanitizeDecks(null).decks).toEqual({});
    expect(sanitizeDecks({ decks: { 'BÖSE!': deck('a', 1), b: { updatedAt: 'x' }, c: { code: '<b>', updatedAt: 1 } } }).decks).toEqual({});
    const full = code + ',' ;
    const many = Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`d${i}`, i % 2 ? { ...deck(`d${i}`, i, 'N'.repeat(30)), code: full.slice(0, -1) } : { id: `d${i}`, name: '', code: '', updatedAt: i, deleted: true }]));
    const clean = sanitizeDecks({ decks: many });
    expect(Object.values(clean.decks).filter((d) => !d.deleted).length).toBeLessThanOrEqual(80);
    // Base64 macht rund ein Drittel mehr daraus.
    expect((JSON.stringify(clean).length * 4) / 3).toBeLessThan(64 * 1024);
  });
});
