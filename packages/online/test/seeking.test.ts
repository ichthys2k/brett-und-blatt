import { describe, expect, it } from 'vitest';
import { SEEK_ANY, SEEK_AWAY_MS, SEEK_MAX_NOTES, SEEK_NOTE_MS, SEEK_POST_GAP_MS, SEEK_PROPOSAL_MS, SEEK_VOTES_PER_MINUTE, SeekingBoard, type SeekDeps, type SeekGame } from '../src';

const games: SeekGame[] = [
  { id: 'duo', min: 2, max: 2 },
  { id: 'skat', min: 3, max: 3 },
  { id: 'party', min: 2, max: 6 },
  { id: 'big', min: 3, max: 6 },
];

function setup(saved?: ConstructorParameters<typeof SeekingBoard>[1]) {
  let time = 1_000_000;
  const deps: SeekDeps = { now: () => time, game: (id) => games.find((g) => g.id === id), games: () => games, room: (code) => openRooms.get(code), random: () => 0 };
  const board = new SeekingBoard(deps, saved);
  return { board, advance: (ms: number) => (time += ms), deps };
}

/** Offene Runden, wie das Verzeichnis sie kennt – ein Test darf sie wieder schließen. */
const openRooms = new Map<string, { gameId: string }>([['🦊🍎🚀🎈', { gameId: 'party' }]]);

const note = (games: string[] = ['duo'], extra = {}) => ({ name: 'Anna', avatar: '🦊', games, seats: 'any', mood: 'relaxed', ...extra });

