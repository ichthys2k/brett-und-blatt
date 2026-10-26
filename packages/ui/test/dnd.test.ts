import { describe, expect, it } from 'vitest';
import { usePointerDrag, useSpawnAnimation } from '../src';

describe('DnD Utilities', () => {
  it('exportiert die Hooks usePointerDrag und useSpawnAnimation', () => {
    expect(typeof usePointerDrag).toBe('function');
    expect(typeof useSpawnAnimation).toBe('function');
  });
});
