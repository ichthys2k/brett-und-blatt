import { describe, expect, it } from 'vitest';
import { decodePacket, encodePacket, type Packet } from '../apps/xr/src/presence';

const pose = [0, 1.4, 0, 0, 0, 0, 1];
const base: Packet = { head: pose, left: pose, right: pose, held: null, pointLeft: false, pointRight: false, fingerLeft: null, fingerRight: null };

describe('Präsenz am Tisch (#385)', () => {
  it('überträgt gegriffene Karte nur als Ort und Rückseite, nie einen Wert', () => {
    const text = encodePacket({ ...base, held: [0.1, 0.9, -0.5, 1] });
    expect(JSON.parse(text).g).toEqual([0.1, 0.9, -0.5, 1]);
    // Das Paket kennt nur Ort und Art; nichts, was eine Karte benennt.
    expect(text).not.toMatch(/face|rank|suit|id|card/i);
    expect(decodePacket(text)?.held?.[3]).toBe(1);
  });
  it('lässt Zeigen weg, solange nicht gezeigt wird, und bleibt klein', () => {
    expect(JSON.parse(encodePacket(base)).p).toBeUndefined();
    const text = encodePacket({ ...base, held: [0, 0.9, 0, 0], pointRight: true });
    expect(JSON.parse(text).p).toEqual([0, 1]);
    expect(text.length).toBeLessThan(400);
  });
  it('überträgt Finger als fünf Ziffern je Hand und prüft sie', () => {
    const text = encodePacket({ ...base, fingerLeft: [0, 9, 9, 9, 9], fingerRight: null });
    expect(JSON.parse(text).f).toEqual(['09999', null]);
    expect(decodePacket(text)?.fingerLeft).toEqual([0, 9, 9, 9, 9]);
    expect(decodePacket(text)?.fingerRight).toBeNull();
    expect(decodePacket(JSON.stringify({ h: pose, f: ['abc', '123'] }))?.fingerLeft).toBeNull();
    expect(text.length).toBeLessThan(400);
  });
  it('verwirft Kaputtes und unbekannte Arten', () => {
    expect(decodePacket('kein json')).toBeNull();
    expect(decodePacket(JSON.stringify({ h: [1, 2] }))).toBeNull();
    const odd = decodePacket(JSON.stringify({ h: pose, g: [0, 0, 0, 7], p: 'x' }));
    expect(odd?.held).toBeNull();
    expect(odd?.pointLeft).toBe(false);
  });
});

import { signYaw } from '../apps/xr/src/scene/Seats';
import { fingerCurls, GESTURE_REACTION, type Joints } from '../apps/xr/src/gestures';

describe('Finger und Schilder (#385, #386)', () => {
  const hand = (open: boolean): Joints => {
    const f = (dx: number): [[number, number, number], [number, number, number]] => [open ? [dx, 0, -0.18] : [dx, 0, -0.04], [dx, 0, -0.09]];
    const [indexTip, indexKnuckle] = f(-0.03);
    const [middleTip, middleKnuckle] = f(-0.01);
    const [ringTip, ringKnuckle] = f(0.01);
    const [littleTip, littleKnuckle] = f(0.03);
    return { wrist: [0, 0, 0], thumbTip: open ? [-0.08, 0, -0.1] : [-0.02, 0, -0.09], indexTip, indexKnuckle, middleTip, middleKnuckle, ringTip, ringKnuckle, littleTip, littleKnuckle };
  };
  it('Finger: gestreckt 0, eingerollt hoch, immer fünf Ziffern', () => {
    const open = fingerCurls(hand(true));
    const fist = fingerCurls(hand(false));
    expect(open).toHaveLength(5);
    expect(open.slice(1).every((c) => c === 0)).toBe(true);
    expect(fist.slice(1).every((c) => c >= 8)).toBe(true);
    expect(fist.every((c) => c >= 0 && c <= 9)).toBe(true);
  });
  it('Winken löst 👋 aus', () => {
    expect(GESTURE_REACTION.wave).toBe('👋');
  });
  it('Schild dreht sich zum Spieler am Zug, ohne ihn ganz anzusehen', () => {
    const base = Math.PI / 2 + Math.PI;
    expect(signYaw(Math.PI / 2, null, 1)).toBe(base);
    const turned = signYaw(Math.PI / 2, Math.PI, 1);
    expect(turned).not.toBe(base);
    expect(Math.abs(turned - base)).toBeLessThan(Math.PI / 2);
  });
});
