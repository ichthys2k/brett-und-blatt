/*
 * Solitaire (Klondike) für Brett & Blatt 16 – nach packages/games/solitaire.
 * Geduldspiel mit 52 Karten (Französisches Blatt: Kreuz, Karo, Herz, Pik; Ass bis König).
 *
 * Züge:
 *   [0, von, nach, anzahl] – Karten verschieben
 *       von/nach: 0..6 Tableau, 10..13 Foundation (0=C, 1=D, 2=H, 3=S), 20 Waste
 *   [1, 0, 0, 0]           – Talon ziehen (1 oder 3 Karten auf die Ablage)
 *   [2, 0, 0, 0]           – Ablage zurück in den Talon
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"

#define MOVE_LIMIT 1500
#define F_STOCK 0
#define F_WASTE 1
#define F_FOUND_0 2
#define F_TAB_BASE 10
#define LOC_WASTE 20

typedef struct {
  u8 draw;        /* 1 oder 3 */
  u16 move_count; /* 0..1500 */
  u8 tableau_down_n[7];
  u8 tableau_down[7][6];
  u8 tableau_up_n[7];
  u8 tableau_up[7][19];
  u8 found_n[4];
  u8 stock_n;
  u8 stock[24];
  u8 waste_n;
  u8 waste[24];
  u8 last_art;    /* 0xff wenn kein, 0 move, 1 draw, 2 recycle */
  u8 last_von;
  u8 last_nach;
  u8 last_anzahl;
} Solitaire;

static inline u8 card_suit(u8 c) { return c / 13; }
static inline u8 card_rank(u8 c) { return (c % 13) + 1; }
static inline u8 is_red(u8 c) {
  u8 s = card_suit(c);
  return s == FARBE_KARO || s == FARBE_HERZ;
}
static inline u8 fits_alternating(u8 target, u8 card) {
  return is_red(target) != is_red(card) && card_rank(target) == card_rank(card) + 1;
}
static inline u8 fits_foundation(u8 found_count, u8 card) {
  return found_count == 0 ? card_rank(card) == 1 : card_rank(card) == found_count + 1;
}

/* ------------------------------------------------------------------ Regeln */

static void solitaire_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Solitaire *s = (Solitaire *)stand;
  Zufall z;
  u8 deck[52];
  u8 i, c, deck_idx = 0;

  s->draw = optionen && optionen[0] == 1 ? 3 : 1;
  s->move_count = 0;
  s->last_art = 0xff;
  s->last_von = 0;
  s->last_nach = 0;
  s->last_anzahl = 0;

  for (i = 0; i < 4; i++) s->found_n[i] = 0;
  s->waste_n = 0;

  for (i = 0; i < 52; i++) deck[i] = i;
  zufall_strom(&z, seed, "mischen");
  for (i = 51; i > 0; i--) {
    u16 j = zufall_bis(&z, i + 1);
    u8 tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  for (c = 0; c < 7; c++) {
    s->tableau_down_n[c] = c;
    for (i = 0; i < c; i++) s->tableau_down[c][i] = deck[deck_idx++];
    s->tableau_up_n[c] = 1;
    s->tableau_up[c][0] = deck[deck_idx++];
  }

  s->stock_n = 52 - deck_idx;
  for (i = 0; i < s->stock_n; i++) s->stock[i] = deck[deck_idx++];
}

