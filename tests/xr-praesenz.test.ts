import { describe, expect, it } from 'vitest';
import { decodePacket, encodePacket, type Packet } from '../apps/xr/src/presence';

const pose = [0, 1.4, 0, 0, 0, 0, 1];
const base: Packet = { head: pose, left: pose, right: pose, held: null, pointLeft: false, pointRight: false };

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
  it('verwirft Kaputtes und unbekannte Arten', () => {
    expect(decodePacket('kein json')).toBeNull();
    expect(decodePacket(JSON.stringify({ h: [1, 2] }))).toBeNull();
    const odd = decodePacket(JSON.stringify({ h: pose, g: [0, 0, 0, 7], p: 'x' }));
    expect(odd?.held).toBeNull();
    expect(odd?.pointLeft).toBe(false);
  });
});
