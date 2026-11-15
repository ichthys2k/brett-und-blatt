import { useEffect } from 'react';
import { categoryOf } from '../screens/Home';
import { SCENE_BY_CATEGORY, SCENE_BY_GAME } from './sceneTable';

/**
 * Kulissen der Spiele (#316): Zu jedem Spiel gehört eine gemalte Kulisse als Seitenhintergrund (Einrichtung, Lobby,
 * Spieltisch-Rand, Tisch-Bildschirm). Spiel-Kulisse vor Rubrik-Kulisse; das Spielfeld selbst bleibt auf seiner Tischfläche.
 */
const FILES = import.meta.glob<string>('../assets/kulissen/*.webp', { eager: true, query: '?url', import: 'default' });

/** Kennung der Kulisse eines Spiels (Spiel vor Rubrik). */
export function sceneFor(gameId: string): string {
  return SCENE_BY_GAME[gameId] ?? SCENE_BY_CATEGORY[categoryOf(gameId)] ?? 'rubrik-familie';
}

/** Adresse der Kulisse; `large` ist die @2x-Fassung (2560 × 1440) für den Tisch-Bildschirm. */
export function sceneUrl(sceneId: string, large = false): string | undefined {
  return FILES[`../assets/kulissen/${sceneId}${large ? '@2x' : ''}.webp`];
}

/**
 * Legt die Kulisse des Spiels als Seitenhintergrund fest (Attribut `data-scene` und Variable `--bub-scene` auf <html>);
 * die Regeln stehen in look.css und gelten nur im Taverne-Aussehen und solange der Schalter „Kulissen der Spiele“ an ist.
 */
export function useGameScene(gameId: string | undefined, large = false): void {
  useEffect(() => {
    if (!gameId) return undefined;
    const url = sceneUrl(sceneFor(gameId), large);
    const root = document.documentElement;
    if (!url) return undefined;
    root.dataset.scene = sceneFor(gameId);
    root.style.setProperty('--bub-scene', `url("${url}")`);
    return () => {
      delete root.dataset.scene;
      root.style.removeProperty('--bub-scene');
    };
  }, [gameId, large]);
}