static u16 solitaire_zuege(const u8 *stand, Zug *zuege) {
  const Solitaire *s = (const Solitaire *)stand;
  u16 n = 0;
  u8 i, count, c_target;

  if (s->move_count >= MOVE_LIMIT) return 0;
  if (s->found_n[0] == 13 && s->found_n[1] == 13 && s->found_n[2] == 13 && s->found_n[3] == 13) return 0;

  /* 1. Tableau */
  for (i = 0; i < 7; i++) {
    if (s->tableau_up_n[i] > 0) {
      u8 top_card = s->tableau_up[i][s->tableau_up_n[i] - 1];
      u8 f_idx = card_suit(top_card);
      /* auf Foundation */
      if (fits_foundation(s->found_n[f_idx], top_card)) {
        zuege[n].n = 4;
        zuege[n].b[0] = 0;
        zuege[n].b[1] = i;
        zuege[n].b[2] = 10 + f_idx;
        zuege[n].b[3] = 1;
        n++;
      }
      /* auf anderes Tableau */
      for (count = 1; count <= s->tableau_up_n[i]; count++) {
        u8 bottom = s->tableau_up[i][s->tableau_up_n[i] - count];
        for (c_target = 0; c_target < 7; c_target++) {
          if (c_target == i) continue;
          if (s->tableau_up_n[c_target] == 0) {
            if (s->tableau_down_n[c_target] == 0 && card_rank(bottom) == 13) {
              zuege[n].n = 4;
              zuege[n].b[0] = 0;
              zuege[n].b[1] = i;
              zuege[n].b[2] = c_target;
              zuege[n].b[3] = count;
              n++;
            }
          } else {
            u8 target_card = s->tableau_up[c_target][s->tableau_up_n[c_target] - 1];
            if (fits_alternating(target_card, bottom)) {
              zuege[n].n = 4;
              zuege[n].b[0] = 0;
              zuege[n].b[1] = i;
              zuege[n].b[2] = c_target;
              zuege[n].b[3] = count;
              n++;
            }
          }
        }
      }
    }
  }

  /* 2. Waste */
  if (s->waste_n > 0) {
    u8 w_card = s->waste[s->waste_n - 1];
    u8 f_idx = card_suit(w_card);
    if (fits_foundation(s->found_n[f_idx], w_card)) {
      zuege[n].n = 4;
      zuege[n].b[0] = 0;
      zuege[n].b[1] = LOC_WASTE;
      zuege[n].b[2] = 10 + f_idx;
      zuege[n].b[3] = 1;
      n++;
    }
    for (c_target = 0; c_target < 7; c_target++) {
      if (s->tableau_up_n[c_target] == 0) {
        if (s->tableau_down_n[c_target] == 0 && card_rank(w_card) == 13) {
          zuege[n].n = 4;
          zuege[n].b[0] = 0;
          zuege[n].b[1] = LOC_WASTE;
          zuege[n].b[2] = c_target;
          zuege[n].b[3] = 1;
          n++;
        }
      } else {
        u8 target_card = s->tableau_up[c_target][s->tableau_up_n[c_target] - 1];
        if (fits_alternating(target_card, w_card)) {
          zuege[n].n = 4;
          zuege[n].b[0] = 0;
          zuege[n].b[1] = LOC_WASTE;
          zuege[n].b[2] = c_target;
          zuege[n].b[3] = 1;
          n++;
        }
      }
    }
  }

  /* 3. Von Foundation auf Tableau */
  for (i = 0; i < 4; i++) {
    if (s->found_n[i] > 0) {
      u8 f_card = (i * 13) + s->found_n[i] - 1;
      for (c_target = 0; c_target < 7; c_target++) {
        if (s->tableau_up_n[c_target] == 0) {
          if (s->tableau_down_n[c_target] == 0 && card_rank(f_card) == 13) {
            zuege[n].n = 4;
            zuege[n].b[0] = 0;
            zuege[n].b[1] = 10 + i;
            zuege[n].b[2] = c_target;
            zuege[n].b[3] = 1;
            n++;
          }
        } else {
          u8 target_card = s->tableau_up[c_target][s->tableau_up_n[c_target] - 1];
          if (fits_alternating(target_card, f_card)) {
            zuege[n].n = 4;
            zuege[n].b[0] = 0;
            zuege[n].b[1] = 10 + i;
            zuege[n].b[2] = c_target;
            zuege[n].b[3] = 1;
            n++;
          }
        }
      }
    }
  }

  /* 4. Draw / Recycle */
  if (s->stock_n > 0) {
    zuege[n].n = 4;
    zuege[n].b[0] = 1;
    zuege[n].b[1] = 0;
    zuege[n].b[2] = 0;
    zuege[n].b[3] = 0;
    n++;
  } else if (s->waste_n > 0) {
    zuege[n].n = 4;
    zuege[n].b[0] = 2;
    zuege[n].b[1] = 0;
    zuege[n].b[2] = 0;
    zuege[n].b[3] = 0;
    n++;
  }

  return n;
}

