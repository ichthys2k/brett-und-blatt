#include "karten.h"

void karten_farben_laden(void) {
  brett_farben(FARBEN_KARTEN);
}

void karten_koerper(u8 x, u8 y, u8 art, u8 pal) {
  u16 adresse;
  if (art == KARTEN_BLANKO) adresse = KARTE_KARTENBLANKO;
  else if (art == KARTEN_RUECKEN) adresse = KARTE_KARTENRUECKEN;
  else adresse = KARTE_KARTENLEER;
  karte_unten(x, y, adresse, KARTE_B, KARTE_H, pal);
}

void karten_loeschen(u8 x, u8 y) {
  flaeche_leeren(x, y, KARTE_B, KARTE_H);
}

static const char *const RAENGE[] = {
  "", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"
};

void karten_franzoesisch(u8 x, u8 y, u8 farbe, u8 rang, u8 offen, u8 pal) {
  u8 tpal;
  const char *sym;
  const char *r_str;

  if (!offen) {
    karten_koerper(x, y, KARTEN_RUECKEN, pal);
    flaeche_leeren(x, y, KARTE_B, KARTE_H);
    return;
  }

  karten_koerper(x, y, KARTEN_BLANKO, pal);
  flaeche_leeren(x, y, KARTE_B, KARTE_H);

  tpal = (farbe == FARBE_KARO || farbe == FARBE_HERZ) ? PAL_ROT : PAL_TEXT;
  if (farbe == FARBE_KREUZ) sym = "♣";
  else if (farbe == FARBE_KARO) sym = "♦";
  else if (farbe == FARBE_HERZ) sym = "♥";
  else sym = "♠";

  if (rang >= 1 && rang <= 13) r_str = RAENGE[rang];
  else r_str = "?";

  /* Oben links */
  if (rang == 10) {
    text(x, y, "10", tpal);
    text(x + 2, y, sym, tpal);
  } else {
    text(x, y, r_str, tpal);
    text(x + 1, y, sym, tpal);
  }

  /* Mitte */
  text(x + 1, y + 1, sym, tpal);

  /* Unten rechts */
  if (rang == 10) {
    text(x, y + 3, sym, tpal);
    text(x + 1, y + 3, "10", tpal);
  } else {
    text(x + 1, y + 3, sym, tpal);
    text(x + 2, y + 3, r_str, tpal);
  }
}

void karten_zahl(u8 x, u8 y, u8 farb_idx, u8 zahl_wert, u8 offen, u8 pal) {
  u8 tpal;
  if (!offen) {
    karten_koerper(x, y, KARTEN_RUECKEN, pal);
    flaeche_leeren(x, y, KARTE_B, KARTE_H);
    return;
  }

  karten_koerper(x, y, KARTEN_BLANKO, pal);
  flaeche_leeren(x, y, KARTE_B, KARTE_H);

  if (farb_idx == 0) tpal = PAL_ROT;
  else if (farb_idx == 1) tpal = PAL_GELB;
  else if (farb_idx == 2) tpal = PAL_TEXT;
  else tpal = PAL_BLAU;

  /* Oben links */
  zahl(x, y, zahl_wert, zahl_wert >= 10 ? 2 : 1, tpal);

  /* Mitte */
  if (zahl_wert >= 10) zahl(x, y + 1, zahl_wert, 2, tpal);
  else zahl(x + 1, y + 1, zahl_wert, 1, tpal);

  /* Unten rechts */
  if (zahl_wert >= 10) zahl(x + 1, y + 3, zahl_wert, 2, tpal);
  else zahl(x + 2, y + 3, zahl_wert, 1, tpal);
}
