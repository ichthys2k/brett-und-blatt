/*
 * Bildschirm von Brett & Blatt 16: zwei Hintergrundebenen im Modus 1.
 * Ebene 1 trägt Schrift und Spielbrett, Ebene 2 Filz und Tafeln. Beide Kachelkarten liegen
 * als Puffer im Arbeitsspeicher und werden im Bildwechsel (VBlank) in den Bildspeicher kopiert.
 */
#ifndef BILD_H
#define BILD_H

#include <snes.h>
#include "res/grafik.h"

#define BILD_B 32
#define BILD_H 28

/** Einmal beim Start: Kacheln und Farben laden, Ebenen einrichten, Bild einschalten. */
void bild_start(void);
/** Wartet auf den nächsten Bildwechsel, überträgt geänderte Karten, liest Knöpfe, bedient den Klang. */
void bild_warten(void);
/** Wartet mehrere Bilder. */
void bild_pause(u16 bilder);

/** Ebene 1 leeren und Ebene 2 ganz mit Filz füllen. */
void bild_leeren(void);
/** Eine Kachel auf Ebene 1 setzen. */
void kachel(u8 x, u8 y, u16 nr, u8 pal);
/** Kachelkarte aus werkzeuge/grafik.mjs (KARTE_…) mit b × h Kacheln zeichnen. */
void karte(u8 x, u8 y, u16 adresse, u8 b, u8 h, u8 pal);
/** Brettpaletten 5–7 eines Spiels (FARBEN_…) im nächsten Bildwechsel laden. */
void brett_farben(u16 adresse);
/** Rechteck auf Ebene 1 leeren. */
void flaeche_leeren(u8 x, u8 y, u8 b, u8 h);
/** Tafel (Rahmen mit Holzfläche) auf Ebene 2; mindestens 2 × 2 Kacheln. */
void tafel(u8 x, u8 y, u8 b, u8 h);

/** Text (UTF-8, mit Umlauten) auf Ebene 1. Gibt die Zahl der geschriebenen Zeichen zurück. */
u8 text(u8 x, u8 y, const char *s, u8 pal);
/** Länge eines Texts in Zeichen (Umlaute zählen einfach). */
u8 text_laenge(const char *s);
/** Text waagerecht mittig. */
void text_mitte(u8 y, const char *s, u8 pal);
/** Text mit Zeilenumbruch an Leerzeichen in `breite` Spalten. Gibt die Zahl der Zeilen zurück. */
u8 text_umbruch(u8 x, u8 y, u8 breite, const char *s, u8 pal);
/** Zahl (0–65535) rechtsbündig in `breite` Stellen. */
void zahl(u8 x, u8 y, u16 n, u8 breite, u8 pal);

#endif
