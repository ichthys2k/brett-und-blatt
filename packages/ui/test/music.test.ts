import { describe, expect, it } from 'vitest';
import { defaultPlaylist, musicTracks, pickTrack, playableTracks, playlists, playlistTracks, type MusicPrefs, type MusicTrack } from '../src/audio/music';

const track = (id: string): MusicTrack => ({ id, title: id, file: `${id}.mp3`, playlist: 'test' });
const prefs = (over: Partial<MusicPrefs> = {}): MusicPrefs => ({ starred: [], excluded: [], onlyStars: false, ...over });

describe('Musik-Katalog', () => {
  it('hat gültige Playlists und Stücke', () => {
    const ids = playlists.map((list) => list.id);
    expect(new Set(ids).size).toBe(ids.length);
    const games = playlists.flatMap((list) => list.games);
    expect(new Set(games).size, 'jedes Spiel nur in einer Playlist').toBe(games.length);
    const trackIds = musicTracks.map((item) => item.id);
    expect(new Set(trackIds).size).toBe(trackIds.length);
    for (const item of musicTracks) {
      expect(ids, item.id).toContain(item.playlist);
      expect(item.file, item.id).toBe(`${item.id}.mp3`);
      expect(item.id, item.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('ordnet Spiele ihren Playlists zu, unbekannte dem Spielabend', () => {
    expect(defaultPlaylist('chess')).toBe('denkraum');
    expect(defaultPlaylist('solitaire')).toBe('patience');
    expect(defaultPlaylist('gibt-es-nicht')).toBe('spielabend');
  });

  it('spielt bei einer leeren Playlist alle Stücke', () => {
    const empty = playlists.find((list) => !musicTracks.some((item) => item.playlist === list.id));
    if (empty) expect(playlistTracks(empty.id)).toEqual(musicTracks);
  });
});

describe('playableTracks', () => {
  const tracks = [track('a'), track('b'), track('c')];

  it('lässt ausgeschlossene weg', () => {
    expect(playableTracks(tracks, prefs({ excluded: ['b'] })).map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('nimmt mit „Nur Sterne“ nur Sterne – ohne Sterne alle erlaubten', () => {
    expect(playableTracks(tracks, prefs({ onlyStars: true, starred: ['c'] })).map((item) => item.id)).toEqual(['c']);
    expect(playableTracks(tracks, prefs({ onlyStars: true, excluded: ['a'] })).map((item) => item.id)).toEqual(['b', 'c']);
  });
});

describe('pickTrack', () => {
  const tracks = [track('a'), track('b'), track('c')];

  it('wiederholt nicht direkt', () => {
    for (let i = 0; i < 20; i++) expect(pickTrack(tracks, prefs(), ['a'], () => i / 20)?.id).not.toBe('a');
  });

  it('spielt ein einzelnes Stück trotzdem wieder', () => {
    expect(pickTrack([track('a')], prefs(), ['a'])?.id).toBe('a');
    expect(pickTrack([], prefs(), [])).toBeNull();
  });

  it('gewichtet Sterne doppelt', () => {
    // Gewichte a=2, b=1, c=1: die erste Hälfte des Zufallsbereichs gehört a.
    expect(pickTrack(tracks, prefs({ starred: ['a'] }), [], () => 0.49)?.id).toBe('a');
    expect(pickTrack(tracks, prefs({ starred: ['a'] }), [], () => 0.51)?.id).toBe('b');
    expect(pickTrack(tracks, prefs({ starred: ['a'] }), [], () => 0.99)?.id).toBe('c');
  });
});
