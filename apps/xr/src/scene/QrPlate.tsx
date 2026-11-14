/**
 * QR-Code in der Lobby der VR-App (#394): Handy-Spieler im selben Raum scannen ihn und landen
 * mit dem Raumcode in der Web-App. Das Scannen selbst gibt es in der VR-App nicht: Der Browser
 * der Quest gibt Web-Seiten die Kamera nicht frei (siehe docs/vr.md); dort bleibt die Emoji-Tastatur.
 */
import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { encode } from 'uqr';

/** Web-App, in der Handys dem Raum beitreten. */
export const WEB_APP = 'https://spiele.lipponer.de/';

export function joinLink(code: string, base = WEB_APP): string {
  return `${base}#/raum/${encodeURIComponent(code)}`;
}

/** Modul-Matrix des QR-Codes (true = dunkel) mit Ruhezone von zwei Modulen. */
export function qrMatrix(text: string, border = 2): boolean[][] {
  const data = encode(text, { border, ecc: 'M' }).data as boolean[][];
  return data;
}

export function QrPlate({ code, position, rotation = [0, 0, 0], size = 0.2 }: { code: string; position: [number, number, number]; rotation?: [number, number, number]; size?: number }) {
  const texture = useMemo(() => {
    const matrix = qrMatrix(joinLink(code));
    const px = 8;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = matrix.length * px;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1f2328';
      matrix.forEach((row, y) => row.forEach((dark, x) => dark && ctx.fillRect(x * px, y * px, px, px)));
    }
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.magFilter = 1003; // NearestFilter: scharfe Module
    return t;
  }, [code]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
