/*
 * Liest aus dem Kopf eines zstd-Rahmens die angegebene Größe des entpackten Inhalts (Frame_Content_Size), ohne zu entpacken. So lässt sich
 * eine „Zip-Bombe“ ablehnen, bevor Speicher belegt wird. `null`: kein zstd-Rahmen oder keine Größe angegeben.
 */
export function zstdContentSize(bytes: Uint8Array): number | null {
  if (bytes.length < 6 || bytes[0] !== 0x28 || bytes[1] !== 0xb5 || bytes[2] !== 0x2f || bytes[3] !== 0xfd) return null;
  const descriptor = bytes[4]!;
  const fcsFlag = descriptor >> 6;
  const singleSegment = (descriptor & 0x20) !== 0;
  const dictBytes = [0, 1, 2, 4][descriptor & 3]!;
  let at = 5 + (singleSegment ? 0 : 1) + dictBytes;
  const fcsBytes = fcsFlag === 0 ? (singleSegment ? 1 : 0) : [0, 2, 4, 8][fcsFlag]!;
  if (fcsBytes === 0 || at + fcsBytes > bytes.length) return null;
  let value = 0;
  for (let i = 0; i < fcsBytes; i++) value += bytes[at + i]! * 2 ** (8 * i);
  if (fcsBytes === 2) value += 256;
  at += fcsBytes;
  return value;
}
