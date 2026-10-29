import { describe, expect, it } from 'vitest';
import {
  cardEyePoints,
  cardId,
  cardSuit,
  Rng,
  createDokoContract,
  createSchafkopfContract,
  createSkatContract,
  dealUnknown,
  knownVoids,
  legalCards,
  nullDangerSuits,
  trickPoints,
  trickWinner,
  winsAllTricks,
  type PlayedCard,
} from '../src/index.js';

describe('Augenpunkte', () => {
  it('wertet Standardkarten nach ISkO / Schafkopf / Doko korrekt aus', () => {
    expect(cardEyePoints(cardId('H', 1))).toBe(11); // Ass
    expect(cardEyePoints(cardId('C', 10))).toBe(10); // 10
    expect(cardEyePoints(cardId('S', 13))).toBe(4); // König
    expect(cardEyePoints(cardId('D', 12))).toBe(3); // Dame/Ober
    expect(cardEyePoints(cardId('C', 11))).toBe(2); // Bube/Unter
    expect(cardEyePoints(cardId('H', 9))).toBe(0); // 9
    expect(cardEyePoints(cardId('S', 8))).toBe(0); // 8
    expect(cardEyePoints(cardId('D', 7))).toBe(0); // 7

    const trick: PlayedCard[] = [
      { player: 0, card: cardId('H', 1) }, // 11
      { player: 1, card: cardId('C', 10) }, // 10
      { player: 2, card: cardId('S', 13) }, // 4
      { player: 3, card: cardId('D', 11) }, // 2
    ];
    expect(trickPoints(trick)).toBe(27);
  });
});

describe('Skat-Verträge', () => {
  it('Grand: Buben sind Trumpf, Kreuz sticht Pik, Fehlfarbe muss bedient werden', () => {
    const contract = createSkatContract('grand');

    expect(contract.isTrump(cardId('C', 11))).toBe(true);
    expect(contract.isTrump(cardId('D', 11))).toBe(true);
    expect(contract.isTrump(cardId('H', 1))).toBe(false);

    // Kreuz-Bube sticht Pik-Bube
    const trick: PlayedCard[] = [
      { player: 0, card: cardId('S', 11) }, // Pik-Bube
      { player: 1, card: cardId('C', 11) }, // Kreuz-Bube
      { player: 2, card: cardId('H', 1) }, // Herz-Ass
    ];
    expect(trickWinner(trick, contract)).toEqual({ player: 1, card: cardId('C', 11) });
  });

  it('Farbspiel Herz: Buben + Herz sind Trumpf', () => {
    const contract = createSkatContract('suit', 'H');

    expect(contract.isTrump(cardId('D', 11))).toBe(true); // Karo-Bube ist Trumpf
    expect(contract.isTrump(cardId('H', 7))).toBe(true); // Herz 7 ist Trumpf
    expect(contract.isTrump(cardId('C', 1))).toBe(false); // Kreuz Ass ist kein Trumpf

    // Karo-Bube sticht Herz-Ass
    const trick: PlayedCard[] = [
      { player: 0, card: cardId('H', 1) }, // Herz-Ass
      { player: 1, card: cardId('D', 11) }, // Karo-Bube (niedrigster Bube, aber Bube > Ass)
      { player: 2, card: cardId('H', 10) }, // Herz-10
    ];
    expect(trickWinner(trick, contract).player).toBe(1);
  });

  it('Bedienpflicht: muss Trumpf bedienen wenn Trumpf angespielt wird', () => {
    const contract = createSkatContract('suit', 'H');
    const trick: PlayedCard[] = [{ player: 0, card: cardId('S', 11) }]; // Pik-Bube (Trumpf!)
    const hand = [cardId('C', 1), cardId('H', 8), cardId('D', 7)];

    // Spieler hat H8 (Trumpf). Muss Trumpf bedienen!
    const allowed = legalCards(hand, trick, contract);
    expect(allowed).toEqual([cardId('H', 8)]);
  });

  it('Null-Spiel: kein Trumpf, 7..Ass', () => {
    const contract = createSkatContract('null');
    const trick: PlayedCard[] = [
      { player: 0, card: cardId('C', 8) },
      { player: 1, card: cardId('C', 7) },
      { player: 2, card: cardId('C', 11) }, // Bube
    ];
    // Im Null sticht die 11 die 8, nicht die 7
    expect(trickWinner(trick, contract).player).toBe(2);
  });
});

describe('Schafkopf-Verträge', () => {
  it('Sauspiel: Ober > Unter > Herz', () => {
    const contract = createSchafkopfContract('sauspiel');

    expect(contract.isTrump(cardId('C', 12))).toBe(true); // Eichel-Ober
    expect(contract.isTrump(cardId('D', 11))).toBe(true); // Schellen-Unter
    expect(contract.isTrump(cardId('H', 7))).toBe(true); // Herz 7

    const trick: PlayedCard[] = [
      { player: 0, card: cardId('H', 1) }, // Herz Sau
      { player: 1, card: cardId('D', 11) }, // Schellen-Unter
      { player: 2, card: cardId('C', 12) }, // Eichel-Ober
      { player: 3, card: cardId('S', 12) }, // Gras-Ober
    ];
    expect(trickWinner(trick, contract).player).toBe(2); // Eichel-Ober sticht
  });

  it('Wenz: Nur Unter sind Trumpf', () => {
    const contract = createSchafkopfContract('wenz');

    expect(contract.isTrump(cardId('C', 11))).toBe(true); // Unter
    expect(contract.isTrump(cardId('C', 12))).toBe(false); // Ober ist KEIN Trumpf!

    // In Fehlfarbe steht Ober zwischen König und 9
    const trick: PlayedCard[] = [
      { player: 0, card: cardId('S', 13) }, // Gras König (Power 12)
      { player: 1, card: cardId('S', 12) }, // Gras Ober (Power 11)
      { player: 2, card: cardId('S', 1) }, // Gras Sau (Power 14)
    ];
    expect(trickWinner(trick, contract).player).toBe(2);
  });
});

