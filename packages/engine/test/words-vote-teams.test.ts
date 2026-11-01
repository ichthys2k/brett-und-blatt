import { describe, expect, it } from 'vitest';
import {
  abstainBallot,
  castBallot,
  cleanEntry,
  editDistance,
  findWord,
  forbiddenWordIn,
  initialLetter,
  isBlockedText,
  normalizeWord,
  openVote,
  pendingVoters,
  rankProposals,
  sameWord,
  shuffledTeams,
  tally,
  teamMembers,
  teamOption,
  teamsFromOptions,
  voteComplete,
  voteView,
  voteWinner,
  wordStem,
} from '../src';

describe('Texteingabe (words.ts)', () => {
  it('normalisiert Groß- und Kleinschreibung, Umlaute, ß und Satzzeichen', () => {
    expect(normalizeWord('Bären-Höhle')).toBe('BAERENHOEHLE');
    expect(normalizeWord('  Straße ')).toBe('STRASSE');
    expect(normalizeWord('Café')).toBe('CAFE');
    expect(normalizeWord('Baerenhoehle')).toBe(normalizeWord('Bärenhöhle'));
  });

  it('nimmt beim Anfangsbuchstaben den Grundbuchstaben', () => {
    expect(initialLetter('Ärztin')).toBe('A');
    expect(initialLetter(' öl')).toBe('O');
    expect(initialLetter('123')).toBe('');
  });

  it('wertet ab fünf Buchstaben einen Tippfehler als gleich, kurze Wörter nicht', () => {
    expect(editDistance('KATZE', 'KATZEN')).toBe(1);
    expect(editDistance('ABCDEF', 'UVWXYZ', 2)).toBe(3);
    expect(sameWord('Elefant', 'Elefnat')).toBe(false); // zwei Fehler (Vertauschung zählt doppelt)
    expect(sameWord('Elefant', 'Elephant')).toBe(false);
    expect(sameWord('Elefant', 'Elefannt')).toBe(true);
    expect(sameWord('Giraffe', 'giraffe')).toBe(true);
    expect(sameWord('Hund', 'Mund')).toBe(false);
    expect(sameWord('Hund', 'hund')).toBe(true);
    expect(findWord('Krokodiel', ['Kamel', 'Krokodil'])).toBe('Krokodil');
    expect(findWord('Kamel', ['Krokodil', 'Kamel'])).toBe('Kamel');
    expect(findWord('Katze', ['Kamel'])).toBeNull();
  });

  it('bereinigt Eingaben: Leerraum, Länge, unpassende Wörter', () => {
    expect(cleanEntry('  Berlin   Mitte ')).toBe('Berlin Mitte');
    expect(cleanEntry('x'.repeat(50))).toHaveLength(30);
    expect(cleanEntry('')).toBeNull();
    expect(cleanEntry(42)).toBeNull();
    expect(cleanEntry('Arsch')).toBeNull();
    expect(cleanEntry('a r s c h')).toBeNull();
    expect(isBlockedText('Essex')).toBe(false);
    expect(isBlockedText('Warschau')).toBe(false);
    expect(isBlockedText('Flussbarsch')).toBe(false);
    expect(isBlockedText('Barscharsch')).toBe(true);
    expect(isBlockedText('das Ex')).toBe(false);
    expect(isBlockedText('Sechs')).toBe(false);
  });

  it('findet Sperrwörter auch gebeugt, zusammengesetzt und mit Tippfehler', () => {
    expect(wordStem('Hundes')).toBe('HUND');
    expect(forbiddenWordIn('Er bellt laut', ['Hund'])).toBeNull();
    expect(forbiddenWordIn('Die Hunde bellen', ['Hund'])).toBe('Hund');
    expect(forbiddenWordIn('Eine Hundehütte', ['Hund'])).toBe('Hund');
    expect(forbiddenWordIn('viele Bäume', ['Baum'])).toBe('Baum');
    expect(forbiddenWordIn('ein Schloss', ['Schlüssel'])).toBeNull();
    expect(forbiddenWordIn('mit Schlüsseln', ['Schlüssel'])).toBe('Schlüssel');
    expect(forbiddenWordIn('Elefnt', ['Elefant'])).toBe('Elefant');
  });

  it('zählt gleiche Vorschläge zusammen, Reihenfolge entscheidet bei Gleichstand', () => {
    expect(rankProposals([['Rüssel', 'grau'], ['grau', 'Afrika'], ['Rüsel', 'groß']])).toEqual([
      { word: 'Rüssel', votes: 2 },
      { word: 'grau', votes: 2 },
      { word: 'Afrika', votes: 1 },
      { word: 'groß', votes: 1 },
    ]);
    // Doppelt im selben Vorschlag zählt einmal.
    expect(rankProposals([['grau', 'Grau']])).toEqual([{ word: 'grau', votes: 1 }]);
  });
});

describe('Abstimmung (vote.ts)', () => {
  it('sammelt geheime Stimmen und zeigt sie erst am Ende', () => {
    let box = openVote(4, [0, 1, 2], { items: 2, choices: 2, excluded: [[0], []] });
    expect(pendingVoters(box)).toEqual([0, 1, 2]);
    box = castBallot(box, 0, [1, 0]);
    box = castBallot(box, 1, [1, 1]);
    expect(voteComplete(box)).toBe(false);
    const seen = voteView(box, 2);
    expect(seen.ballots[0]).toEqual([null, null]);
    expect(seen.ballots[2]).toBeNull();
    expect(voteView(box, 0).ballots[0]).toEqual([null, 0]); // eigene Stimme zur eigenen Frage zählt nicht
    expect(() => castBallot(box, 1, [0, 0])).toThrow();
    expect(() => castBallot(box, 3, [0, 0])).toThrow();
    box = castBallot(box, 2, abstainBallot(box));
    expect(voteComplete(box)).toBe(true);
    expect(voteView(box, 2)).toEqual(box);
    expect(tally(box, 0)).toEqual([0, 1]);
    expect(voteWinner(box, 0, 0)).toBe(1);
    expect(tally(box, 1)).toEqual([1, 1]);
    expect(voteWinner(box, 1, 0)).toBe(0);
    expect(voteWinner(box, 1)).toBeNull();
  });
});

describe('Teams (teams.ts)', () => {
  it('liest die Option und fällt sonst auf den Wechsel zurück', () => {
    expect(teamOption().hidden).toBe(true);
    expect(teamsFromOptions({}, 5)).toEqual([0, 1, 0, 1, 0]);
    expect(teamsFromOptions({ teams: '1,1,0,0' }, 4)).toEqual([1, 1, 0, 0]);
    expect(teamsFromOptions({ teams: '1,1,0' }, 4)).toEqual([0, 1, 0, 1]);
    expect(teamsFromOptions({ teams: '1,1,1,0' }, 4, 2, 2)).toEqual([0, 1, 0, 1]);
    expect(teamMembers([1, 0, 1, 0], 1)).toEqual([0, 2]);
  });

  it('verteilt zufällig und gleichmäßig', () => {
    let x = 0.37;
    const random = () => (x = (x * 9301 + 0.49297) % 1);
    const teams = shuffledTeams(7, 2, random);
    expect(teams.filter((t) => t === 0)).toHaveLength(4);
    expect(teams.filter((t) => t === 1)).toHaveLength(3);
  });
});
