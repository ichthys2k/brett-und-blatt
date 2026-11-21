import { Rng } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { applyMove, isLegal, legalMoves, setup } from '../src/rules';
import type { UnoCard, UnoCardType, UnoColor, UnoState } from '../src/types';

const card = (id: string, color: UnoColor, type: UnoCardType): UnoCard => ({ id, front: { color, type } });

/** 4 Plätze, Platz 0 am Zug, oben liegt Rot 5. */
function table(hand0: UnoCard[], opts: Partial<UnoState['options']> = {}): UnoState {
  const s = setup(4, Rng.fromSeed('dz'), { stacking: 'off', ...opts });
  s.hands = [hand0, [card('x1', 'blue', '1'), card('x2', 'blue', '2')], [card('y1', 'blue', '3'), card('y2', 'blue', '4')], [card('z1', 'blue', '6'), card('z2', 'blue', '7')]];
  s.discard = [card('top', 'red', '5')];
  s.activeColor = 'red';
  s.turn = 0;
  s.direction = 1;
  s.pendingDraw = 0;
  s.unoProtection = [false, false, false, false];
  return s;
}

describe('Eins! Doppelzug', () => {
  it('zwei identische Karten legen, Option an', () => {
    const s = table([card('a', 'red', '9'), card('b', 'red', '9'), card('c', 'green', '1')]);
    expect(legalMoves(s, 0).some((m) => m.type === 'play' && m.cardId === 'a' && m.alsoCardId === 'b')).toBe(true);
    const r = applyMove(s, 0, { type: 'play', cardId: 'a', alsoCardId: 'b', callUno: true });
    expect(r.state.hands[0].map((c) => c.id)).toEqual(['c']);
    expect(r.state.discard.slice(-2).map((c) => c.id)).toEqual(['a', 'b']);
    expect(r.state.turn).toBe(1);
    expect(r.state.unoProtection[0]).toBe(true);
  });

  it('nicht erlaubt bei Option aus, bei verschiedenen Karten oder derselben Karte', () => {
    const hand = [card('a', 'red', '9'), card('b', 'red', '9'), card('c', 'red', '8'), card('d', 'green', '1')];
    expect(isLegal(table(hand, { doublePlay: 'off' }), 0, { type: 'play', cardId: 'a', alsoCardId: 'b' })).toBe(false);
    const s = table(hand);
    expect(isLegal(s, 0, { type: 'play', cardId: 'a', alsoCardId: 'c' })).toBe(false);
    expect(isLegal(s, 0, { type: 'play', cardId: 'a', alsoCardId: 'a' })).toBe(false);
  });

  it('zwei Aussetzen überspringen zwei Plätze', () => {
    const s = table([card('a', 'red', 'skip'), card('b', 'red', 'skip'), card('c', 'green', '1')]);
    expect(applyMove(s, 0, { type: 'play', cardId: 'a' }).state.turn).toBe(2);
    expect(applyMove(s, 0, { type: 'play', cardId: 'a', alsoCardId: 'b' }).state.turn).toBe(3);
  });

  it('zwei Richtungswechsel heben sich auf', () => {
    const s = table([card('a', 'red', 'reverse'), card('b', 'red', 'reverse'), card('c', 'green', '1')]);
    const r = applyMove(s, 0, { type: 'play', cardId: 'a', alsoCardId: 'b' }).state;
    expect(r.direction).toBe(1);
    expect(r.turn).toBe(1);
  });

  it('zwei +2 ergeben 4 Strafkarten (gestapelt) oder 4 gezogene Karten', () => {
    const hand = [card('a', 'red', 'draw2'), card('b', 'red', 'draw2'), card('c', 'green', '1')];
    expect(applyMove(table(hand, { stacking: 'same' }), 0, { type: 'play', cardId: 'a', alsoCardId: 'b' }).state.pendingDraw).toBe(4);
    const off = applyMove(table(hand), 0, { type: 'play', cardId: 'a', alsoCardId: 'b' }).state;
    expect(off.hands[1]).toHaveLength(6);
    expect(off.turn).toBe(2);
  });

  it('zwei Joker mit Wunschfarbe und Gewinn mit der letzten Karte', () => {
    const s = table([card('a', 'wild', 'wild'), card('b', 'wild', 'wild')]);
    const r = applyMove(s, 0, { type: 'play', cardId: 'a', alsoCardId: 'b', chosenColor: 'blue' }).state;
    expect(r.winner).toBe(0);
    expect(r.activeColor).toBe('blue');
  });

  it('Zwischenwerfen mit zwei identischen Karten', () => {
    const s = table([card('a', 'green', '1')]);
    s.hands[2] = [card('j1', 'red', '5'), card('j2', 'red', '5'), card('j3', 'green', '2')];
    const m = legalMoves(s, 2).find((x) => x.type === 'jumpIn' && x.alsoCardId);
    expect(m).toBeTruthy();
    const r = applyMove(s, 2, m!).state;
    expect(r.hands[2].map((c) => c.id)).toEqual(['j3']);
    expect(r.turn).toBe(3);
  });
});

describe('Eins! Keine Gnade: Farbwahl Richtungswechsel Zieh 4', () => {
  it('wechselt die Richtung und gibt dem Nächsten in neuer Richtung 4 Strafkarten', () => {
    const s = table([card('a', 'wild', 'wildReverseDraw4'), card('c', 'green', '1')], { stacking: 'progressive' });
    const r = applyMove(s, 0, { type: 'play', cardId: 'a', chosenColor: 'blue' }).state;
    expect(r.direction).toBe(-1);
    expect(r.pendingDraw).toBe(4);
    expect(r.turn).toBe(3);
  });

  it('lässt sich auf Zieh 2 stapeln', () => {
    const s = table([card('a', 'wild', 'wildReverseDraw4'), card('c', 'green', '1')], { stacking: 'progressive' });
    s.discard = [card('top', 'red', 'draw2')];
    s.pendingDraw = 2;
    expect(legalMoves(s, 0).some((m) => m.type === 'play' && m.cardId === 'a')).toBe(true);
  });
});

describe('Eins! Ziehen bis Farbe', () => {
  it('der Nächste zieht, bis die gewünschte Farbe kommt, und wird übersprungen', () => {
    const s = table([card('a', 'wild', 'wildDrawColor'), card('c', 'green', '1')]);
    s.stock = [card('s3', 'blue', '9'), card('s2', 'yellow', '2'), card('s1', 'red', '2')];
    const r = applyMove(s, 0, { type: 'play', cardId: 'a', chosenColor: 'blue' }).state;
    expect(r.hands[1]).toHaveLength(5);
    expect(r.turn).toBe(2);
  });
});