describe('Doppelkopf-Verträge', () => {
  it('Normalspiel: Dulle (H10) > Damen > Buben > Karo; bei gleichen Karten sticht die erste', () => {
    const contract = createDokoContract('normal');

    expect(contract.isTrump(cardId('H', 10, 1))).toBe(true); // Dulle
    expect(contract.isTrump(cardId('C', 12, 1))).toBe(true); // Kreuz-Dame
    expect(contract.isTrump(cardId('D', 1, 1))).toBe(true); // Karo-Ass

    // Zwei gleiche Kreuz-Damen: die zuerst gespielte Karte sticht nach TSR!
    const trick: PlayedCard[] = [
      { player: 0, card: cardId('C', 12, 1) }, // Erste Kreuz-Dame
      { player: 1, card: cardId('C', 12, 2) }, // Zweite Kreuz-Dame
      { player: 2, card: cardId('S', 12, 1) }, // Pik-Dame
      { player: 3, card: cardId('D', 1, 1) }, // Karo-Ass
    ];
    expect(trickWinner(trick, contract).player).toBe(0);
  });
});

describe('Bewertung für Sonderspiele', () => {
  const deck = (['C', 'S', 'H', 'D'] as const).flatMap((s) => ([7, 8, 9, 10, 11, 12, 13, 1] as const).map((r) => cardId(s, r)));

  it('nullDangerSuits erkennt gedeckte und gefährliche Farben', () => {
    const nul = createSkatContract('null');
    expect(nullDangerSuits([cardId('C', 7), cardId('C', 9), cardId('S', 7)], deck, nul)).toBe(0);
    expect(nullDangerSuits([cardId('C', 8)], deck, nul)).toBe(1);
    expect(nullDangerSuits([cardId('C', 7), cardId('C', 8), cardId('C', 10), cardId('H', 1)], deck, nul)).toBe(1);
  });

  it('winsAllTricks erkennt eine sichere Hand', () => {
    const grand = createSkatContract('grand');
    const hand = [cardId('C', 11), cardId('S', 11), cardId('H', 11), cardId('D', 11), cardId('C', 1), cardId('C', 10), cardId('S', 1), cardId('S', 10), cardId('H', 1), cardId('H', 10)];
    expect(winsAllTricks(hand, deck, grand)).toBe(true);
    expect(winsAllTricks([...hand.slice(0, 9), cardId('H', 9)], deck, grand)).toBe(false);
    expect(winsAllTricks([...hand.slice(1), cardId('D', 1)], deck, grand)).toBe(false);
  });
});

describe('Verdeckte Karten verteilen', () => {
  const nul = createSkatContract('null');
  const play = (player: number, card: ReturnType<typeof cardId>): PlayedCard => ({ player, card });

  it('knownVoids: wer nicht bedient, hat die Farbe nicht mehr', () => {
    const voids = knownVoids(
      [{ cards: [play(0, cardId('C', 7)), play(1, cardId('S', 8)), play(2, cardId('C', 9))] }],
      [play(1, cardId('H', 7)), play(2, cardId('H', 8)), play(0, cardId('D', 9))],
      nul,
    );
    expect([...(voids.get(1) ?? [])]).toEqual(['C']);
    expect(voids.get(2)).toBeUndefined();
    expect([...(voids.get(0) ?? [])]).toEqual(['H']);
  });

  it('dealUnknown beachtet leere Farben und die geforderten Anzahlen', () => {
    const pool = (['C', 'S', 'H', 'D'] as const).flatMap((s) => ([7, 8, 9, 10] as const).map((r) => cardId(s, r)));
    const voids = new Map([[1, new Set(['C', 'S'] as const)]]);
    for (let i = 0; i < 50; i++) {
      const rng = Rng.fromSeed(`deal-${i}`, 'test');
      const dealt = dealUnknown(pool, new Map([[0, 8], [1, 4], [-1, 4]]), voids, nul, rng);
      expect(dealt.get(0)).toHaveLength(8);
      expect(dealt.get(1)).toHaveLength(4);
      expect(dealt.get(-1)).toHaveLength(4);
      expect(dealt.get(1)!.every((c) => ['H', 'D'].includes(cardSuit(c)))).toBe(true);
      expect(new Set([...dealt.values()].flat()).size).toBe(16);
    }
  });

  it('dealUnknown verteilt trotzdem, wenn die Farben nicht aufgehen', () => {
    const pool = [cardId('C', 7), cardId('C', 8)];
    const voids = new Map([[0, new Set(['C'] as const)]]);
    const dealt = dealUnknown(pool, new Map([[0, 1], [1, 1]]), voids, nul, Rng.fromSeed('x', 'test'));
    expect(dealt.get(0)).toHaveLength(1);
    expect(dealt.get(1)).toHaveLength(1);
  });
});
