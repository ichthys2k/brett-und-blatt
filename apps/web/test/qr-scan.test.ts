import { describe, expect, it } from 'vitest';
import { roomTextFromQr, scanSupported } from '../src/lib/qrScan';

describe('QR-Code lesen (#394)', () => {
  it('nimmt nur Raum-Links an', () => {
    expect(roomTextFromQr('https://spiele.lipponer.de/#/raum/%F0%9F%A6%8A')).toContain('#/raum/');
    expect(roomTextFromQr('  https://spiele.lipponer.de/#/raum/abc  ')).toBe('https://spiele.lipponer.de/#/raum/abc');
    expect(roomTextFromQr('https://example.org/')).toBeNull();
    expect(roomTextFromQr('')).toBeNull();
    expect(roomTextFromQr('x'.repeat(400) + '#/raum/a')).toBeNull();
  });
  it('meldet fehlenden BarcodeDetector als nicht unterstützt', () => {
    expect(scanSupported()).toBe(false);
  });
});
