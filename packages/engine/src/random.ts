/** Zustand eines Zufallsgenerators: vier 32-Bit-Zahlen, als JSON speicherbar. */
export type RngState = [number, number, number, number];

/** Macht aus einem Text vier 32-Bit-Startwerte (Hashfunktion cyrb128). */
export function hashSeed(text: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Zufallsgenerator mit Startwert (Verfahren sfc32). Gleicher Startwert ergibt
 * immer dieselbe Zahlenfolge – darauf beruhen Wiederholung und Schummelprüfung.
 * Spielregeln benutzen nie `Math.random()`, sondern immer einen `Rng`.
 */
export class Rng {
  private s: RngState;

  constructor(state: RngState) {
    this.s = [...state];
  }

  /** Eigener Zufallsstrom je Zweck (z. B. 'mischen', 'würfel'), damit sich Ströme nicht verschieben. */
  static fromSeed(seed: string, stream = 'main'): Rng {
    return new Rng(hashSeed(`${seed}/${stream}`));
  }

  get state(): RngState {
    return [...this.s];
  }

  /** Zahl im Bereich [0, 1). */
  next(): number {
    let [a, b, c, d] = this.s;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.s = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    return (t >>> 0) / 4294967296;
  }

  /** Ganze Zahl im Bereich [0, maxExclusive). */
  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`Ungültige Obergrenze: ${maxExclusive}`);
    }
    return Math.floor(this.next() * maxExclusive);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Aus einer leeren Liste kann nichts gewählt werden.');
    return items[this.int(items.length)] as T;
  }

  /** Gibt eine gemischte Kopie zurück (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  }
}

/** Zufälliger Startwert für eine neue Partie (nicht für Spielregeln verwenden). */
export function randomSeed(): string {
  const values = new Uint32Array(3);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => v.toString(36)).join('');
}
