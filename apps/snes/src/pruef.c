/*
 * Prüfmodus: Ein Postfach im Arbeitsspeicher, über das die Tests (test/snes.test.ts) Regeln,
 * Zufall und Bots ohne Bildschirm und Knöpfe aufrufen. Der Prüf-Emulator schreibt die Kennung
 * „PRUF“ ins Postfach, während der Titel läuft; dann bleibt das ROM in dieser Schleife.
 *
 * Ablauf je Befehl: Test schreibt `arg`, dann `befehl`. Das ROM antwortet in `aus`, setzt
 * `status` (1 erledigt, 2 abgelehnt) und zuletzt `befehl` auf 0.
 */
#include "pruef.h"
#include "bild.h"
#include "spiel.h"
#include "zufall.h"

enum {
  BEFEHL_ZUFALL_TEXT = 0x01,   /* arg: Text mit 0 → aus: Zustand (4 × u32) */
  BEFEHL_ZUFALL_ZAHLEN = 0x02, /* arg[0]: Anzahl (≤ 32) → aus: Zahlen (u32) */
  BEFEHL_ZUFALL_BIS = 0x03,    /* arg[0]: Anzahl, arg[1..2]: Grenze → aus: Zahlen (u16) */
  BEFEHL_SPIEL_START = 0x10,   /* arg[0]: Spiel → aus: Auszug */
  BEFEHL_SPIEL_ZUG = 0x11,     /* arg[0..1]: Zug → aus: Auszug, Status 2 bei unerlaubtem Zug */
  BEFEHL_BOT = 0x12,           /* arg[0]: Stufe → aus[0..1]: Zug, aus[2..3]: Bilder Rechenzeit */
};

#define BEREIT 0xaa

typedef struct {
  u8 kennung[4];
  u8 befehl;
  u8 status;
  u8 arg[64];
  u8 aus[256];
} Postfach;

Postfach pruef_postfach;

static Zufall pruef_zufall;
static u8 pruef_stand[SPIELSTAND_GROESSE];
static const Spiel *pruef_spiel;
static u16 zugliste[ZUEGE_MAX];

void pruef_start(void) {
  u8 *p = (u8 *)&pruef_postfach;
  u16 n = sizeof(Postfach);
  while (n--) *p++ = 0;
  pruef_spiel = 0;
}

u8 pruef_angefordert(void) {
  return pruef_postfach.kennung[0] == 'P' && pruef_postfach.kennung[1] == 'R' && pruef_postfach.kennung[2] == 'U' &&
         pruef_postfach.kennung[3] == 'F';
}

static void schreibe32(u8 *p, u32 v) {
  p[0] = v & 0xff;
  p[1] = (v >> 8) & 0xff;
  p[2] = (v >> 16) & 0xff;
  p[3] = (v >> 24) & 0xff;
}

/* Auszug: [0] Ergebnis, [1] Sieger, [2] am Zug, [3] Zahl der Züge, [4..] Züge (u16),
 * ab [160] der spielbezogene Stand (Spiel.ausgeben). */
static void auszug(void) {
  u8 *aus = pruef_postfach.aus;
  u8 sieger = PLATZ_KEIN;
  u8 ergebnis, am_zug, n, i;
  // Rückgabewerte erst in lokale Variablen: 816-tcc verliert sonst teils das Ergebnis eines Aufrufs
  // über Funktionszeiger, wenn es direkt in ein Feld geschrieben wird.
  ergebnis = pruef_spiel->ergebnis(pruef_stand, &sieger);
  am_zug = pruef_spiel->am_zug(pruef_stand);
  n = pruef_spiel->zuege(pruef_stand, zugliste);
  aus[0] = ergebnis;
  aus[1] = sieger;
  aus[2] = am_zug;
  aus[3] = n;
  for (i = 0; i < n && i < 76; i++) {
    aus[4 + i * 2] = zugliste[i] & 0xff;
    aus[5 + i * 2] = zugliste[i] >> 8;
  }
  pruef_spiel->ausgeben(pruef_stand, aus + 160);
}

static u8 ausfuehren(u8 befehl) {
  u8 *arg = pruef_postfach.arg;
  u8 *aus = pruef_postfach.aus;
  u8 i, n;
  u16 grenze, zug, start;
  switch (befehl) {
    case BEFEHL_ZUFALL_TEXT:
      arg[63] = 0;
      zufall_aus_text(&pruef_zufall, (const char *)arg);
      for (i = 0; i < 4; i++) schreibe32(aus + i * 4, pruef_zufall.s[i]);
      return 1;
    case BEFEHL_ZUFALL_ZAHLEN:
      n = arg[0] > 32 ? 32 : arg[0];
      for (i = 0; i < n; i++) schreibe32(aus + i * 4, zufall_zahl(&pruef_zufall));
      return 1;
    case BEFEHL_ZUFALL_BIS:
      n = arg[0] > 64 ? 64 : arg[0];
      grenze = arg[1] | ((u16)arg[2] << 8);
      if (grenze == 0) return 2;
      for (i = 0; i < n; i++) {
        zug = zufall_bis(&pruef_zufall, grenze);
        aus[i * 2] = zug & 0xff;
        aus[i * 2 + 1] = zug >> 8;
      }
      return 1;
    case BEFEHL_SPIEL_START:
      if (arg[0] >= SPIELE_ANZAHL) return 2;
      pruef_spiel = spiele[arg[0]];
      pruef_spiel->aufbauen(pruef_stand, &pruef_zufall);
      auszug();
      return 1;
    case BEFEHL_SPIEL_ZUG:
      if (!pruef_spiel) return 2;
      zug = arg[0] | ((u16)arg[1] << 8);
      if (!zug_erlaubt(pruef_spiel, pruef_stand, zug)) {
        auszug();
        return 2;
      }
      pruef_spiel->ziehen(pruef_stand, zug);
      auszug();
      return 1;
    case BEFEHL_BOT:
      if (!pruef_spiel || pruef_spiel->am_zug(pruef_stand) == PLATZ_KEIN) return 2;
      start = snes_vblank_count;
      zug = pruef_spiel->bot(pruef_stand, arg[0], &pruef_zufall);
      grenze = snes_vblank_count - start;
      aus[0] = zug & 0xff;
      aus[1] = zug >> 8;
      aus[2] = grenze & 0xff;
      aus[3] = grenze >> 8;
      return 1;
  }
  return 2;
}

void pruef_schleife(void) {
  u8 befehl;
  bild_leeren();
  text_mitte(12, "Prüfmodus", PAL_GELB);
  text_mitte(14, "Gesteuert vom Prüf-Emulator", PAL_GRAU);
  pruef_postfach.befehl = 0;
  pruef_postfach.status = BEREIT;
  while (1) {
    bild_warten();
    befehl = pruef_postfach.befehl;
    if (!befehl) continue;
    pruef_postfach.status = ausfuehren(befehl);
    pruef_postfach.befehl = 0;
  }
}