describe('Schwarzes Brett', () => {
  it('hängt einen Zettel auf und ersetzt den alten derselben Person', () => {
    const { board, advance } = setup();
    expect(board.post('a', note()).ok).toBe(true);
    advance(SEEK_POST_GAP_MS + 1);
    expect(board.post('a', note(['skat'])).ok).toBe(true);
    const view = board.view('a');
    expect(view.notes).toHaveLength(1);
    expect(view.notes[0]).toMatchObject({ games: ['skat'], mine: true, joined: null });
  });

  it('prüft Auswahllisten, Namen und Wunschspiele', () => {
    const { board, advance } = setup();
    expect(board.post('a', note(['gibt-es-nicht'])).error).toBe('games');
    advance(SEEK_POST_GAP_MS + 1);
    expect(board.post('a', note(['duo', 'skat', 'party', 'duo'])).ok).toBe(true); // doppelt zählt einmal
    advance(SEEK_POST_GAP_MS + 1);
    expect(board.post('a', note(['duo'], { seats: '9' })).error).toBe('seats');
    advance(SEEK_POST_GAP_MS + 1);
    expect(board.post('a', note(['duo'], { mood: 'wild' })).error).toBe('mood');
    advance(SEEK_POST_GAP_MS + 1);
    expect(board.post('a', note(['duo'], { name: '   ' })).error).toBe('name');
    advance(SEEK_POST_GAP_MS + 1);
    expect(board.post('a', note(['duo', 'skat', 'party', 'random'])).error).toBe('games');
  });

  it('sperrt zu schnelles Neuanlegen', () => {
    const { board } = setup();
    expect(board.post('a', note()).ok).toBe(true);
    expect(board.post('a', note()).error).toBe('rate');
  });

  it('macht ohne Wunschspiel einen Zettel „Egal“', () => {
    const { board } = setup();
    board.post('a', note([]));
    expect(board.view('a').notes[0]!.games).toEqual([SEEK_ANY]);
  });

  it('zieht Zustimmungen je Zettel und erlaubt keine Stimme für den eigenen Zettel', () => {
    const { board } = setup();
    board.post('a', note(['skat']));
    const id = board.view('a').notes[0]!.id;
    expect(board.join('a', id, 'skat').error).toBe('own');
    expect(board.join('b', id, 'duo').error).toBe('games');
    expect(board.join('b', id, 'skat', 'Ben').ok).toBe(true);
    expect(board.view('a').notes[0]!.votes).toEqual({ skat: 1 });
    expect(board.view('b').notes[0]!.joined).toBe('skat');
    expect(board.view('a').proposal).toBeNull(); // Skat braucht drei
    board.unjoin('b', id);
    expect(board.view('a').notes[0]!.votes).toEqual({});
  });

  it('schlägt ein Spiel vor, sobald genug zustimmen, und legt es nach allen Bestätigungen fest', () => {
    const { board } = setup();
    board.post('a', note(['skat']));
    const id = board.view('a').notes[0]!.id;
    board.join('b', id, 'skat', 'Ben');
    board.join('c', id, 'skat', 'Chris');
    const view = board.view('b');
    expect(view.proposal).toMatchObject({ noteId: id, gameId: 'skat', names: ['Anna', 'Ben', 'Chris'], confirmed: 1, total: 3, youConfirmed: false });
    expect(board.confirm('b', id, true).matches).toEqual([]);
    const done = board.confirm('c', id, true);
    expect(done.matches).toEqual([{ gameId: 'skat', host: 'a', owners: ['a', 'b', 'c'] }]);
    // Alle sind vermittelt: nichts hängt mehr.
    expect(board.size).toBe(0);
    expect(board.view('a').proposal).toBeNull();
  });

  it('nimmt eine Stimme zurück, wenn jemand den Vorschlag ablehnt, und schlägt neu vor, wenn es noch reicht', () => {
    const { board } = setup();
    board.post('a', note(['party']));
    const id = board.view('a').notes[0]!.id;
    board.join('b', id, 'party', 'Ben');
    expect(board.view('a').proposal).toMatchObject({ total: 2 });
    board.confirm('b', id, false);
    expect(board.view('b').proposal).toBeNull();
    expect(board.view('a').notes[0]!.votes).toEqual({});
    // Mit einem Spiel für drei: Ben und Chris stimmen zu, Ben lehnt ab – mit Chris allein reicht es nicht.
    board.unjoin('b', id);
    const big = setup();
    big.board.post('a', note(['big']));
    const bigId = big.board.view('a').notes[0]!.id;
    big.board.join('b', bigId, 'big', 'Ben');
    big.board.join('c', bigId, 'big', 'Chris');
    expect(big.board.view('a').proposal).toMatchObject({ total: 3, names: ['Anna', 'Ben', 'Chris'] });
    big.board.join('d', bigId, 'big', 'Dora'); // wartet, bis jemand ausfällt
    big.board.confirm('b', bigId, false);
    expect(big.board.view('a').proposal).toMatchObject({ total: 3, names: ['Anna', 'Chris', 'Dora'] });
  });

  it('beendet einen Vorschlag nach der Frist mit denen, die bestätigt haben', () => {
    const { board, advance } = setup();
    board.post('a', note(['big']));
    const id = board.view('a').notes[0]!.id;
    for (const [voter, name] of [['b', 'Ben'], ['c', 'Chris'], ['d', 'Dora'], ['e', 'Eva']] as const) board.join(voter, id, 'big', name);
    // Ben lehnt ab: Anna, Chris, Dora und Eva stehen im neuen Vorschlag – für drei Plätze reichen drei Bestätigungen.
    board.confirm('b', id, false);
    expect(board.view('a').proposal).toMatchObject({ total: 4 });
    board.confirm('c', id, true);
    board.confirm('d', id, true);
    advance(SEEK_PROPOSAL_MS + 1);
    expect(board.tick()).toEqual([{ gameId: 'big', host: 'a', owners: ['a', 'c', 'd'] }]);
    expect(board.size).toBe(0);
  });

  it('lässt einen unbestätigten Vorschlag fallen, wenn zu wenige bestätigen', () => {
    const { board, advance } = setup();
    board.post('a', note(['skat']));
    const id = board.view('a').notes[0]!.id;
    board.join('b', id, 'skat', 'Ben');
    board.join('c', id, 'skat', 'Chris');
    board.confirm('b', id, true);
    advance(SEEK_PROPOSAL_MS + 1);
    expect(board.tick()).toEqual([]);
    expect(board.view('a').proposal).toBeNull();
    expect(board.view('a').notes[0]!.votes).toEqual({ skat: 1 }); // nur Ben, der bestätigt hatte, bleibt dabei
    expect(board.size).toBe(1);
  });

  it('zieht bei „Egal“ ein passendes Spiel', () => {
    const { board } = setup();
    board.post('a', note([]));
    const id = board.view('a').notes[0]!.id;
    board.join('b', id, SEEK_ANY, 'Ben');
    expect(board.view('a').proposal).toMatchObject({ gameId: 'duo', total: 2 });
  });

  it('nimmt vermittelte Personen von allen Zetteln und Vorschlägen', () => {
    const { board, advance } = setup();
    board.post('a', note(['duo']));
    advance(SEEK_POST_GAP_MS + 1);
    board.post('x', note(['duo'], { name: 'Xaver' }));
    const [idA, idX] = [board.view('a').notes.find((n) => n.mine)!.id, board.view('x').notes.find((n) => n.mine)!.id];
    board.join('b', idA, 'duo', 'Ben');
    board.join('b', idX, 'duo', 'Ben');
    expect(board.view('b').proposal).not.toBeNull();
    board.confirm('b', idA, true);
    // Ben ist bei Anna vermittelt; Xavers Vorschlag mit Ben ist weg, Xaver hängt weiter.
    expect(board.view('x').notes.map((n) => n.name)).toEqual(['Xaver']);
    expect(board.view('x').proposal).toBeNull();
    expect(board.view('x').notes[0]!.votes).toEqual({});
  });

  it('begrenzt „Bin dabei“ je Minute', () => {
    const { board, advance } = setup();
    for (let i = 0; i < SEEK_VOTES_PER_MINUTE + 1; i++) {
      advance(SEEK_POST_GAP_MS + 1);
      board.post(`n${i}`, note(['skat'], { name: `N${i}` }));
    }
    const ids = board.view('v').notes.map((n) => n.id);
    const results = ids.slice(0, SEEK_VOTES_PER_MINUTE + 1).map((id) => board.join('v', id, 'skat', 'Vera'));
    expect(results.filter((r) => r.error === 'rate')).toHaveLength(1);
  });

  it('nimmt Zettel nach 30 Minuten, nach Weggehen und bei Überfüllung ab; Verlängern hilft', () => {
    const { board, advance } = setup();
    board.post('a', note());
    advance(SEEK_NOTE_MS - 1000);
    board.extend('a');
    advance(SEEK_NOTE_MS - 1000);
    board.tick();
    expect(board.size).toBe(1);
    advance(2000);
    board.tick();
    expect(board.size).toBe(0);

    board.post('b', note());
    board.markAway('b', true);
    advance(SEEK_AWAY_MS - 1);
    board.tick();
    expect(board.size).toBe(1);
    board.markAway('b', false);
    advance(SEEK_AWAY_MS * 2);
    board.tick();
    expect(board.size).toBe(1);
    board.markAway('b', true);
    advance(SEEK_AWAY_MS);
    board.tick();
    expect(board.size).toBe(0);

    for (let i = 0; i < SEEK_MAX_NOTES + 5; i++) {
      advance(SEEK_POST_GAP_MS + 1);
      board.post(`o${i}`, note(['duo'], { name: `O${i}` }));
      board.extend(`o${i}`);
    }
    expect(board.size).toBe(SEEK_MAX_NOTES);
    expect(board.view(null).notes.some((n) => n.name === 'O0')).toBe(false);
  });

  it('weckt zur richtigen Zeit und übersteht ein Speichern', () => {
    const { board, advance, deps } = setup();
    expect(board.nextWakeup()).toBeNull();
    board.post('a', note(['skat']));
    const id = board.view('a').notes[0]!.id;
    board.join('b', id, 'skat', 'Ben');
    expect(board.nextWakeup()).toBe(1_000_000 + SEEK_NOTE_MS);
    board.join('c', id, 'skat', 'Chris');
    expect(board.nextWakeup()).toBe(1_000_000 + SEEK_PROPOSAL_MS);
    const copy = new SeekingBoard(deps, JSON.parse(JSON.stringify(board.toJSON())));
    expect(copy.view('b').proposal).toMatchObject({ names: ['Anna', 'Ben', 'Chris'] });
    advance(1);
  });
});

