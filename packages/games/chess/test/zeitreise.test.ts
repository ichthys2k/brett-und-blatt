import { describe, expect, it } from 'vitest';
import { ERAS, ERA_NAMES, nextEra } from '../src/ui/zeitreise';

describe('Zeitmaschine (#512)', () => {
  it('reist von der Gegenwart durch alle Jahrgänge und wieder zurück', () => {
    const visited: string[] = [];
    let era = nextEra(null);
    while (era) {
      visited.push(era);
      era = nextEra(era);
    }
    expect(visited).toEqual([...ERAS]);
  });

  it('nennt jeden Jahrgang', () => {
    for (const era of ERAS) expect(ERA_NAMES[era]).toBeTruthy();
  });

  it('Jahrgänge stehen in zeitlicher Reihenfolge', () => {
    expect([...ERAS].sort()).toEqual([...ERAS]);
  });
});