static u8 solitaire_ziehen(u8 *stand, const Zug *zug) {
  Solitaire *s = (Solitaire *)stand;
  u8 art = zug->b[0];
  u8 von = zug->b[1];
  u8 nach = zug->b[2];
  u8 anzahl = zug->b[3];
  u8 i;

  s->move_count++;
  s->last_art = art;
  s->last_von = von;
  s->last_nach = nach;
  s->last_anzahl = anzahl;

  if (art == 1) {
    u8 take = s->draw < s->stock_n ? s->draw : s->stock_n;
    for (i = 0; i < take; i++) {
      s->waste[s->waste_n++] = s->stock[s->stock_n - 1 - i];
    }
    s->stock_n -= take;
    return KLANG_KARTE;
  }
  if (art == 2) {
    for (i = 0; i < s->waste_n; i++) {
      s->stock[i] = s->waste[s->waste_n - 1 - i];
    }
    s->stock_n = s->waste_n;
    s->waste_n = 0;
    return KLANG_KARTE;
  }

  if (von < 7) {
    u8 pile_from = von;
    u8 start_idx = s->tableau_up_n[pile_from] - anzahl;
    if (nach < 7) {
      u8 pile_to = nach;
      for (i = 0; i < anzahl; i++) {
        s->tableau_up[pile_to][s->tableau_up_n[pile_to]++] = s->tableau_up[pile_from][start_idx + i];
      }
    } else if (nach >= 10 && nach <= 13) {
      u8 f_idx = nach - 10;
      s->found_n[f_idx]++;
    }
    s->tableau_up_n[pile_from] -= anzahl;
    if (s->tableau_up_n[pile_from] == 0 && s->tableau_down_n[pile_from] > 0) {
      s->tableau_up[pile_from][0] = s->tableau_down[pile_from][--s->tableau_down_n[pile_from]];
      s->tableau_up_n[pile_from] = 1;
    }
  } else if (von == LOC_WASTE) {
    u8 card = s->waste[--s->waste_n];
    if (nach < 7) {
      s->tableau_up[nach][s->tableau_up_n[nach]++] = card;
    } else if (nach >= 10 && nach <= 13) {
      s->found_n[nach - 10]++;
    }
  } else if (von >= 10 && von <= 13) {
    u8 f_idx = von - 10;
    u8 card = (f_idx * 13) + s->found_n[f_idx] - 1;
    s->found_n[f_idx]--;
    if (nach < 7) {
      s->tableau_up[nach][s->tableau_up_n[nach]++] = card;
    }
  }
  return KLANG_KARTE;
}

static u8 solitaire_ergebnis(const u8 *stand, u8 *sieger) {
  const Solitaire *s = (const Solitaire *)stand;
  u16 n;
  if (s->found_n[0] == 13 && s->found_n[1] == 13 && s->found_n[2] == 13 && s->found_n[3] == 13) {
    if (sieger) *sieger = 1;
    return ERGEBNIS_SIEG;
  }
  if (s->move_count >= MOVE_LIMIT) {
    if (sieger) *sieger = 0;
    return ERGEBNIS_VERLOREN;
  }
  n = solitaire_zuege(stand, zugliste);
  if (n == 0) {
    if (sieger) *sieger = 0;
    return ERGEBNIS_VERLOREN;
  }
  return ERGEBNIS_LAEUFT;
}

static u8 solitaire_am_zug(const u8 *stand) {
  u8 sieger;
  if (solitaire_ergebnis(stand, &sieger) != ERGEBNIS_LAEUFT) return PLATZ_KEIN;
  return 0;
}

