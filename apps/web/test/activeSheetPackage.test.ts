import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadActiveSheetPackageId,
  setActiveSheetPackageId,
} from '../src/lib/activeSheetPackage';

describe('Active Sheet Package Management', () => {
  beforeEach(() => {
    setActiveSheetPackageId(null);
  });

  it('initially has no active sheet package', () => {
    expect(loadActiveSheetPackageId()).toBeNull();
  });

  it('can activate and deactivate a sheet package id', () => {
    setActiveSheetPackageId('pack-123');
    expect(loadActiveSheetPackageId()).toBe('pack-123');

    setActiveSheetPackageId(null);
    expect(loadActiveSheetPackageId()).toBeNull();
  });
});
