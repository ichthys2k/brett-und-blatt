import { describe, expect, it } from 'vitest';
import {
  BOARD_PUSH_MAX_AGE_MS,
  SEEK_AWAY_MS,
  SeekingBoard,
  boardPushFromJSON,
  boardPushKinds,
  boardPushToJSON,
  deliverBoardPush,
  newBoardPushState,
  parseBoardMessage,
  type PushResult,
  type PushSender,
  type PushSubscriptionData,
} from '../src';

const key = (n: number) => btoa(String.fromCharCode(...new Uint8Array(n).fill(1))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sub: PushSubscriptionData = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: key(65), auth: key(16) } };

function sender(result: PushResult = 'ok') {
  const calls: { payload: unknown; ttl: number; topic?: string }[] = [];
  const impl: PushSender = { send: async (_s, payload, opts) => (calls.push({ payload: JSON.parse(payload), ttl: opts.ttl, topic: opts.topic }), result) };
  return { impl, calls };
}

describe('Brett: Nachrichten für Hinweise aufs Gerät', () => {
  it('liest Abo und Widerruf, verwirft Unbrauchbares', () => {
    expect(parseBoardMessage(JSON.stringify({ type: 'pushSubscribe', subscription: sub }))).toEqual({ type: 'pushSubscribe', subscription: sub });
    expect(parseBoardMessage(JSON.stringify({ type: 'pushUnsubscribe' }))).toEqual({ type: 'pushUnsubscribe' });
    expect(parseBoardMessage(JSON.stringify({ type: 'pushSubscribe', subscription: { endpoint: 'https://evil.example/x', keys: sub.keys } }))).toBeNull();
    expect(parseBoardMessage(JSON.stringify({ type: 'pushSubscribe' }))).toBeNull();
  });
});

describe('Brett: Signatur und fällige Hinweise', () => {
  it('meldet neue Zustimmungen und neue Vorschläge, nicht alte', () => {
    expect(boardPushKinds(undefined, { votes: 3, proposal: 'z1:duo' })).toEqual([]);
    expect(boardPushKinds({ votes: 0, proposal: null }, { votes: 1, proposal: null })).toEqual(['boardYes']);
    expect(boardPushKinds({ votes: 1, proposal: null }, { votes: 1, proposal: 'z1:duo' })).toEqual(['boardProposal']);
    expect(boardPushKinds({ votes: 1, proposal: 'z1:duo' }, { votes: 1, proposal: 'z1:duo' })).toEqual([]);
    expect(boardPushKinds({ votes: 2, proposal: null }, { votes: 1, proposal: null })).toEqual([]);
  });

  it('pushSignature zählt Stimmen auf dem eigenen Zettel und wartende Vorschläge', () => {
    let time = 1_000_000;
    const games = [{ id: 'duo', min: 2, max: 2 }];
    const board = new SeekingBoard({ now: () => time, game: (id) => games.find((g) => g.id === id), games: () => games, room: () => undefined, random: () => 0 });
    board.post('anna', { name: 'Anna', avatar: '🦊', games: ['duo'], seats: 'any', mood: 'relaxed' });
    expect(board.pushSignature('anna')).toEqual({ votes: 0, proposal: null });
    board.join('ben', board.view('anna').notes[0]!.id, 'duo', 'Ben');
    expect(board.pushSignature('anna')).toEqual({ votes: 1, proposal: null }); // Anna hat als Verfasserin schon bestätigt
    expect(board.pushSignature('ben').proposal).toMatch(/^z\d+:duo$/);
    time += 1;
  });
});

describe('Brett: Zettel mit Abo bleiben bei geschlossenem Browser hängen', () => {
  it('ohne Abo fällt der Zettel nach dem Weggehen ab, mit Abo nicht', () => {
    let time = 1_000_000;
    const games = [{ id: 'duo', min: 2, max: 2 }];
    let keep = false;
    const board = new SeekingBoard({ now: () => time, game: (id) => games.find((g) => g.id === id), games: () => games, room: () => undefined, random: () => 0, keepAway: () => keep });
    board.post('anna', { name: 'Anna', avatar: '🦊', games: ['duo'], seats: 'any', mood: 'relaxed' });
    board.markAway('anna', true);
    keep = true;
    time += SEEK_AWAY_MS + 1;
    board.tick();
    expect(board.size).toBe(1);
    keep = false;
    board.tick();
    expect(board.size).toBe(0);
  });
});

describe('Brett: Versand', () => {
  it('sendet nur mit Abo, mit Spam-Schutz, ohne Namen', async () => {
    const state = newBoardPushState();
    const { impl, calls } = sender();
    expect(await deliverBoardPush(state, 'anna', 'boardYes', '#/brett', impl, 1000)).toBe(false);
    state.book.set('anna', sub, 1000);
    expect(await deliverBoardPush(state, 'anna', 'boardYes', '#/brett', impl, 1000)).toBe(true);
    expect(await deliverBoardPush(state, 'anna', 'boardYes', '#/brett', impl, 2000)).toBe(false); // 30 Minuten je Art
    expect(await deliverBoardPush(state, 'anna', 'boardRoom', '#/raum/ABCD', impl, 2000)).toBe(true);
    expect(calls.map((c) => c.payload)).toEqual([
      { k: 'boardYes', u: '#/brett' },
      { k: 'boardRoom', u: '#/raum/ABCD' },
    ]);
    expect(calls[0]!.topic).toBe('b-boardYes');
  });

  it('entzieht das Abo bei „gone“ und überlebt einen Fehler', async () => {
    const state = newBoardPushState();
    state.book.set('anna', sub, 1000);
    expect(await deliverBoardPush(state, 'anna', 'boardYes', '#/brett', sender('gone').impl, 1000)).toBe(false);
    expect(state.book.has('anna')).toBe(false);
    state.book.set('anna', sub, 1000);
    const boom: PushSender = { send: async () => { throw new Error('kaputt'); } };
    expect(await deliverBoardPush(state, 'anna', 'boardYes', '#/brett', boom, 5_000_000)).toBe(false);
  });

  it('speichert und lädt den Zustand, Abos altern nach drei Stunden', () => {
    const state = newBoardPushState();
    state.book.set('anna', sub, 1000);
    state.limiter.allow('anna', 'boardYes', 1000);
    const loaded = boardPushFromJSON(JSON.parse(JSON.stringify(boardPushToJSON(state))));
    expect(loaded.book.has('anna')).toBe(true);
    expect(loaded.limiter.allow('anna', 'boardYes', 2000)).toBe(false);
    expect(loaded.book.prune(BOARD_PUSH_MAX_AGE_MS, 1000 + BOARD_PUSH_MAX_AGE_MS + 1)).toBe(1);
  });
});
