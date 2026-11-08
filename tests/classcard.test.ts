import { CARD_STAMP_KINDS } from '../packages/online/src';
import { describe, expect, it } from 'vitest';
import { STAMP_KINDS } from '../apps/web/src/lib/stamps';

describe('Klassenkarte (#151)', () => {
  it('kennt dieselben Stempelarten wie die Pass-Seite', () => {
    expect([...CARD_STAMP_KINDS]).toEqual([...STAMP_KINDS]);
  });
});
