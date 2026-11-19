#include "karten.h"
#include "../res/karten_grafik.h"

extern char karten_bg, karten_bg_ende, karten_bg_pal;

void karten_farben_laden(void) {
  if (bild_sonder_aktiv()) return;
  brett_farben(FARBEN_KARTEN);
}

void karten_grafik_laden(void) {
  bild_kacheln_laden((const u8 *)&karten_bg, (u16)(&karten_bg_ende - &karten_bg));
  bild_bg_paletten((const u8 *)&karten_bg_pal, PAL_BRETT, 3);
}

void karten_motiv(u8 x, u8 y, u16 basis, u8 pal) {
  u8 i, j;
  for (j = 0; j < 2; j++)
    for (i = 0; i < 3; i++)
      kachel(x + i, y + 1 + j, basis + j * 3 + i, pal);
}

void karten_koerper(u8 x, u8 y, u8 art, u8 pal) {
  if (bild_sonder_aktiv()) {
    u16 basis;
    u8 i, j;
    if (art == KARTEN_BLANKO) basis = KARTEN_BG_BLANKO;
    else if (art == KARTEN_RUECKEN) basis = KARTEN_BG_RUECKEN;
    else basis = KARTEN_BG_LEER;
    for (j = 0; j < KARTE_H; j++)
      for (i = 0; i < KARTE_B; i++)
        kachel_unten(x + i, y + j, basis + j * KARTE_B + i, pal);
    return;
  }
  {
    u16 adresse;
    if (art == KARTEN_BLANKO) adresse = KARTE_KARTENBLANKO;
    else if (art == KARTEN_RUECKEN) adresse = KARTE_KARTENRUECKEN;
    else adresse = KARTE_KARTENLEER;
    karte_unten(x, y, adresse, KARTE_B, KARTE_H, pal);
  }
}

void karten_loeschen(u8 x, u8 y) {
  flaeche_leeren(x, y, KARTE_B, KARTE_H);
}

static const char *const RAENGE[] = {
  "", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B", "D", "K"
};

static const u16 FARB_MOTIVE[4] = {
  KARTEN_BG_KREUZ, KARTEN_BG_KARO, KARTEN_BG_HERZ, KARTEN_BG_PIK
};

static const u16 ASS_MOTIVE[4] = {
  KARTEN_BG_ASS_KREUZ, KARTEN_BG_ASS_KARO, KARTEN_BG_ASS_HERZ, KARTEN_BG_ASS_PIK
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

  /* Mitte: echtes 24×16-Bildkarten-Porträt, Schmuck-Ass oder großes Farbsymbol */
  if (bild_sonder_aktiv()) {
    u16 motiv;
    if (rang == RANG_BUBE) motiv = KARTEN_BG_BUBE;
    else if (rang == RANG_DAME) motiv = KARTEN_BG_DAME;
    else if (rang == RANG_KOENIG) motiv = KARTEN_BG_KOENIG;
    else if (rang == RANG_ASS) motiv = ASS_MOTIVE[farbe & 3];
    else motiv = FARB_MOTIVE[farbe & 3];
    karten_motiv(x, y, motiv, pal);
  } else {
    text(x + 1, y + 1, sym, tpal);
  }

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

static const u16 UNO_MOTIVE[5] = {
  KARTEN_BG_UNO_SKIP, KARTEN_BG_UNO_REV, KARTEN_BG_UNO_P2, KARTEN_BG_UNO_WILD, KARTEN_BG_UNO_P4
};

void karten_uno_aktion(u8 x, u8 y, u8 farb_idx, u8 aktion, u8 offen, u8 pal) {
  u8 tpal;
  const char *kurz;
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
  else if (farb_idx == 3) tpal = PAL_BLAU;
  else tpal = PAL_GELB;

  if (aktion == 0) kurz = "X";
  else if (aktion == 1) kurz = "<>";
  else if (aktion == 2) kurz = "+2";
  else if (aktion == 3) kurz = "W";
  else kurz = "+4";

  text(x, y, kurz, tpal);
  if (bild_sonder_aktiv() && aktion < 5) {
    karten_motiv(x, y, UNO_MOTIVE[aktion], pal);
  } else {
    text(x, y + 1, kurz, tpal);
  }
  text(x + (kurz[1] ? 1 : 2), y + 3, kurz, tpal);
}

static const u16 PETER_PAAR_MOTIVE[KARTEN_BG_PAAR_ANZAHL] = {
  KARTEN_BG_PAAR_0, KARTEN_BG_PAAR_1, KARTEN_BG_PAAR_2, KARTEN_BG_PAAR_3,
  KARTEN_BG_PAAR_4, KARTEN_BG_PAAR_5, KARTEN_BG_PAAR_6, KARTEN_BG_PAAR_7
};

void karten_peter(u8 x, u8 y, u8 paar_id, u8 offen, u8 pal) {
  if (!offen) {
    karten_koerper(x, y, KARTEN_RUECKEN, pal);
    flaeche_leeren(x, y, KARTE_B, KARTE_H);
    return;
  }
  karten_koerper(x, y, KARTEN_BLANKO, pal);
  flaeche_leeren(x, y, KARTE_B, KARTE_H);

  if (paar_id == 0xff) {
    text(x, y, "P", PAL_ROT);
    if (bild_sonder_aktiv()) karten_motiv(x, y, KARTEN_BG_PETER_KATER, pal);
    else text(x + 1, y + 1, "P", PAL_ROT);
    text(x + 2, y + 3, "P", PAL_ROT);
  } else {
    u8 nr = paar_id + 1;
    zahl(x, y, nr, nr >= 10 ? 2 : 1, PAL_TEXT);
    if (bild_sonder_aktiv()) karten_motiv(x, y, PETER_PAAR_MOTIVE[paar_id % KARTEN_BG_PAAR_ANZAHL], pal);
    else zahl(x + 1, y + 1, nr, 1, PAL_TEXT);
    zahl(x + (nr >= 10 ? 1 : 2), y + 3, nr, nr >= 10 ? 2 : 1, PAL_TEXT);
  }
}
