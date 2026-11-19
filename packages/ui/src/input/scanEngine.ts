export interface ScanState {
  phase: 'zone' | 'item';
  zoneIndex: number;
  itemIndex: number;
}

export const INITIAL_SCAN_STATE: ScanState = {
  phase: 'zone',
  zoneIndex: 0,
  itemIndex: 0,
};

/** Bewegt den Scan-Rahmen um einen Schritt weiter (Zone oder Element). */
export function stepScanAdvance(state: ScanState, zoneCount: number, itemCount: number): ScanState {
  if (zoneCount <= 0) return INITIAL_SCAN_STATE;
  if (state.phase === 'zone') {
    return {
      phase: 'zone',
      zoneIndex: (state.zoneIndex + 1) % zoneCount,
      itemIndex: 0,
    };
  }
  if (itemCount <= 0) {
    return { phase: 'zone', zoneIndex: state.zoneIndex % zoneCount, itemIndex: 0 };
  }
  return {
    phase: 'item',
    zoneIndex: state.zoneIndex % zoneCount,
    itemIndex: (state.itemIndex + 1) % itemCount,
  };
}

/** Wählt die aktuelle Zone (wechselt in die Element-Ebene) oder das aktuelle Element aus. */
export function stepScanSelect(
  state: ScanState,
  zoneCount: number,
  itemCount: number,
): { nextState: ScanState; triggerZoneIndex?: number; triggerItemIndex?: number } {
  if (zoneCount <= 0) return { nextState: INITIAL_SCAN_STATE };
  const safeZone = state.zoneIndex % zoneCount;

  if (state.phase === 'zone') {
    if (itemCount <= 1) {
      // Zone mit nur einem Element direkt auslösen
      return {
        nextState: { phase: 'zone', zoneIndex: safeZone, itemIndex: 0 },
        triggerZoneIndex: safeZone,
        triggerItemIndex: 0,
      };
    }
    return {
      nextState: { phase: 'item', zoneIndex: safeZone, itemIndex: 0 },
      triggerZoneIndex: safeZone,
    };
  }

  return {
    nextState: { phase: 'zone', zoneIndex: safeZone, itemIndex: 0 },
    triggerZoneIndex: safeZone,
    triggerItemIndex: itemCount > 0 ? state.itemIndex % itemCount : 0,
  };
}

/** Springt von der Element-Ebene zurück in die Zonen-Ebene. */
export function stepScanBack(state: ScanState): ScanState {
  return {
    phase: 'zone',
    zoneIndex: state.zoneIndex,
    itemIndex: 0,
  };
}
