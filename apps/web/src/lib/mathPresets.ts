import type { GameInfo } from '@brett-und-blatt/engine';
import { fitsPlayers } from './gameCatalog';

/*
 * Mathe-Modi in beliebten Klassikern (Spielübersicht, Rubrik Mathe): vorgefertigte Einstellungen,
 * die über `paths.setup(gameId, params)` starten. Herausgelöst aus `screens/Home.tsx` (#610).
 */

export interface MathPresetCard {
  id: string;
  gameId: string;
  emoji: string;
  title: string;
  description: string;
  badge: string;
  params: Record<string, string>;
}

export const MATH_CLASSIC_PRESETS: readonly MathPresetCard[] = [
  {
    id: 'math-bingo',
    gameId: 'bingo',
    emoji: '🎱',
    title: 'Mathe-Bingo',
    description: 'Kleines & großes 1×1, Kopfrechnen, Größen, Teiler, Brüche oder Ganze Zahlen für bis zu 30 Plätze.',
    badge: '1–30 Spieler · 7 Themenpakete',
    params: { content: 'einmaleins' },
  },
  {
    id: 'math-pairs',
    gameId: 'pairs',
    emoji: '🃏',
    title: 'Mathe-Paare finden',
    description: 'Wertgleiche Brüche & Prozente, Einheiten, Potenzen oder Einmaleins-Paare im Gedächtnisspiel aufdecken.',
    badge: '1–6 Spieler · 7 Themenpakete',
    params: { content: 'brueche' },
  },
  {
    id: 'math-battleship',
    gameId: 'battleship',
    emoji: '🚢',
    title: 'Koordinaten-Schiffe-versenken',
    description: 'Schiffe im 1. Quadranten P(1|1)..P(10|10) oder im Achsenkreuz aller 4 Quadranten (−5 bis +5) orten.',
    badge: '2 Spieler · Koordinatensystem',
    params: { coords: 'quadrants4' },
  },
  {
    id: 'math-dominoes',
    gameId: 'dominoes',
    emoji: '🁣',
    title: 'Mathe-Domino',
    description: 'Dominosteine mit Rechentermen (Kl. 5) oder Brüchen & Dezimalzahlen (Kl. 6) passend anlegen.',
    badge: '2–4 Spieler · Terme & Brüche',
    params: { display: 'terms' },
  },
  {
    id: 'math-uno',
    gameId: 'uno',
    emoji: '🃏',
    title: 'Mathe-Eins!',
    description: 'Zahlenkarten (0–9) zeigen Kopfrechenaufgaben, Potenzen und Brüche statt der Ziffer.',
    badge: '2–10 Spieler · Kopfrechnen',
    params: { mathLabels: 'on' },
  },
  {
    id: 'math-quartett',
    gameId: 'quartett',
    emoji: '📐',
    title: 'Geometrie-Quartett',
    description: '32 ebene Figuren und räumliche Körper nach Ecken, Kanten, Flächen, Symmetrien und Größe vergleichen.',
    badge: '2–6 Spieler · 32 Geometrie-Karten',
    params: { set: 'geometrie' },
  },
  {
    id: 'math-black-peter',
    gameId: 'black-peter',
    emoji: '🎩',
    title: 'Mathe-Schwarzer-Peter',
    description: 'Aufgabe und passende Lösung als Kartenpaare ablegen – wer behält am Ende den Schwarzen Peter?',
    badge: '2–6 Spieler · 7 Themenpakete',
    params: { content: 'kopfrechnen' },
  },
  {
    id: 'math-hangman',
    gameId: 'hangman',
    emoji: '🔤',
    title: 'Mathe-Galgenmännchen',
    description: 'Mathematische Fachbegriffe aus Geometrie, Arithmetik und Bruchrechnung (Kl. 5/6) Buchstabe für Buchstabe erraten.',
    badge: '1–8 Spieler · Fachbegriffe Kl. 5/6',
    params: { category: 'mathe' },
  },
  {
    id: 'math-word-salad',
    gameId: 'word-salad',
    emoji: '🥗',
    title: 'Mathe-Wort-Salat',
    description: 'Aus langen Mathe-Stammwörtern wie KOORDINATENSYSTEM oder RECHENDREIECK möglichst viele Teilwörter bilden.',
    badge: '1–30 Spieler · Wortjagd',
    params: { category: 'mathe' },
  },
];

/** Die Mathe-Voreinstellungen, deren Spiel zur Spielerzahl passt (unbekannte Spiel-ids bleiben drin). */
export function mathPresetsFor(all: readonly GameInfo[], players: number | null): MathPresetCard[] {
  const byId = new Map(all.map((game) => [game.id, game]));
  return MATH_CLASSIC_PRESETS.filter((preset) => {
    const info = byId.get(preset.gameId);
    return !info || fitsPlayers(info, players);
  });
}
