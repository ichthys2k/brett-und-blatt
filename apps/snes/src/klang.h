/*
 * Klangeffekte über den Klangprozessor SPC700 (BRR-Samples aus werkzeuge/klang.mjs).
 */
#ifndef KLANG_H
#define KLANG_H

#include <snes.h>

enum { KLANG_KLICK, KLANG_SETZEN, KLANG_START, KLANG_SIEG, KLANG_ENDE, KLANG_WUERFELN, KLANG_KARTE, KLANG_ANZAHL };

void klang_start(void);
void klang_spielen(u8 klang);
/** Einmal je Bild (aus bild_warten). */
void klang_bedienen(void);

#endif