static u16 solitaire_ausgeben(const u8 *stand, u8 *aus) {
  const Solitaire *s = (const Solitaire *)stand;
  u16 k = 0;
  u8 c, i;

  aus[k++] = s->draw;
  aus[k++] = s->move_count & 0xff;
  aus[k++] = s->move_count >> 8;

  for (c = 0; c < 7; c++) {
    aus[k++] = s->tableau_down_n[c];
    for (i = 0; i < s->tableau_down_n[c]; i++) aus[k++] = s->tableau_down[c][i];
    aus[k++] = s->tableau_up_n[c];
    for (i = 0; i < s->tableau_up_n[c]; i++) aus[k++] = s->tableau_up[c][i];
  }

  for (i = 0; i < 4; i++) aus[k++] = s->found_n[i];

  aus[k++] = s->stock_n;
  for (i = 0; i < s->stock_n; i++) aus[k++] = s->stock[i];

  aus[k++] = s->waste_n;
  for (i = 0; i < s->waste_n; i++) aus[k++] = s->waste[i];

  aus[k++] = s->last_art;
  aus[k++] = s->last_von;
  aus[k++] = s->last_nach;
  aus[k++] = s->last_anzahl;

  return k;
}

/* ------------------------------------------------------------------ Bot */

static s16 score_move(const Solitaire *s, const Zug *zug) {
  u8 art = zug->b[0];
  u8 von = zug->b[1];
  u8 nach = zug->b[2];
  u8 anzahl = zug->b[3];

  if (s->last_art == 0 && art == 0 && s->last_von == nach && s->last_nach == von && s->last_anzahl == anzahl) {
    return -200;
  }
  if (art == 1) return 2;
  if (art == 2) return 1;

  if (nach >= 10 && nach <= 13) {
    u8 card = 0;
    if (von < 7) card = s->tableau_up[von][s->tableau_up_n[von] - 1];
    else if (von == LOC_WASTE) card = s->waste[s->waste_n - 1];
    return 80 + (card_rank(card) <= 2 ? 40 : 0);
  }

  if (von >= 10 && von <= 13) return -40;

  if (von == LOC_WASTE) return 30;

  if (von < 7 && nach < 7) {
    u8 exposes = (anzahl == s->tableau_up_n[von] && s->tableau_down_n[von] > 0);
    u8 target_empty = (s->tableau_up_n[nach] == 0 && s->tableau_down_n[nach] == 0);
    if (exposes) return 60 + s->tableau_down_n[von] * 3;
    if (target_empty && s->tableau_down_n[von] == 0 && anzahl == s->tableau_up_n[von]) return -100;

    if (anzahl < s->tableau_up_n[von]) {
      u8 below = s->tableau_up[von][s->tableau_up_n[von] - anzahl - 1];
      u8 need = s->found_n[card_suit(below)] + 1;
      return card_rank(below) <= need ? 50 : -5;
    }
    return target_empty ? 0 : 10;
  }

  return 0;
}

static void solitaire_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Solitaire *s = (const Solitaire *)stand;
  u16 n = solitaire_zuege(stand, zugliste);
  u16 i, pick;
  s16 best_score = -30000;
  u16 best_count = 0;
  u16 sensible_count = 0;

  if (n == 0) return;

  if (stufe != STUFE_LEICHT) {
    for (i = 0; i < n; i++) {
      if (zugliste[i].b[0] == 0 && zugliste[i].b[2] >= 10 && zugliste[i].b[2] <= 13) {
        u8 card = 0;
        u8 von = zugliste[i].b[1];
        if (von < 7) card = s->tableau_up[von][s->tableau_up_n[von] - 1];
        else if (von == LOC_WASTE) card = s->waste[s->waste_n - 1];
        if (card_rank(card) <= 2) {
          *zug = zugliste[i];
          return;
        }
      }
    }
  }

  for (i = 0; i < n; i++) {
    s16 sc = score_move(s, &zugliste[i]);
    if (sc > 0) sensible_count++;
    if (sc > best_score) {
      best_score = sc;
      best_count = 1;
    } else if (sc == best_score) {
      best_count++;
    }
  }

  if (stufe == STUFE_LEICHT && sensible_count > 0 && zufall_halb(z)) {
    pick = zufall_bis(z, sensible_count);
    for (i = 0; i < n; i++) {
      if (score_move(s, &zugliste[i]) > 0) {
        if (pick == 0) { *zug = zugliste[i]; return; }
        pick--;
      }
    }
  }

  if (stufe == STUFE_MITTEL && sensible_count > 0 && zufall_bis(z, 10) == 0) {
    pick = zufall_bis(z, sensible_count);
    for (i = 0; i < n; i++) {
      if (score_move(s, &zugliste[i]) > 0) {
        if (pick == 0) { *zug = zugliste[i]; return; }
        pick--;
      }
    }
  }

  pick = zufall_bis(z, best_count);
  for (i = 0; i < n; i++) {
    if (score_move(s, &zugliste[i]) == best_score) {
      if (pick == 0) { *zug = zugliste[i]; return; }
      pick--;
    }
  }
}

