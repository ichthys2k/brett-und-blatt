/*
 * Klangeffekte und Hintergrundmusik über den Klangprozessor SPC700:
 * 7 BRR-Samples aus werkzeuge/klang.mjs und 20 SNESMod-Stücke aus werkzeuge/musik.mjs.
 */
#ifndef KLANG_H
#define KLANG_H

#include <snes.h>

enum { KLANG_KLICK, KLANG_SETZEN, KLANG_START, KLANG_SIEG, KLANG_ENDE, KLANG_WUERFELN, KLANG_KARTE, KLANG_ANZAHL };

#define MUSIK_ANZAHL 20
#define PLAYLIST_ANZAHL 4

enum { PLAYLIST_DENKRAUM, PLAYLIST_KARTENTISCH, PLAYLIST_PATIENCE, PLAYLIST_SPIELABEND };

extern const char *const musik_namen[MUSIK_ANZAHL];
extern const char *const musik_playlist_namen[PLAYLIST_ANZAHL];
extern const u8 musik_playlist[MUSIK_ANZAHL];

void klang_start(void);
void klang_spielen(u8 klang);
/** Einmal je Bild (aus bild_warten). */
void klang_bedienen(void);

void musik_spielen(u8 nr);
void musik_stoppen(void);
/** Wählt ein passendes Stück aus der Stimmung des Spiels (ohne direkte Wiederholung). */
void musik_fuer_spiel(u8 spiel_nr, u16 zufall);
/** Schaltet zum nächsten Stück derselben Stimmung weiter (oder startet Musik). */
void musik_naechstes(void);
/** Schaltet Hintergrundmusik an oder aus. */
void musik_umschalten(void);
u8 musik_aktiv(void);
u8 musik_aktuell(void);
u8 musik_laeuft(void);

#endif
