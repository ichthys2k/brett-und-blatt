import { describe, expect, it } from 'vitest';
import { hasSprintCatalog } from '@brett-und-blatt/game-category-sprint';
import { hasDuelCatalog } from '@brett-und-blatt/game-describe-duel';
import { hasWhoCatalog } from '@brett-und-blatt/game-who-am-i';
import { wortspielKataloge } from '../src/wortspiele';

/* Die Wortspiel-Kataloge liegen auf dem Server, nicht im Browser-Bundle (wie beim Bibel-Quiz). */
describe('Wortspiel-Kataloge auf dem Server', () => {
  it('liefert alle Kataloge aus', () => {
    expect(Object.keys(wortspielKataloge).sort()).toEqual(['/klassenspiele/mehrheit', '/klassenspiele/schaetzen', '/klassenspiele/zeitstrahl', '/wortspiele/begriffe', '/wortspiele/kategorien', '/wortspiele/wer-bin-ich']);
  });

  it('setzt die Kataloge für Online-Räume und Bots', () => {
    expect(hasSprintCatalog()).toBe(true);
    expect(hasWhoCatalog()).toBe(true);
    expect(hasDuelCatalog()).toBe(true);
  });
});