import { parseBoardMessage } from '../src';

describe('Nachrichten des Schwarzen Bretts', () => {
  it('liest gültige und verwirft ungültige', () => {
    expect(parseBoardMessage(JSON.stringify({ type: 'hello', token: 'x'.repeat(40) }))).toEqual({ type: 'hello', token: 'x'.repeat(40) });
    expect(parseBoardMessage(JSON.stringify({ type: 'hello', token: 'kurz' }))).toBeNull();
    expect(parseBoardMessage('{"type":"withdraw"}')).toEqual({ type: 'withdraw' });
    expect(parseBoardMessage('{"type":"join","noteId":"z1","gameId":"skat","name":"Ben"}')).toEqual({ type: 'join', noteId: 'z1', gameId: 'skat', name: 'Ben' });
    expect(parseBoardMessage('{"type":"join","noteId":"z1"}')).toBeNull();
    expect(parseBoardMessage('{"type":"confirm","noteId":"z1","ok":"ja"}')).toBeNull();
    expect(parseBoardMessage('{"type":"post","name":"Anna","avatar":"🦊","games":["a","b"],"seats":"any","mood":"relaxed"}')).toMatchObject({ type: 'post', games: ['a', 'b'] });
    expect(parseBoardMessage('{"type":"post","name":"Anna","avatar":"🦊","games":[1],"seats":"any","mood":"relaxed"}')).toBeNull();
    expect(parseBoardMessage('kein json')).toBeNull();
    expect(parseBoardMessage('[]')).toBeNull();
    expect(parseBoardMessage('{"type":"x"}')).toBeNull();
    expect(parseBoardMessage('x'.repeat(2001))).toBeNull();
  });
});

