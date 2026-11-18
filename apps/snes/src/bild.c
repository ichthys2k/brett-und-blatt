#include "bild.h"
#include "eingabe.h"
#include "klang.h"

extern char kacheln_a, kacheln_a_ende, kacheln_b, kacheln_b_ende, farben, karten, spielfarben;

#define VRAM_KACHELN 0x0000
#define VRAM_KARTE1 0x6000
#define VRAM_KARTE2 0x6400

u16 karte1[BILD_B * 32];
u16 karte2[BILD_B * 32];
u8 karte1_neu;
u8 karte2_neu;
static u16 farben_neu; /* 0 = nichts, sonst Adresse in spielfarben + 1 */

#define EINTRAG(nr, pal) ((nr) | ((u16)(pal) << 10))

void bild_start(void) {
  setBrightness(0);
  // Die Kacheln liegen in zwei ROM-Abschnitten (je höchstens 512 Kacheln = 16 KB).
  dmaCopyVram((u8 *)&kacheln_a, VRAM_KACHELN, (u16)(&kacheln_a_ende - &kacheln_a));
  dmaCopyVram((u8 *)&kacheln_b, VRAM_KACHELN + 512 * 16, (u16)(&kacheln_b_ende - &kacheln_b));
  dmaCopyCGram((u8 *)&farben, 0, 256);
  bgSetGfxPtr(0, VRAM_KACHELN);
  bgSetGfxPtr(1, VRAM_KACHELN);
  bgSetMapPtr(0, VRAM_KARTE1, SC_32x32);
  bgSetMapPtr(1, VRAM_KARTE2, SC_32x32);
  setMode(BG_MODE1, 0);
  bgSetDisable(2);
  bild_leeren();
  dmaCopyVram((u8 *)karte1, VRAM_KARTE1, sizeof(karte1));
  dmaCopyVram((u8 *)karte2, VRAM_KARTE2, sizeof(karte2));
  karte1_neu = 0;
  karte2_neu = 0;
  farben_neu = 0;
  setScreenOn();
}

void bild_warten(void) {
  WaitForVBlank();
  // Farben zuerst: CGRAM darf nur in der Austastlücke beschrieben werden, die Karten danach sind groß.
  if (farben_neu) {
    dmaCopyCGram((u8 *)(&spielfarben + farben_neu - 1), 5 * 16, 96);
    farben_neu = 0;
  }
  // Im Bildwechsel ist Zeit für etwa 5 KB; beide Karten zusammen sind 4 KB.
  if (karte1_neu) {
    dmaCopyVram((u8 *)karte1, VRAM_KARTE1, sizeof(karte1));
    karte1_neu = 0;
  }
  if (karte2_neu) {
    dmaCopyVram((u8 *)karte2, VRAM_KARTE2, sizeof(karte2));
    karte2_neu = 0;
  }
  eingabe_lesen();
  klang_bedienen();
}

void bild_pause(u16 bilder) {
  while (bilder--) bild_warten();
}

void bild_leeren(void) {
  u16 i;
  for (i = 0; i < BILD_B * 32; i++) {
    karte1[i] = 0;
    karte2[i] = EINTRAG(K_FILZ, PAL_TEXT);
  }
  karte1_neu = 1;
  karte2_neu = 1;
}

void kachel(u8 x, u8 y, u16 nr, u8 pal) {
  karte1[(u16)y * 32 + x] = EINTRAG(nr, pal);
  karte1_neu = 1;
}

void karte(u8 x, u8 y, u16 adresse, u8 b, u8 h, u8 pal) {
  const u8 *k = (const u8 *)(&karten + adresse);
  u8 i, j;
  u16 stelle;
  u16 hoch = (u16)pal << 10;
  for (j = 0; j < h; j++) {
    stelle = (u16)(y + j) * 32 + x;
    for (i = 0; i < b; i++) {
      karte1[stelle + i] = (k[0] | ((u16)k[1] << 8)) | hoch;
      k += 2;
    }
  }
  karte1_neu = 1;
}

void brett_farben(u16 adresse) {
  farben_neu = adresse + 1;
}

void flaeche_leeren(u8 x, u8 y, u8 b, u8 h) {
  u8 i, j;
  for (j = 0; j < h; j++)
    for (i = 0; i < b; i++) karte1[(u16)(y + j) * 32 + x + i] = 0;
  karte1_neu = 1;
}

void karte_unten(u8 x, u8 y, u16 adresse, u8 b, u8 h, u8 pal) {
  const u8 *k = (const u8 *)(&karten + adresse);
  u8 i, j;
  u16 stelle;
  u16 hoch = (u16)pal << 10;
  for (j = 0; j < h; j++) {
    stelle = (u16)(y + j) * 32 + x;
    for (i = 0; i < b; i++) {
      karte2[stelle + i] = (k[0] | ((u16)k[1] << 8)) | hoch;
      k += 2;
    }
  }
  karte2_neu = 1;
}

