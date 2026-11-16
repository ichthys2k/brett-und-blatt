import { describe, expect, it } from 'vitest';
import { HAND_RADIUS_FACTOR, PALM, handRadius, isOwnerEnd, newPalmState, pickReleaseSnap, pushSample, smoothPoint, stepPalm, stickySnap } from '../apps/xr/src/hand-assist';
import { fanSlot } from '../apps/xr/src/scene/fan-layout';
import { facingDot, facesHead } from '../apps/xr/src/ui-state';

describe('Greifen mit der Hand (#382, #383)', () => {
  const targets = [
    { id: 'e4', x: 0, z: 0 },
    { id: 'e5', x: 0.05, z: 0 },
  ];
  it('die Hand bekommt einen größeren Einrast-Umkreis, der Controller nicht', () => {
    expect(handRadius(0.03, false)).toBe(0.03);
    expect(handRadius(0.03, true)).toBeCloseTo(0.03 * HAND_RADIUS_FACTOR);
  });
  it('das gewählte Ziel bleibt, bis die Figur deutlich darüber hinaus ist (kein Flackern)', () => {
    // Punkt liegt näher an e5, aber e4 war gewählt und ist noch im erweiterten Umkreis: e4 bleibt.
    expect(stickySnap([0.027, 0], targets, 0.03, 'e4')?.id).toBe('e4');
    // Ohne bisheriges Ziel gilt das nächste.
    expect(stickySnap([0.027, 0], targets, 0.03, null)?.id).toBe('e5');
    // Deutlich näher an e5 (näher als 70 % der Entfernung zu e4): Wechsel.
    expect(stickySnap([0.048, 0], targets, 0.03, 'e4')?.id).toBe('e5');
    // Weit weg vom gewählten Ziel (jenseits 1,4 × Radius): kein Festhalten.
    expect(stickySnap([0.3, 0.3], targets, 0.03, 'e4')).toBeNull();
    expect(stickySnap([0, 0], [], 0.03, 'e4')).toBeNull();
  });
  it('glättet die Führung, ohne beim ersten Wert zu verzögern', () => {
    expect(smoothPoint(null, [1, 2], 0.4)).toEqual([1, 2]);
    const [x, z] = smoothPoint([0, 0], [1, 1], 0.4);
    expect(x).toBeCloseTo(0.4);
    expect(z).toBeCloseTo(0.4);
  });
  it('beim Loslassen zählt die Lage kurz vor dem Öffnen der Finger', () => {
    let history = pushSample([], { t: 0, snap: 'a' });
    history = pushSample(history, { t: 100, snap: 'a' });
    history = pushSample(history, { t: 200, snap: 'b' }); // Strahl springt beim Öffnen
    history = pushSample(history, { t: 280, snap: null });
    // Jüngster Eintrag, der mindestens 120 ms alt ist (t ≤ 180): 'a', also vor dem Springen des Strahls.
    expect(pickReleaseSnap(history, 300, 120)).toBe('a');
    expect(pickReleaseSnap(history, 300, 0)).toBeNull(); // Controller: jüngster
    expect(pickReleaseSnap([], 300, 120)).toBeNull();
    // Sehr kurzer Zug: der älteste Eintrag
    expect(pickReleaseSnap([{ t: 290, snap: 'c' }], 300, 120)).toBe('c');
  });
  it('hält nur das letzte halbe Sekündchen', () => {
    let history = pushSample([], { t: 0, snap: 'a' });
    history = pushSample(history, { t: 700, snap: 'b' });
    expect(history).toEqual([{ t: 700, snap: 'b' }]);
  });
  it('erkennt das Ende des Drückens, das zum Greifen gehört', () => {
    expect(isOwnerEnd(1000, 1050)).toBe(true); // Druck begann kurz vor dem Greifen
    expect(isOwnerEnd(1100, 1050)).toBe(true); // oder kurz danach (Reihenfolge der Ereignisse offen)
    expect(isOwnerEnd(500, 1050)).toBe(false); // alter Druck der anderen Hand
    expect(isOwnerEnd(undefined, 1050)).toBe(false);
  });
});

