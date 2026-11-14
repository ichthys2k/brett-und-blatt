import { describe, expect, it } from 'vitest';
import {
  BUB_COMBAT_CARD_NOTETYPE,
  BUB_COURT_CARD_NOTETYPE,
  BUB_QUARTETT_CARD_NOTETYPE,
  parseCustomCardCatalog,
  Rng,
  type AnkiCollection,
  type Options,
} from '../packages/engine/src';
import { gameModule as drachenspielModule } from '../packages/games/drachenspiel/src';
import { gameModule as quartettModule } from '../packages/games/quartett/src';
import { gameModule as colorSorterModule, scoreHand, modDef } from '../packages/games/color-sorter/src';

describe('Anki bearbeitete Kartenwerte im Spielbetrieb (K7, #277)', () => {
  it('Drachenspiel: Geänderte Manakosten, Angriff und Leben wirken auf Regeln und Spielfeld', () => {
    // Standard c53 (Silberfuchs) hat z.B. cost 2, attack 2, health 3.
    // Wir übersteuern per Anki-Notiz: cost: 1, attack: 10, health: 12, Keywords: Spott
    const col: AnkiCollection = {
      v: 2,
      notetypes: [BUB_COMBAT_CARD_NOTETYPE],
      decks: [],
      notes: [
        {
          id: 1,
          guid: 'bub-combat-c53',
          mid: BUB_COMBAT_CARD_NOTETYPE.id,
          did: 1,
          mod: 0,
          tags: ['drachenspiel'],
          fields: [
            'c53', // Kennung
            'Titan-Fuchs', // Name
            'Begleiter', // Kartenart
            'wald', // Klasse
            'common', // Seltenheit
            '1', // Kosten (auf 1 gesenkt)
            '10', // Angriff (auf 10 erhöht)
            '12', // Leben (auf 12 erhöht)
            'Tiere', // Stamm
            'Spott', // Schluesselwoerter
            '', '', '🦊', '', '{}',
          ],
          flags: 0,
          data: '',
        },
      ],
      graves: [],
    };

    const catalog = parseCustomCardCatalog(col);
    expect(catalog.checksum).toBeTruthy();

    const options: Options = {
      deckSelection: 'forest',
      mulligan: 'off',
      customCardCatalog: JSON.stringify(catalog),
    };

    const state = drachenspielModule.setup(2, options, 'seed-drache');
    expect(state.cardCatalogChecksum).toBe(catalog.checksum);

    // Aktiver Spieler spielt c53 für 1 Mana
    state.players[state.activeSeat].mana = 1;
    state.players[state.activeSeat].hand = [{ uid: 'c_test_1', defId: 'c53' }];

    const legal = drachenspielModule.legalMoves(state, state.activeSeat);
    const playMove = legal.find((m) => m.type === 'playCard');
    expect(playMove).toBeDefined();

    const result = drachenspielModule.applyMove(state, state.activeSeat, playMove!);
    const playedMinion = result.state.players[state.activeSeat].board[0];
    expect(playedMinion).toBeDefined();
    expect(playedMinion?.name).toBe('Titan-Fuchs');
    expect(playedMinion?.cost).toBe(1);
    expect(playedMinion?.attack).toBe(10);
    expect(playedMinion?.health).toBe(12);
    expect(playedMinion?.taunt).toBe(true);
  });

  it('Quartett: Modifizierte Eigenschaftswerte entscheiden Trumpf-Stiche', () => {
    // Tiere Set: A1 (Löwe) hat normalerweise z.B. 250 kg Gewicht.
    // Wir modifizieren A1 in Anki auf 999 kg, sodass er jede andere Karte schlägt.
    const col: AnkiCollection = {
      v: 2,
      notetypes: [BUB_QUARTETT_CARD_NOTETYPE],
      decks: [],
      notes: [
        {
          id: 2,
          guid: 'bub-quartett-tiere-A1',
          mid: BUB_QUARTETT_CARD_NOTETYPE.id,
          did: 1,
          mod: 0,
          tags: ['quartett', 'tiere'],
          fields: [
            'tiere:A1', // Kennung
            'Tiere', // SetName
            'A', // GruppeCode
            'Katzen', // GruppeName
            'Riesen-Löwe', // Name
            '🦁', // Bild
            'Gewicht', '999999', 'kg', 'true',
            '', '', '', '',
            '', '', '', '',
            '', '', '', '',
            '', '', '', '',
            '', '', '', '',
            '', '', '{}',
          ],
          flags: 0,
          data: '',
        },
      ],
      graves: [],
    };

    const catalog = parseCustomCardCatalog(col);

    const options: Options = {
      set: 'tiere',
      mode: 'trump',
      customCardCatalog: JSON.stringify(catalog),
    };

    const state = quartettModule.setup(2, options, 'seed-quartett');
    expect(state.cardCatalogChecksum).toBe(catalog.checksum);
    expect(state.customCardSet).toBeDefined();

    const a1Card = state.customCardSet?.cards.find((c) => c.id === 'A1');
    expect(a1Card?.name).toBe('Riesen-Löwe');
    expect(a1Card?.values.weight).toBe(999999);

    // Platz 0 hat A1 oben, wählt Gewicht -> muss gewinnen
    state.stacks[0] = [{ card: 'A1', open: false }];
    state.stacks[1] = [{ card: 'A2', open: false }]; // Normales Tier
    state.turn = 0;

    const res = quartettModule.applyMove(state, 0, { type: 'chooseProperty', property: 'weight' });
    expect(res.state.lastTrick?.winner).toBe(0);
  });

  it('Narrenhof: In Anki modifizierter Multiplikator und Basiswert wirken in scoreHand', () => {
    // Narr 'clown' erhält custom baseChips: 50 und multiplier: 3
    const col: AnkiCollection = {
      v: 2,
      notetypes: [BUB_COURT_CARD_NOTETYPE],
      decks: [],
      notes: [
        {
          id: 3,
          guid: 'bub-court-narrenhof-clown',
          mid: BUB_COURT_CARD_NOTETYPE.id,
          did: 1,
          mod: 0,
          tags: ['narrenhof'],
          fields: [
            'narrenhof:clown', // Kennung
            'narrenhof',
            'Narr',
            'Super-Clown',
            'common',
            '5', // Kaufpreis
            '50', // Basiswert
            'x3', // Multiplikator
            '', '', '', '🤡', '', '{}',
          ],
          flags: 0,
          data: '',
        },
      ],
      graves: [],
    };

    const catalog = parseCustomCardCatalog(col);
    expect(catalog.courtCards.clown?.baseChips).toBe(50);
    expect(catalog.courtCards.clown?.multiplier).toBe(3);

    const state = colorSorterModule.setup(1, { customCardCatalog: JSON.stringify(catalog) }, 'seed-sorter');
    expect(state.cardCatalogChecksum).toBe(catalog.checksum);
    expect(state.customMods?.clown?.baseChips).toBe(50);

    const def = modDef('clown', state.customMods);
    expect(def.baseChips).toBe(50);
    expect(def.multiplier).toBe(3);

    const run = state.runs[0]!;
    run.mods = [{ uid: 1, key: 'clown' }];

    // Eine einfache Hand aus 5 Karten werten
    const cards = run.deck.slice(0, 5);
    const scoreResult = scoreHand(run, cards, [], new Rng(run.rng.fx));

    // Durch die 50 Zusatz-Chips und x3 Multiplikator muss der Score deutlich höher ausfallen
    expect(scoreResult.score).toBeGreaterThan(150);
  });
});
