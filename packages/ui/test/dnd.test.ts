import { describe, expect, it } from 'vitest';
import { useGridMoveAnimation, usePointerDrag, useSpawnAnimation } from '../src';

describe('DnD Utilities', () => {
  it('exportiert die Hooks usePointerDrag, useSpawnAnimation und useGridMoveAnimation', () => {
    expect(typeof usePointerDrag).toBe('function');
    expect(typeof useSpawnAnimation).toBe('function');
    expect(typeof useGridMoveAnimation).toBe('function');
  });
});
