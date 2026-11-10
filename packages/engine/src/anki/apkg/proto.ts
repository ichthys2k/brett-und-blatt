/*
 * Ein kleiner Leser für das Protobuf-Format, in dem Anki Metadaten des neuen Paketformats (Schema 18) ablegt: Paket-Meta, Medienliste,
 * Notiztypen (Einstellungen, Felder, Vorlagen) und Stapel. Gelesen wird nur, was wir brauchen: Zahlen (Varint), Bytefolgen mit Längenangabe
 * und feste Breiten; alles andere wird übersprungen.
 */

export type PbValue = number | Uint8Array;
export type PbMessage = Map<number, PbValue[]>;

const TEXT = new TextDecoder('utf-8');

export function pbParse(buf: Uint8Array): PbMessage {
  const out: PbMessage = new Map();
  let i = 0;
  const varint = (): number => {
    let value = 0;
    let scale = 1;
    for (let n = 0; n < 10; n++) {
      if (i >= buf.length) throw new Error('Protobuf: abgeschnitten');
      const b = buf[i++]!;
      value += (b & 0x7f) * scale;
      if ((b & 0x80) === 0) return value;
      scale *= 128;
    }
    throw new Error('Protobuf: Zahl zu lang');
  };
  const add = (field: number, value: PbValue) => {
    const list = out.get(field);
    if (list) list.push(value);
    else out.set(field, [value]);
  };
  while (i < buf.length) {
    const tag = varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (wire === 0) add(field, varint());
    else if (wire === 2) {
      const len = varint();
      if (i + len > buf.length) throw new Error('Protobuf: abgeschnitten');
      add(field, buf.subarray(i, i + len));
      i += len;
    } else if (wire === 5) {
      if (i + 4 > buf.length) throw new Error('Protobuf: abgeschnitten');
      add(field, new DataView(buf.buffer, buf.byteOffset + i, 4).getUint32(0, true));
      i += 4;
    } else if (wire === 1) {
      if (i + 8 > buf.length) throw new Error('Protobuf: abgeschnitten');
      const view = new DataView(buf.buffer, buf.byteOffset + i, 8);
      add(field, view.getUint32(0, true) + view.getUint32(4, true) * 2 ** 32);
      i += 8;
    } else throw new Error('Protobuf: unbekannte Art');
  }
  return out;
}

export const pbNumber = (msg: PbMessage, field: number, fallback = 0): number => {
  const v = msg.get(field)?.[0];
  return typeof v === 'number' ? v : fallback;
};
export const pbBool = (msg: PbMessage, field: number): boolean => pbNumber(msg, field) !== 0;
export const pbBytes = (msg: PbMessage, field: number): Uint8Array | undefined => {
  const v = msg.get(field)?.[0];
  return v instanceof Uint8Array ? v : undefined;
};
export const pbString = (msg: PbMessage, field: number, fallback = ''): string => {
  const v = pbBytes(msg, field);
  return v ? TEXT.decode(v) : fallback;
};
export const pbHas = (msg: PbMessage, field: number): boolean => msg.has(field);
export const pbMessages = (msg: PbMessage, field: number): PbMessage[] => (msg.get(field) ?? []).filter((v): v is Uint8Array => v instanceof Uint8Array).map(pbParse);

/** Eine Liste von Zahlen: gepackt (eine Bytefolge) oder einzeln. */
export function pbNumbers(msg: PbMessage, field: number): number[] {
  const out: number[] = [];
  for (const v of msg.get(field) ?? []) {
    if (typeof v === 'number') out.push(v);
    else {
      let i = 0;
      while (i < v.length) {
        let value = 0;
        let scale = 1;
        for (;;) {
          const b = v[i++]!;
          value += (b & 0x7f) * scale;
          if ((b & 0x80) === 0) break;
          scale *= 128;
        }
        out.push(value);
      }
    }
  }
  return out;
}

/** Das gespeicherte „other“-Feld (255) ist ein JSON-Objekt mit allem, was Anki sonst nicht kennt. */
export function pbOther(msg: PbMessage): Record<string, unknown> {
  const bytes = pbBytes(msg, 255);
  if (!bytes || bytes.length === 0) return {};
  try {
    const value = JSON.parse(TEXT.decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Schreibt eine Zahl als Varint (für kleine Nachrichten wie `meta`). */
export function pbVarint(value: number): number[] {
  const out: number[] = [];
  let v = value;
  while (v >= 128) {
    out.push((v % 128) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
}

// ---------------------------------------------------------------- Schreiben (nur, was Pakete brauchen)

const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};
export const pbEncodeVarint = (field: number, value: number): Uint8Array => new Uint8Array([...pbVarint(field * 8), ...pbVarint(value)]);
export const pbEncodeBytes = (field: number, bytes: Uint8Array): Uint8Array => concat([new Uint8Array(pbVarint(field * 8 + 2)), new Uint8Array(pbVarint(bytes.length)), bytes]);
export const pbEncodeString = (field: number, text: string): Uint8Array => pbEncodeBytes(field, new TextEncoder().encode(text));

/** Die Medienliste des neuen Paketformats (`MediaEntries`): je Datei Name, Größe und SHA-1; die Nummer in der Liste ist der Dateiname im ZIP. */
export function encodeMediaEntries(entries: readonly { name: string; size: number; sha1: Uint8Array }[]): Uint8Array {
  return concat(entries.map((e) => pbEncodeBytes(1, concat([pbEncodeString(1, e.name), pbEncodeVarint(2, e.size), pbEncodeBytes(3, e.sha1)]))));
}
