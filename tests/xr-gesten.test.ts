import { describe, expect, it } from 'vitest';
import { GestureTracker, isThumbsUp, openPalm, turns, type Joints, type Vec3 } from '../apps/xr/src/gestures';

/** Hand am Ort `at`: `open` = Finger gestreckt, sonst eingerollt; `thumbUp` = Daumen nach oben. */
function hand(at: Vec3, open: boolean, thumbUp = false): Joints {
  const [x, y, z] = at;
  const finger = (dx: number): [Vec3, Vec3] => [open ? [x + dx, y + 0.02, z - 0.18] : [x + dx, y + 0.02, z - 0.04], [x + dx, y + 0.02, z - 0.09]];
  const [indexTip, indexKnuckle] = finger(-0.03);
  const [middleTip, middleKnuckle] = finger(-0.01);
  const [ringTip, ringKnuckle] = finger(0.01);
  const [littleTip, littleKnuckle] = finger(0.03);
  return { wrist: at, thumbTip: thumbUp ? [x, y + 0.13, z - 0.05] : [x - 0.05, y, z - 0.08], indexTip, indexKnuckle, middleTip, middleKnuckle, ringTip, ringKnuckle, littleTip, littleKnuckle };
}

describe('Gesten (#386)', () => {
  it('erkennt Daumen hoch nur bei Faust mit Daumen oben', () => {
    expect(isThumbsUp(hand([0, 1.2, 0], false, true))).toBe(true);
    expect(isThumbsUp(hand([0, 1.2, 0], false, false))).toBe(false);
    expect(isThumbsUp(hand([0, 1.2, 0], true, true))).toBe(false);
    expect(openPalm(hand([0, 1.2, 0], true))).toBe(true);
  });
  it('löst Daumen hoch erst nach kurzem Halten aus und sperrt danach', () => {
    const t = new GestureTracker();
    const h = { left: null, right: hand([0.2, 1.2, 0], false, true) };
    expect(t.feed(0, h)).toBeNull();
    expect(t.feed(300, h)).toBeNull();
    expect(t.feed(600, h)).toBe('thumbsUp');
    expect(t.feed(1200, h)).toBeNull();
    expect(t.feed(7000, h)).toBeNull();
    expect(t.feed(7600, h)).toBe('thumbsUp');
  });
  it('erkennt Winken, aber keine ruhige offene Hand', () => {
    const wave = new GestureTracker();
    let got: string | null = null;
    for (let i = 0; i < 20; i++) got = wave.feed(i * 60, { left: null, right: hand([0.2 + (i % 4 < 2 ? 0 : 0.08), 1.3, 0], true) }) ?? got;
    expect(got).toBe('wave');
    const calm = new GestureTracker();
    let none: string | null = null;
    for (let i = 0; i < 20; i++) none = calm.feed(i * 60, { left: null, right: hand([0.2, 1.3, 0], true) }) ?? none;
    expect(none).toBeNull();
  });
  it('erkennt Klatschen, wenn sich offene Hände treffen', () => {
    const t = new GestureTracker();
    let got: string | null = null;
    [0.3, 0.2, 0.1, 0.03].forEach((half, i) => {
      got = t.feed(i * 100, { left: hand([-half, 1.2, 0], true), right: hand([half, 1.2, 0], true) }) ?? got;
    });
    expect(got).toBe('clap');
  });
  it('Zeigen und Pinch lösen nichts aus', () => {
    const point = hand([0, 1.2, 0], false);
    point.indexTip = [0, 1.22, -0.2];
    const pinch = hand([0, 1.2, 0], true);
    pinch.thumbTip = pinch.indexTip;
    const t = new GestureTracker();
    for (let i = 0; i < 40; i++) expect(t.feed(i * 100, { left: point, right: pinch })).toBeNull();
  });
  it('zählt Wendepunkte', () => {
    expect(turns([[0, 0, 0], [0.1, 0, 0], [0, 0, 0], [0.1, 0, 0], [0, 0, 0]])).toBe(3);
    expect(turns([[0, 0, 0], [0.01, 0, 0], [0, 0, 0]])).toBe(0);
  });
});