describe('Handgelenk-Menü nur mit eindeutiger Geste (#388)', () => {
  const run = (frames: Array<[number, number | null]>) => {
    const s = newPalmState();
    return frames.map(([t, dot]) => stepPalm(s, dot, t));
  };
  it('öffnet nicht schon beim bloßen Blick, sondern erst nach der Haltezeit', () => {
    expect(run([[0, 0.9], [300, 0.9], [600, 0.9]])).toEqual([false, false, false]);
    expect(run([[0, 0.9], [300, 0.9], [PALM.holdMs, 0.9]]).at(-1)).toBe(true);
  });
  it('ein kurzer oder schräger Blick öffnet nie', () => {
    expect(run([[0, 0.9], [300, 0.5], [900, 0.9], [1200, 0.9]]).some(Boolean)).toBe(false); // unterbrochen
    expect(run([[0, 0.7], [2000, 0.7]]).some(Boolean)).toBe(false); // zu schräg zum Öffnen
  });
  it('schließt nach kurzer Schonfrist, sobald man wegdreht', () => {
    const s = newPalmState();
    stepPalm(s, 0.95, 0);
    expect(stepPalm(s, 0.95, PALM.holdMs)).toBe(true);
    expect(stepPalm(s, 0.2, PALM.holdMs + 100)).toBe(true); // kurz weg: noch offen
    expect(stepPalm(s, 0.2, PALM.holdMs + 100 + PALM.graceMs)).toBe(false);
  });
  it('kurzes Wegdrehen innerhalb der Schonfrist schließt nicht', () => {
    const s = newPalmState();
    stepPalm(s, 0.95, 0);
    stepPalm(s, 0.95, PALM.holdMs);
    stepPalm(s, 0.2, PALM.holdMs + 100);
    expect(stepPalm(s, 0.9, PALM.holdMs + 200)).toBe(true);
  });
  it('schließt spätestens nach der Höchstzeit und braucht dann eine neue Geste', () => {
    const s = newPalmState();
    stepPalm(s, 0.95, 0);
    stepPalm(s, 0.95, PALM.holdMs);
    expect(stepPalm(s, 0.95, PALM.holdMs + PALM.maxOpenMs)).toBe(false);
    // Hand bleibt zugewandt: geht nicht von selbst wieder auf …
    expect(stepPalm(s, 0.95, PALM.holdMs + PALM.maxOpenMs + 5000)).toBe(false);
    // … erst Wegdrehen, dann wieder Halten.
    stepPalm(s, 0.1, PALM.holdMs + PALM.maxOpenMs + 5100);
    stepPalm(s, 0.95, PALM.holdMs + PALM.maxOpenMs + 5200);
    expect(stepPalm(s, 0.95, PALM.holdMs + PALM.maxOpenMs + 5200 + PALM.holdMs)).toBe(true);
  });
  it('ohne verfolgte Hand bleibt es zu und setzt zurück', () => {
    const s = newPalmState();
    stepPalm(s, 0.95, 0);
    expect(stepPalm(s, null, 100)).toBe(false);
    expect(stepPalm(s, 0.95, 200)).toBe(false);
  });
  it('facingDot liefert den Kosinus, facesHead bleibt kompatibel', () => {
    expect(facingDot([0, 0, 0], [0, 1, 0], [0, 2, 0])).toBeCloseTo(1);
    expect(facingDot([0, 0, 0], [0, 1, 0], [2, 0, 0])).toBeCloseTo(0);
    expect(facesHead([0, 0, 0], [0, 1, 0], [0, 2, 0])).toBe(true);
    expect(facesHead([0, 0, 0], [0, 1, 0], [2, 0, 0])).toBe(false);
  });
});

describe('Kartenfächer an der Hand (#384)', () => {
  it('gespreizt liegen die Karten weiter auseinander, die Reihenfolge bleibt', () => {
    const narrow = Array.from({ length: 8 }, (_, i) => fanSlot(i, 8).x);
    const wide = Array.from({ length: 8 }, (_, i) => fanSlot(i, 8, 1.3).x);
    expect(wide[7]! - wide[0]!).toBeCloseTo((narrow[7]! - narrow[0]!) * 1.3);
    expect(wide).toEqual([...wide].sort((a, b) => a - b));
    expect(fanSlot(3, 8).x).toBe(fanSlot(3, 8, 1).x);
  });
});
