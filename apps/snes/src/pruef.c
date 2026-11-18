/*
 * Prüfmodus: Ein Postfach im Arbeitsspeicher, über das die Tests (test/snes.test.ts) Regeln,
 * Zufall und Bots ohne Bildschirm und Knöpfe aufrufen. Der Prüf-Emulator schreibt die Kennung
 * „PRUF“ ins Postfach, während der Titel läuft; dann bleibt das ROM in dieser Schleife.
 *
 * Ablauf je Befehl: Test schreibt `arg`, dann `befehl`. Das ROM antwortet in `aus`, setzt
 * `status` (1 erledigt, 2 abgelehnt, 3 Antwort zu lang) und zuletzt `befehl` auf 0.
 */
#include "pruef.h"
#include "bild.h"
#include "spiel.h"
#include "zufall.h"

enum {
  BEFEHL_ZUFALL_TEXT = 0x01,   /* arg: Text mit 0 → aus: Zustand (4 × u32) */
  BEFEHL_ZUFALL_ZAHLEN = 0x02, /* arg[0]: Anzahl (≤ 32) → aus: Zahlen (u32) */
  BEFEHL_ZUFALL_BIS = 0x03,    /* arg[0]: Anzahl, arg[1..2]: Grenze → aus: Zahlen (u16) */
  BEFEHL_SPIEL_START = 0x10,   /* arg[0]: Spiel, arg[1..4]: Optionen → aus: Auszug */
  BEFEHL_SPIEL_ZUG = 0x11,     /* arg[0]: Länge, arg[1..]: Zugbytes → aus: Auszug, Status 2 bei unerlaubtem Zug */
  BEFEHL_BOT = 0x12,           /* arg[0]: Stufe → aus[0..1]: Bilder Rechenzeit, aus[2]: Länge, aus[3..]: Zug */
};

#define BEREIT 0xaa
#define AUS_GROESSE 3072
#define AUS_ZUEGE 16

typedef struct {
  u8 kennung[4];
  u8 befehl;
  u8 status;
  u8 arg[64];
  u8 aus[AUS_GROESSE];
} Postfach;

Postfach pruef_postfach;

static Zufall pruef_zufall;
static const Spiel *pruef_spiel;

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

static void schreibe16(u8 *p, u16 v) {
  p[0] = v & 0xff;
  p[1] = v >> 8;
}

static void schreibe32(u8 *p, u32 v) {
  p[0] = v & 0xff;
  p[1] = (v >> 8) & 0xff;
  p[2] = (v >> 16) & 0xff;
  p[3] = (v >> 24) & 0xff;
}

/*
 * Auszug: [0] Ergebnis, [1] Sieger, [2] am Zug, [4..5] Zahl der Züge, [6..7] Bytes der Zugliste,
 * [8..9] Bytes des Stands; ab [16] die Züge (je Länge und Bytes), danach der Stand (Spiel.ausgeben).
 * Gibt 0 zurück, wenn der Auszug nicht ins Postfach passt.
 */
static u8 auszug(void) {
  u8 *aus = pruef_postfach.aus;
  u8 sieger = PLATZ_KEIN;
  u8 ergebnis, am_zug, j;
  u16 n, i, stelle, stand;
  const Zug *z;
  // Rückgabewerte erst in lokale Variablen: 816-tcc verliert sonst teils das Ergebnis eines Aufrufs
  // über Funktionszeiger, wenn es direkt in ein Feld geschrieben wird.
  ergebnis = pruef_spiel->ergebnis(spielstand, &sieger);
  am_zug = pruef_spiel->am_zug(spielstand);
  n = pruef_spiel->zuege(spielstand, zugliste);
  aus[0] = ergebnis;
  aus[1] = sieger;
  aus[2] = am_zug;
  schreibe16(aus + 4, n);
  stelle = AUS_ZUEGE;
  for (i = 0; i < n; i++) {
    z = &zugliste[i];
    if (stelle + 1 + z->n > AUS_GROESSE) return 0;
    aus[stelle++] = z->n;
    for (j = 0; j < z->n; j++) aus[stelle++] = z->b[j];
  }
  schreibe16(aus + 6, stelle - AUS_ZUEGE);
  if (stelle + 1024 > AUS_GROESSE) return 0;
  stand = pruef_spiel->ausgeben(spielstand, aus + stelle);
  schreibe16(aus + 8, stand);
  return 1;
}

static u8 ausfuehren(u8 befehl) {
  u8 *arg = pruef_postfach.arg;
  u8 *aus = pruef_postfach.aus;
  u8 i, n;
  u16 grenze, wert, start;
  Zug zug;
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
        wert = zufall_bis(&pruef_zufall, grenze);
        schreibe16(aus + i * 2, wert);
      }
      return 1;
    case BEFEHL_SPIEL_START:
      if (arg[0] >= SPIELE_ANZAHL) return 2;
      pruef_spiel = spiele[arg[0]];
      pruef_spiel->aufbauen(spielstand, arg + 1, &pruef_zufall);
      return auszug() ? 1 : 3;
    case BEFEHL_SPIEL_ZUG:
      if (!pruef_spiel || arg[0] > ZUG_BYTES) return 2;
      zug.n = arg[0];
      for (i = 0; i < zug.n; i++) zug.b[i] = arg[1 + i];
      if (!zug_erlaubt(pruef_spiel, spielstand, &zug)) {
        auszug();
        return 2;
      }
      pruef_spiel->ziehen(spielstand, &zug);
      return auszug() ? 1 : 3;
    case BEFEHL_BOT:
      if (!pruef_spiel) return 2;
      if (pruef_spiel->am_zug(spielstand) == PLATZ_KEIN) return 2;
      start = BILDER();
      pruef_spiel->bot(spielstand, arg[0], &pruef_zufall, &zug);
      wert = BILDER() - start;
      schreibe16(aus, wert);
      aus[2] = zug.n;
      for (i = 0; i < zug.n; i++) aus[3 + i] = zug.b[i];
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
