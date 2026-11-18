/*
 * Statistik im batteriegepufferten Speicher (SRAM, 2 KB). Mit Kennung und Prüfsumme:
 * Ist der Inhalt ungültig (neues Modul, leere Batterie), beginnt die Statistik bei null.
 */
#ifndef SPEICHER_H
#define SPEICHER_H

#include <snes.h>
#include "spiel.h"

#define SPEICHER_SPIELE 16

enum { BILANZ_SIEG, BILANZ_REMIS, BILANZ_NIEDERLAGE };

typedef struct {
  u16 partien;
  u16 hotseat;
  /** Partien Mensch gegen Bot, je Bot-Stufe: Siege, Remis, Niederlagen des Menschen. */
  u16 gegen_bot[STUFEN][3];
} SpielStatistik;

typedef struct {
  u8 kennung[4];
  u8 version;
  u8 frei;
  SpielStatistik spiele[SPEICHER_SPIELE];
  u16 pruefsumme;
} Speicher;

extern Speicher speicher;

void speicher_laden(void);
void speicher_sichern(void);
void speicher_loeschen(void);

#endif
