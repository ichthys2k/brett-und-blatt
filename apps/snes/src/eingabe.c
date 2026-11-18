#include "eingabe.h"
#include "bild.h"

#define VERZOEGERUNG 16
#define WIEDERHOLUNG 5

static u16 vorher[CONTROLLER];
static u16 neu[CONTROLLER];
static u8 halten[CONTROLLER];
u16 eingabe_unruhe;

void eingabe_start(void) {
  u8 p;
  for (p = 0; p < CONTROLLER; p++) {
    vorher[p] = 0;
    neu[p] = 0;
    halten[p] = 0;
  }
  eingabe_unruhe = 0;
}

void eingabe_lesen(void) {
  u8 p;
  u16 jetzt;
  for (p = 0; p < CONTROLLER; p++) {
    jetzt = padsCurrent(p);
    // Ein Controller, der nicht steckt, meldet manchmal alle Bits – das ignorieren wir.
    if (jetzt == 0xffff) jetzt = 0;
    neu[p] = jetzt & ~vorher[p];
    if (jetzt & STEUERKREUZ) {
      if (neu[p] & STEUERKREUZ) halten[p] = 0;
      else if (++halten[p] >= VERZOEGERUNG) {
        neu[p] |= jetzt & STEUERKREUZ;
        halten[p] = VERZOEGERUNG - WIEDERHOLUNG;
      }
    }
    if (neu[p]) eingabe_unruhe = eingabe_unruhe * 31 + neu[p] + p;
    vorher[p] = jetzt;
  }
  eingabe_unruhe++;
}

u16 tasten_neu(u8 port) {
  return port < CONTROLLER ? neu[port] : 0;
}

u16 tasten_alle(void) {
  return neu[0] | neu[1];
}

void tasten_loslassen(void) {
  while (vorher[0] | vorher[1]) bild_warten();
}
