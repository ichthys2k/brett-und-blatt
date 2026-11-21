import { describe, expect, it } from 'vitest';
import { pushPrompt, removePrompt, topPrompt } from '../src/input/promptStack';

const a = [{ key: 'A', label: 'Eins' }];
const b = [{ key: 'B', label: 'Zwei' }];
const c = [{ key: 'X', label: 'Drei' }];

describe('Stapel der Tastenhinweise (#612)', () => {
  it('leerer Stapel ergibt null', () => {
    expect(topPrompt([])).toBeNull();
  });

  it('der oberste gilt, nach dem Entfernen wieder der untere', () => {
    const s = pushPrompt(pushPrompt([], { id: 1, items: a }), { id: 2, items: b });
    expect(topPrompt(s)).toBe(b);
    expect(topPrompt(removePrompt(s, 2))).toBe(a);
  });

  it('unteren entfernen lässt den oberen gelten', () => {
    const s = pushPrompt(pushPrompt([], { id: 1, items: a }), { id: 2, items: b });
    expect(topPrompt(removePrompt(s, 1))).toBe(b);
  });

  it('gleiche id ersetzt an ihrer Stelle', () => {
    const s = pushPrompt(pushPrompt([], { id: 1, items: a }), { id: 2, items: b });
    const r = pushPrompt(s, { id: 1, items: c });
    expect(r.map((e) => e.id)).toEqual([1, 2]);
    expect(r[0]!.items).toBe(c);
    expect(topPrompt(r)).toBe(b);
  });
});