describe('Zettel für eine offene Runde', () => {
  const room = '🦊🍎🚀🎈';
  const post = (extra = {}) => ({ name: 'Anna', avatar: '🦊', code: room, seats: 'any', mood: 'relaxed', ...extra });

  it('hängt eine bestehende offene Runde als Zettel auf, ohne Abstimmung', () => {
    const { board } = setup();
    expect(board.postRoom('a', post()).ok).toBe(true);
    const view = board.view('b');
    expect(view.notes[0]).toMatchObject({ name: 'Anna', games: ['party'], room });
    expect(board.join('b', view.notes[0]!.id, 'party', 'Ben').error).toBe('room');
    expect(board.view('b').proposal).toBeNull();
  });

  it('verlangt eine wirklich offene Runde und gültige Auswahlwerte', () => {
    const { board, advance } = setup();
    expect(board.postRoom('a', post({ code: '🐶🐶🐶🐶' })).error).toBe('room');
    advance(SEEK_POST_GAP_MS + 1);
    expect(board.postRoom('a', post({ mood: 'wild' })).error).toBe('mood');
    advance(SEEK_POST_GAP_MS + 1);
    expect(board.postRoom('a', post({ seats: '99' })).error).toBe('seats');
    advance(SEEK_POST_GAP_MS + 1);
    expect(board.postRoom('a', post({ name: '  ' })).error).toBe('name');
  });

  it('bleibt trotz Weggehen hängen, solange die Runde offen ist, und fällt weg, wenn sie schließt', () => {
    const { board, advance } = setup();
    board.postRoom('a', post());
    board.markAway('a', true);
    advance(SEEK_AWAY_MS * 3);
    board.tick();
    expect(board.size).toBe(1);
    openRooms.delete(room);
    board.tick();
    expect(board.size).toBe(0);
    openRooms.set(room, { gameId: 'party' });
  });

  it('ersetzt den eigenen Zettel und liest die Nachricht', () => {
    const { board, advance } = setup();
    board.post('a', note(['duo']));
    advance(SEEK_POST_GAP_MS + 1);
    board.postRoom('a', post());
    expect(board.view('a').notes).toHaveLength(1);
    expect(board.view('a').notes[0]!.room).toBe(room);
    expect(parseBoardMessage(JSON.stringify({ type: 'postRoom', name: 'Anna', avatar: '🦊', code: room, seats: 'any', mood: 'relaxed' }))).toMatchObject({ type: 'postRoom', code: room });
    expect(parseBoardMessage('{"type":"postRoom","name":"Anna"}')).toBeNull();
  });
});
