#include "speicher.h"

Speicher speicher;

#define VERSION 1

static u16 summe(void) {
  const u8 *p = (const u8 *)&speicher;
  u16 n = sizeof(Speicher) - 2;
  u16 s = 0x5a5a;
  while (n--) s = (s << 1 | s >> 15) + *p++;
  return s;
}

void speicher_loeschen(void) {
  u8 *p = (u8 *)&speicher;
  u16 n = sizeof(Speicher);
  while (n--) *p++ = 0;
  speicher.kennung[0] = 'B';
  speicher.kennung[1] = 'B';
  speicher.kennung[2] = '1';
  speicher.kennung[3] = '6';
  speicher.version = VERSION;
  speicher_sichern();
}

void speicher_laden(void) {
  consoleLoadSram((u8 *)&speicher, sizeof(Speicher));
  if (speicher.kennung[0] != 'B' || speicher.kennung[1] != 'B' || speicher.kennung[2] != '1' ||
      speicher.kennung[3] != '6' || speicher.version != VERSION || speicher.pruefsumme != summe()) {
    speicher_loeschen();
  }
}

void speicher_sichern(void) {
  speicher.pruefsumme = summe();
  consoleCopySram((u8 *)&speicher, sizeof(Speicher));
}
