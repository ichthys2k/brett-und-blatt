/** Einfache Vorrangwarteschlange (binärer Heap): kleinster Schätzwert `h` zuerst. */
export class Heap<T extends { h: number }> {
  private items: T[] = [];
  get size() {
    return this.items.length;
  }
  push(node: T) {
    const a = this.items;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.h <= a[i]!.h) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    const top = a[0];
    const end = a.pop();
    if (a.length > 0 && end) {
      a[0] = end;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.h < a[m]!.h) m = l;
        if (r < a.length && a[r]!.h < a[m]!.h) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}
