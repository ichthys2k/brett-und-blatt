import { describe, expect, it } from 'vitest';
import { POSTURE_LIFT, facesHead, getHandedness, holdingHand, sendPanelCommand, onPanelCommand, setHandedness } from '../apps/xr/src/ui-state';

describe('Handgelenk-Menü und Einstellungen (#388)', () => {
  it('zeigt das Menü nur bei Blick auf die Innenseite', () => {
    // Kopf 40 cm über der Hand, Oberseite zeigt nach oben: Blick darauf.
    expect(facesHead([0, 1, 0], [0, 1, 0], [0, 1.4, 0.1])).toBe(true);
    // Hand gedreht (Oberseite nach unten) oder Kopf seitlich: nichts.
    expect(facesHead([0, 1, 0], [0, -1, 0], [0, 1.4, 0.1])).toBe(false);
    expect(facesHead([0, 1, 0], [1, 0, 0], [0, 1.4, 0.1])).toBe(false);
  });
  it('Haltehand ist die Gegenseite der schreibenden Hand', () => {
    expect(getHandedness()).toBe('right');
    expect(holdingHand()).toBe('left');
    setHandedness('left');
    expect(holdingHand()).toBe('right');
    setHandedness('right');
  });
  it('im Stehen liegt der Tisch höher, Befehle erreichen das Fenster', () => {
    expect(POSTURE_LIFT.standing).toBeGreaterThan(POSTURE_LIFT.sitting);
    const got: string[] = [];
    const off = onPanelCommand((c) => got.push(c));
    sendPanelCommand('voice');
    off();
    sendPanelCommand('view');
    expect(got).toEqual(['voice']);
  });
});

import { choiceOffset, palmNormal } from '../apps/xr/src/ui-state';

describe('Handgelenk-Menü mit Handtracking (#388)', () => {
  it('Handfläche nach unten: Normale zeigt nach unten (rechte Hand), links ebenso mit gespiegelter Lage', () => {
    // Rechte Hand: Zeigefinger links (−x), kleiner Finger rechts (+x), beide nach vorn (−z).
    const right = palmNormal([0, 1, 0], [-0.03, 1, -0.08], [0.03, 1, -0.07], 'right');
    expect(right[1]).toBeLessThan(0);
    // Linke Hand: Zeigefinger rechts, kleiner Finger links.
    const left = palmNormal([0, 1, 0], [0.03, 1, -0.08], [-0.03, 1, -0.07], 'left');
    expect(left[1]).toBeLessThan(0);
    // Hand umgedreht (Fläche nach oben): Normale nach oben.
    const up = palmNormal([0, 1, 0], [0.03, 1, -0.08], [-0.03, 1, -0.07], 'right');
    expect(up[1]).toBeGreaterThan(0);
  });
  it('Wahlknöpfe liegen bei der schreibenden Hand', () => {
    expect(choiceOffset()).toBeGreaterThan(0);
    setHandedness('left');
    expect(choiceOffset()).toBeLessThan(0);
    setHandedness('right');
  });
});