/* ------------------------------------------------------------------ Oberfläche */

static void solitaire_gitter(const u8 *stand, u8 *breite, u8 *hoehe) {
  *breite = 7;
  *hoehe = 16;
}

static u8 solitaire_feld_an(const u8 *stand, u8 x, u8 y) {
  const Solitaire *s = (const Solitaire *)stand;
  u8 c, u;
  if (x >= 7) return FELD_KEIN;
  if (y == 0) {
    if (x == 0) return F_STOCK;
    if (x == 1) return F_WASTE;
    if (x >= 3 && x <= 6) return F_FOUND_0 + (x - 3);
    return FELD_KEIN;
  }
  c = x;
  if (s->tableau_up_n[c] == 0 && s->tableau_down_n[c] == 0) {
    return y == 1 ? F_TAB_BASE + c * 20 : FELD_KEIN;
  }
  if (y <= s->tableau_down_n[c]) return FELD_KEIN;
  u = y - 1 - s->tableau_down_n[c];
  if (u < s->tableau_up_n[c]) return F_TAB_BASE + c * 20 + u;
  return FELD_KEIN;
}

static u8 solitaire_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  const Solitaire *s = (const Solitaire *)stand;
  u8 von, nach, anzahl, f_from, f_to;

  if (zug->b[0] == 1 || zug->b[0] == 2) {
    felder[0] = F_STOCK;
    return 1;
  }
  von = zug->b[1];
  nach = zug->b[2];
  anzahl = zug->b[3];

  if (von < 7) {
    u8 u = s->tableau_up_n[von] - anzahl;
    f_from = F_TAB_BASE + von * 20 + u;
  } else if (von == LOC_WASTE) {
    f_from = F_WASTE;
  } else {
    f_from = F_FOUND_0 + (von - 10);
  }

  if (nach < 7) {
    if (s->tableau_up_n[nach] == 0) f_to = F_TAB_BASE + nach * 20;
    else f_to = F_TAB_BASE + nach * 20 + s->tableau_up_n[nach] - 1;
  } else {
    f_to = F_FOUND_0 + (nach - 10);
  }

  felder[0] = f_from;
  felder[1] = f_to;
  return 2;
}

static u8 pal_fuer(u8 mark) {
  if (mark & MARK_CURSOR) return PAL_BRETT_AUSWAHL;
  if (mark & MARK_GEWAEHLT) return PAL_BRETT_MARKE;
  if (mark & MARK_ZIEL) return PAL_BRETT_MARKE;
  return PAL_BRETT;
}

