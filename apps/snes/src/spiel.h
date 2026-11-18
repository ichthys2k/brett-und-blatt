/*
 * Die Spielschnittstelle von Brett & Blatt 16 – eine schlanke C-Fassung von `GameModule`
 * (packages/engine/src/types.ts). Regeln und Bot sind getrennt von der Oberfläche, damit der
 * Prüfmodus (pruef.c) sie ohne Bildschirm mit der Web-App vergleichen kann.
 *
 * Der Spielstand liegt in einem festen Puffer (SPIELSTAND_GROESSE Bytes); jedes Spiel legt darin
 * seine eigene Struktur ab. Züge sind 16-Bit-Zahlen, ihre Bedeutung bestimmt das Spiel.
 */
#ifndef SPIEL_H
#define SPIEL_H

#include <snes.h>
#include "zufall.h"

#define SPIELSTAND_GROESSE 128
#define ZUEGE_MAX 64
#define ZUG_KEIN 0xffff
#define PLATZ_KEIN 0xff
#define PLAETZE_MAX 2

enum { ERGEBNIS_LAEUFT, ERGEBNIS_SIEG, ERGEBNIS_REMIS };
enum { STUFE_LEICHT, STUFE_MITTEL, STUFE_SCHWER, STUFEN };

typedef struct {
  /* Steckbrief */
  const char *name;
  const char *const *anleitung; /* Zeilen à höchstens 26 Zeichen, mit 0 beendet */
  const char *const *platz_namen;
  const u8 *platz_paletten;
  u8 plaetze;
  /** Verdeckte Informationen: Im Hot-Seat erscheint vor jedem Zug ein Wechselbildschirm. */
  u8 verdeckt;

  /* Regeln */
  void (*aufbauen)(u8 *stand, Zufall *z);
  /** Wer am Zug ist, oder PLATZ_KEIN nach Spielende. */
  u8 (*am_zug)(const u8 *stand);
  /** Schreibt alle erlaubten Züge in `zuege` und gibt ihre Zahl zurück. */
  u8 (*zuege)(const u8 *stand, u16 *zuege);
  /** Führt einen erlaubten Zug aus und meldet ein Ereignis für den Klang (KLANG_…). */
  u8 (*ziehen)(u8 *stand, u16 zug);
  /** ERGEBNIS_…; bei einem Sieg steht der Gewinnerplatz in `sieger`. */
  u8 (*ergebnis)(const u8 *stand, u8 *sieger);

  /* Bot */
  u16 (*bot)(const u8 *stand, u8 stufe, Zufall *z);

  /* Prüfmodus: Spielstand in einer festen Form ausgeben (siehe test/spiele/<id>.ts). */
  u8 (*ausgeben)(const u8 *stand, u8 *puffer);

  /* Oberfläche */
  /** Zeichnet das Spielfeld. `auswahl` ist die Cursorstelle, `hinweis` 1 = Cursor zeigen. */
  void (*zeichnen)(const u8 *stand, u16 auswahl, u8 cursor);
  /** Bewegt die Auswahl mit dem Steuerkreuz; gibt bei A den gewählten Zug zurück, sonst ZUG_KEIN. */
  u16 (*bedienen)(const u8 *stand, u16 *auswahl, u16 tasten);
  /** Startstelle des Cursors. */
  u16 auswahl_start;
} Spiel;

extern const Spiel spiel_tic_tac_toe;

#define SPIELE_ANZAHL 1
extern const Spiel *const spiele[SPIELE_ANZAHL];

/** Prüft, ob `zug` in der Liste der erlaubten Züge steht. */
u8 zug_erlaubt(const Spiel *spiel, const u8 *stand, u16 zug);

#endif
