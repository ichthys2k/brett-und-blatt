import { describe, expect, it } from 'vitest';
import { SCOPED_KEYS } from '../apps/web/src/lib/passes';
import { nameToKey, SYNCED_KEYS } from '../apps/web/src/lib/settingsBlock';
import { REWARDS_HIDDEN_KEY } from '../apps/web/src/lib/rewards';

/* Anzeige der Stufen im Pass (#573, #574): der Schalter reist mit dem Pass und wandert beim Passwechsel mit. */

describe('Schalter „Belohnungen nicht anzeigen“ (#573)', () => {
  it('liegt im Block einstellungen und gehört zum Pass', () => {
    expect(SYNCED_KEYS.belohnungen).toBe(REWARDS_HIDDEN_KEY);
    expect(nameToKey('belohnungen')).toBe(REWARDS_HIDDEN_KEY);
    expect(SCOPED_KEYS).toContain(REWARDS_HIDDEN_KEY);
  });
});
