/*
 * Stichspiel-Unterbau für Brett & Blatt 16 (Stufe 5).
 * Unterstützt Skat, Schafkopf, Doppelkopf und Binokel:
 * - Karten-Augenwerte (Ass 11, 10 10, König 4, Dame/Ober 3, Bube/Unter 2, 7..9 0)
 * - Trumpf-, Farb- und Rangordnungen für alle Kontrakte
 * - Ausspielen, Stichbedienen, Überstichzwang, Übertrumpfen
 * - Stichgewinner-Ermittlung
 */
#ifndef STICH_H
#define STICH_H

#include <snes.h>

#define STICH_KEIN 0xff
#define STICH_TRUMPF 0xfe

/* Standard-Farben (0: Kreuz/Eichel, 1: Karo/Schellen, 2: Herz, 3: Pik/Grün) */
enum {
  FARBE_C = 0,
  FARBE_D = 1,
  FARBE_H = 2,
  FARBE_S = 3,
};

/* Einzelkarte im Stich */
typedef struct {
  u8 spieler;
  u8 karte;
} StichKarte;

/* Spielart-Definitionen */
enum {
  KONTRAKT_SKAT_FARBE,
  KONTRAKT_SKAT_GRAND,
  KONTRAKT_SKAT_NULL,

  KONTRAKT_SCHAFKOPF_SAUSPIEL,
  KONTRAKT_SCHAFKOPF_SOLO,
  KONTRAKT_SCHAFKOPF_WENZ,
  KONTRAKT_SCHAFKOPF_GEIER,
  KONTRAKT_SCHAFKOPF_FARBWENZ,
  KONTRAKT_SCHAFKOPF_BETTEL,
  KONTRAKT_SCHAFKOPF_RAMSCH,

  KONTRAKT_DOKO_NORMAL,
  KONTRAKT_DOKO_DAMENSOLO,
  KONTRAKT_DOKO_BUBENSOLO,
  KONTRAKT_DOKO_FARBSOLO,
  KONTRAKT_DOKO_FLEISCHLOS,

  KONTRAKT_BINOKEL,
};

typedef struct {
  u8 spieltyp;     /* KONTRAKT_... */
  u8 trumpf_farbe; /* 0..3 oder STICH_KEIN */
  u8 gerufen_farbe;/* z. B. Sauspiel gerufene Sau-Farbe */
  u8 dullen_zweite_sticht; /* Doppelkopf: 2. Herz-10 sticht 1. */
} StichVertrag;

/** Augenwert einer Karte (0..11). Bei karte >= 52 wird karte % 52 genutzt. */
u8 stich_augen(u8 karte);

/** Ist die Karte im Vertrag ein Trumpf? */
u8 stich_ist_trumpf(u8 karte, const StichVertrag *v);

/** Effektive Farbe: 0..3 oder STICH_TRUMPF */
u8 stich_effektive_farbe(u8 karte, const StichVertrag *v);

/** Kartenstärke im Stich (höher sticht niedriger). */
u16 stich_karte_staerke(u8 karte, const StichVertrag *v);

/** Ermittelt den Gewinner-Index (0..anzahl-1) in karten. */
u8 stich_gewinner(const StichKarte *karten, u8 anzahl, const StichVertrag *v);

/**
 * Filtert erlaubte Handkarten für das Bedienen des aktuellen Stichs.
 * Gibt die Anzahl der erlaubten Karten zurück und füllt `erlaubt_maske` (1 wenn erlaubt).
 */
u8 stich_erlaubte_karten(
  const u8 *hand,
  u8 hand_n,
  const StichKarte *stich,
  u8 stich_n,
  const StichVertrag *v,
  u8 *erlaubt_maske
);

#endif