static void solitaire_zeichnen(const u8 *stand, const u8 *markierung, u8 vorschau) {
  const Solitaire *s = (const Solitaire *)stand;
  u8 i, c, u, d, pal, fx, cx, y;
  (void)vorschau;

  karten_farben_laden();

  /* 1. Talon */
  pal = pal_fuer(markierung[F_STOCK]);
  if (s->stock_n > 0) karten_koerper(2, 2, KARTEN_RUECKEN, pal);
  else karten_koerper(2, 2, KARTEN_LEER, pal);

  /* 2. Ablage (Waste) */
  pal = pal_fuer(markierung[F_WASTE]);
  if (s->waste_n > 0) {
    u8 card = s->waste[s->waste_n - 1];
    karten_franzoesisch(6, 2, card_suit(card), card_rank(card), 1, pal);
  } else {
    karten_koerper(6, 2, KARTEN_LEER, pal);
  }

  /* 3. Foundations */
  for (i = 0; i < 4; i++) {
    fx = 14 + i * 4;
    pal = pal_fuer(markierung[F_FOUND_0 + i]);
    if (s->found_n[i] > 0) {
      u8 card = (i * 13) + s->found_n[i] - 1;
      karten_franzoesisch(fx, 2, i, card_rank(card), 1, pal);
    } else {
      const char *sym;
      u8 tpal;
      karten_koerper(fx, 2, KARTEN_LEER, pal);
      flaeche_leeren(fx, 2, KARTE_B, KARTE_H);
      if (i == FARBE_KREUZ) sym = "♣";
      else if (i == FARBE_KARO) sym = "♦";
      else if (i == FARBE_HERZ) sym = "♥";
      else sym = "♠";
      tpal = (i == FARBE_KARO || i == FARBE_HERZ) ? PAL_ROT : PAL_TEXT;
      text(fx + 1, 3, sym, tpal);
    }
  }

  /* 4. Tableau */
  for (c = 0; c < 7; c++) {
    cx = 2 + c * 4;
    y = 7;
    if (s->tableau_down_n[c] == 0 && s->tableau_up_n[c] == 0) {
      pal = pal_fuer(markierung[F_TAB_BASE + c * 20]);
      karten_koerper(cx, y, KARTEN_LEER, pal);
      flaeche_leeren(cx, y, KARTE_B, KARTE_H);
    } else {
      for (d = 0; d < s->tableau_down_n[c]; d++) {
        karten_koerper(cx, y, KARTEN_RUECKEN, PAL_BRETT);
        flaeche_leeren(cx, y, KARTE_B, KARTE_H);
        y += 1;
      }
      for (u = 0; u < s->tableau_up_n[c]; u++) {
        u8 card = s->tableau_up[c][u];
        pal = pal_fuer(markierung[F_TAB_BASE + c * 20 + u]);
        karten_franzoesisch(cx, y, card_suit(card), card_rank(card), 1, pal);
        y += 2;
      }
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const ANLEITUNG[] = {
  "Solitaire (Klondike) ist ein Geduldspiel für einen Spieler.",
  "Ziel ist es, alle 52 Karten nach Farben getrennt vom Ass bis zum König auf die vier Ablagen zu legen.",
  "Auf dem Spielfeld werden Karten absteigend mit wechselnden Farben (Rot auf Schwarz, Schwarz auf Rot) angelegt.",
  "Leere Spalten dürfen nur mit einem König belegt werden. Mit dem Talon werden neue Karten aufgedeckt.",
  0
};

static const char *const ZUG_WERTE[] = {"Eine (1)", "Drei (3)"};

static const Option OPTIONEN[] = {
  {"Karten ziehen", ZUG_WERTE, 2, 0},
  {0}
};

static const char *const PLATZ_NAMEN[PLAETZE_MAX] = {"Spieler", 0, 0, 0, 0, 0};
static const u8 PLATZ_PALETTEN[PLAETZE_MAX] = {PAL_GELB, 0, 0, 0, 0, 0};

const Spiel spiel_solitaire = {
  "Solitaire",
  ANLEITUNG,
  "A: wählen/legen · B: abbrechen",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  1,
  1,
  0, /* verdeckt */
  OPTIONEN,
  1,
  FARBEN_KARTEN,
  solitaire_aufbauen,
  solitaire_am_zug,
  solitaire_zuege,
  solitaire_ziehen,
  solitaire_ergebnis,
  solitaire_bot,
  solitaire_ausgeben,
  solitaire_gitter,
  solitaire_feld_an,
  solitaire_felder,
  solitaire_zeichnen,
  0,
  0,
  0,
  0,
  0,
};