void tafel(u8 x, u8 y, u8 b, u8 h) {
  u8 i, j;
  u16 nr;
  for (j = 0; j < h; j++) {
    for (i = 0; i < b; i++) {
      if (j == 0) nr = i == 0 ? K_TAFEL_OL : i == b - 1 ? K_TAFEL_OR : K_TAFEL_O;
      else if (j == h - 1) nr = i == 0 ? K_TAFEL_UL : i == b - 1 ? K_TAFEL_UR : K_TAFEL_U;
      else nr = i == 0 ? K_TAFEL_L : i == b - 1 ? K_TAFEL_R : K_TAFEL_M;
      karte2[(u16)(y + j) * 32 + x + i] = EINTRAG(nr, PAL_TEXT);
    }
  }
  karte2_neu = 1;
}

/*
 * Liest ein Zeichen aus UTF-8 und gibt den Kachelcode zurück (siehe werkzeuge/grafik.mjs,
 * SONDERZEICHEN). Unbekannte Zeichen werden zu „?“.
 */
static const u8 *lesestelle;
static u8 naechstes_zeichen(void) {
  u8 c = *lesestelle++;
  u8 d, e;
  if (c < 0x80) return c;
  if (c == 0xc3) {
    d = *lesestelle++;
    switch (d) {
      case 0x84: return 0x80; /* Ä */
      case 0x96: return 0x81; /* Ö */
      case 0x9c: return 0x82; /* Ü */
      case 0xa4: return 0x83; /* ä */
      case 0xb6: return 0x84; /* ö */
      case 0xbc: return 0x85; /* ü */
      case 0x9f: return 0x86; /* ß */
      case 0x97: return 0x87; /* × */
    }
    return '?';
  }
  if (c == 0xc2) {
    d = *lesestelle++;
    return d == 0xb7 ? 0x88 : '?'; /* · */
  }
  if (c == 0xe2) {
    d = *lesestelle++;
    e = *lesestelle++;
    if (d == 0x80 && e == 0x93) return 0x89; /* – */
    if (d == 0x80 && e == 0x9e) return 0x8a; /* „ */
    if (d == 0x80 && e == 0x9c) return 0x8b; /* “ */
    if (d == 0x80 && e == 0xa6) return 0x8f; /* … */
    if (d == 0x97 && e == 0x80) return 0x8c; /* ◀ */
    if (d == 0x96 && e == 0xb6) return 0x8d; /* ▶ */
    if (d == 0x9c && e == 0x9a) return 0x8e; /* ✚ */
    if (d == 0x96 && e == 0xb2) return 0x90; /* ▲ */
    if (d == 0x96 && e == 0xbc) return 0x91; /* ▼ */
    if (d == 0x97 && e == 0x8f) return 0x92; /* ● */
    if (d == 0x97 && e == 0x8b) return 0x93; /* ○ */
    return '?';
  }
  return '?';
}

u8 text(u8 x, u8 y, const char *s, u8 pal) {
  u8 n = 0;
  u8 c;
  u16 stelle = (u16)y * 32 + x;
  lesestelle = (const u8 *)s;
  while (*lesestelle && x + n < BILD_B) {
    c = naechstes_zeichen();
    karte1[stelle + n] = EINTRAG(c, pal);
    n++;
  }
  karte1_neu = 1;
  return n;
}

u8 text_laenge(const char *s) {
  u8 n = 0;
  lesestelle = (const u8 *)s;
  while (*lesestelle) {
    naechstes_zeichen();
    n++;
  }
  return n;
}

void text_mitte(u8 y, const char *s, u8 pal) {
  u8 n = text_laenge(s);
  text(n >= BILD_B ? 0 : (BILD_B - n) / 2, y, s, pal);
}

u8 text_umbruch(u8 x, u8 y, u8 breite, const char *s, u8 pal) {
  const u8 *p = (const u8 *)s;
  const u8 *wort;
  const u8 *nach;
  u8 spalte = 0, zeilen = 1, laenge, c;
  while (*p) {
    // Nächstes Wort abmessen (bis Leerzeichen oder Ende).
    wort = p;
    laenge = 0;
    lesestelle = p;
    while (*lesestelle && *lesestelle != ' ') {
      naechstes_zeichen();
      laenge++;
    }
    nach = lesestelle;
    if (spalte > 0 && spalte + 1 + laenge > breite) {
      y++;
      zeilen++;
      spalte = 0;
    } else if (spalte > 0) {
      spalte++;
    }
    lesestelle = wort;
    while (lesestelle < nach) {
      c = naechstes_zeichen();
      if (spalte < breite) karte1[(u16)y * 32 + x + spalte] = EINTRAG(c, pal);
      spalte++;
    }
    p = nach;
    while (*p == ' ') p++;
  }
  karte1_neu = 1;
  return zeilen;
}

void zahl(u8 x, u8 y, u16 n, u8 breite, u8 pal) {
  u8 i = breite;
  while (i > 0) {
    i--;
    kachel(x + i, y, (n == 0 && i < breite - 1) ? ' ' : '0' + n % 10, pal);
    n /= 10;
  }
}
