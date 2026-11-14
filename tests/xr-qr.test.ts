import { describe, expect, it } from 'vitest';
import { joinLink, qrMatrix } from '../apps/xr/src/scene/QrPlate';

describe('QR-Code in der VR-Lobby (#394)', () => {
  it('der Link führt mit dem Raumcode in die Web-App', () => {
    expect(joinLink('🦊🍎🚀🎈')).toBe('https://spiele.lipponer.de/#/raum/' + encodeURIComponent('🦊🍎🚀🎈'));
  });
  it('die Matrix ist quadratisch und enthält dunkle und helle Module', () => {
    const m = qrMatrix(joinLink('🦊🍎🚀🎈'));
    expect(m.length).toBeGreaterThan(20);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    expect(m.flat().some(Boolean)).toBe(true);
    expect(m.flat().some((x) => !x)).toBe(true);
  });
});
