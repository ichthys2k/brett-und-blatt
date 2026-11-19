/*
 * Gemeinsamer Karten-Baustein für Brett & Blatt 16 (Stufe 4).
 * Unterstützt Französisches Blatt (♥, ♦, ♣, ♠) und Zahlenkarten (Elf zuerst!, Eins!, Ligretto).
 * Karten haben 24 × 32 Bildpunkte (3 × 4 Kacheln à 8×8).
 * Die Grundkarte liegt auf Ebene 2 (unter der Schrift), Texte und Symbole auf Ebene 1.
 */
#ifndef KARTEN_H
#define KARTEN_H

#include <snes.h>
#include "bild.h"
#include "res/grafik.h"

#define KARTE_B 3
#define KARTE_H 4

/* Farben im Französischen Blatt (wie SUITS: C=0, D=1, H=2, S=3) */
enum {
  FARBE_KREUZ = 0,
  FARBE_KARO = 1,
  FARBE_HERZ = 2,
  FARBE_PIK = 3,
};

/* Ränge im Französischen Blatt (1–13: Ass bis König) */
enum {
  RANG_ASS = 1,
  RANG_2 = 2,
  RANG_3 = 3,
  RANG_4 = 4,
  RANG_5 = 5,
  RANG_6 = 6,
  RANG_7 = 7,
  RANG_8 = 8,
  RANG_9 = 9,
  RANG_10 = 10,
  RANG_BUBE = 11,
  RANG_DAME = 12,
  RANG_KOENIG = 13,
};

/* Karten-Darstellungsarten */
enum {
  KARTEN_LEER = 0,
  KARTEN_BLANKO = 1,
  KARTEN_RUECKEN = 2,
};

/** Lädt die Brettpaletten für Spielkarten (FARBEN_KARTEN). */
void karten_farben_laden(void);

/** Lädt das dynamische Spielkarten-Grafikset (Bildkarten, Schmuck-Asse, Filigran-Rücken, Icons). */
void karten_grafik_laden(void);

/** Zeichnet ein 3×2-Kartenmotiv (24×16 px) in die Mitte einer Karte (x, y+1..y+2). */
void karten_motiv(u8 x, u8 y, u16 basis, u8 pal);

/** Zeichnet den Kartenkörper (Blanko, Rücken oder Leerfeld) auf Ebene 2. */
void karten_koerper(u8 x, u8 y, u8 art, u8 pal);

/** Löscht ein Kartenfeld (3 × 4 Kacheln) auf Ebene 1 und Ebene 2. */
void karten_loeschen(u8 x, u8 y);

/**
 * Zeichnet eine französische Spielkarte mit echten Hofkarten-Porträts (B/D/K),
 * Schmuck-Assen und großen Farbsymbolen.
 */
void karten_franzoesisch(u8 x, u8 y, u8 farbe, u8 rang, u8 offen, u8 pal);

/**
 * Zeichnet eine Zahlenkarte (z. B. für Elf zuerst! oder Eins!).
 * @param farb_idx 0=Rot, 1=Gelb, 2=Grün/Text, 3=Blau
 * @param zahl 1 bis 99
 * @param offen 1=aufgedeckt, 0=Kartenrücken
 * @param pal 5=normal, 6=ausgewählt/Cursor, 7=markiert
 */
void karten_zahl(u8 x, u8 y, u8 farb_idx, u8 zahl, u8 offen, u8 pal);

/**
 * Zeichnet eine Eins!/Uno-Aktionskarte mit echtem 24×16-Symbol.
 * @param aktion 0=Aussetzen, 1=Richtungswechsel, 2=+2, 3=Farbwahl, 4=+4
 */
void karten_uno_aktion(u8 x, u8 y, u8 farb_idx, u8 aktion, u8 offen, u8 pal);

/**
 * Zeichnet eine Schwarzer-Peter-Karte (Kater oder buntes Paar-Motiv).
 * @param paar_id 0..15 für Paare, 0xff für den Schwarzen Peter (Kater)
 */
void karten_peter(u8 x, u8 y, u8 paar_id, u8 offen, u8 pal);

#endif
