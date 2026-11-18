/*
 * Elf zuerst! für Brett & Blatt 16 – nach packages/games/elevens/src/rules.ts, 2–6 Spieler.
 * Anlegespiel mit 80 Karten (1 bis 20 in Rot, Gelb, Grün, Blau).
 *
 * Karten als 0..79:
 *   Farbe = karte / 20 (0: Rot, 1: Gelb, 2: Grün, 3: Blau)
 *   Wert  = (karte % 20) + 1 (1..20)
 *
 * Züge:
 *   [0, Karte] – Karte anlegen
 *   [1, 0]     – Karte ziehen
 *   [2, 0]     – Zug beenden
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"

#define KEIN 0xff
#define KARTEN_GESAMT 80
#define START_WERT 11

static const u8 OPENING_KARTEN[4] = {10, 30, 50, 70}; /* r11, y11, g11, b11 */

typedef struct {
  u8 seats;
  u8 turn;
  u8 winner;      /* KEIN oder 0..seats-1 */
  u8 played;
  u8 drawn;
  u8 opening;     /* KEIN oder 0..79 */
  u8 draw_limit;  /* 1, 3 oder 255 (match) */
  u8 rows_low[4]; /* 0 wenn noch nicht begonnen, sonst 1..20 */
  u8 rows_high[4];
  u8 hand_n[PLAETZE_MAX];
  u8 hands[PLAETZE_MAX][40];
  u8 stock_head;
  u8 stock_n;
  u8 stock[KARTEN_GESAMT];
} Elevens;

static void hand_sortieren(u8 *hand, u8 n) {
  u8 i, j, min_idx, tmp;
  for (i = 0; i < n; i++) {
    min_idx = i;
    for (j = i + 1; j < n; j++) {
      if (hand[j] < hand[min_idx]) min_idx = j;
    }
    if (min_idx != i) {
      tmp = hand[i];
      hand[i] = hand[min_idx];
      hand[min_idx] = tmp;
    }
  }
}

static u8 fits(const u8 *rows_low, const u8 *rows_high, u8 card) {
  u8 c = card / 20;
  u8 v = (card % 20) + 1;
  if (rows_low[c] == 0) return v == START_WERT;
  return v == rows_low[c] - 1 || v == rows_high[c] + 1;
}

static u8 playable_count(const Elevens *e, u8 seat, u8 *out_cards) {
  u8 i, n = 0;
  if (e->opening != KEIN) {
    for (i = 0; i < e->hand_n[seat]; i++) {
      if (e->hands[seat][i] == e->opening) {
        if (out_cards) out_cards[0] = e->opening;
        return 1;
      }
    }
    return 0;
  }
  for (i = 0; i < e->hand_n[seat]; i++) {
    u8 c = e->hands[seat][i];
    if (fits(e->rows_low, e->rows_high, c)) {
      if (out_cards) out_cards[n] = c;
      n++;
    }
  }
  return n;
}

static u8 draw_allowed(const Elevens *e) {
  if (e->played > 0 || e->stock_head >= e->stock_n) return 0;
  return e->draw_limit == 255 || e->drawn < e->draw_limit;
}

static void pass_turn(Elevens *e) {
  e->turn = (e->turn + 1) % e->seats;
  e->played = 0;
  e->drawn = 0;
}

/* ------------------------------------------------------------------ Regeln */

static void elevens_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Elevens *e = (Elevens *)stand;
  Zufall z;
  u8 deck[KARTEN_GESAMT];
  u8 i, s, size, holder;

  e->seats = plaetze < 2 ? 2 : (plaetze > 6 ? 6 : plaetze);
  e->turn = 0;
  e->winner = KEIN;
  e->played = 0;
  e->drawn = 0;
  e->opening = KEIN;
  for (i = 0; i < 4; i++) {
    e->rows_low[i] = 0;
    e->rows_high[i] = 0;
  }

  /* Optionen: draw (0: 3, 1: 1, 2: match), start (0: red, 1: free) */
  if (optionen[0] == 1) e->draw_limit = 1;
  else if (optionen[0] == 2) e->draw_limit = 255;
  else e->draw_limit = 3;

  for (i = 0; i < KARTEN_GESAMT; i++) deck[i] = i;

  zufall_strom(&z, seed, "main");
  for (i = KARTEN_GESAMT - 1; i > 0; i--) {
    u16 j = zufall_bis(&z, i + 1);
    u8 tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  size = e->seats == 2 ? 20 : (60 / e->seats);
  for (s = 0; s < e->seats; s++) {
    e->hand_n[s] = size;
    for (i = 0; i < size; i++) e->hands[s][i] = deck[s * size + i];
    hand_sortieren(e->hands[s], size);
  }

  e->stock_head = 0;
  e->stock_n = KARTEN_GESAMT - e->seats * size;
  for (i = 0; i < e->stock_n; i++) e->stock[i] = deck[e->seats * size + i];

  /* Eröffnung mit roter Elf */
  if (optionen[1] != 1) { /* nicht 'free' */
    for (i = 0; i < 4; i++) {
      u8 target = OPENING_KARTEN[i];
      for (s = 0; s < e->seats; s++) {
        for (holder = 0; holder < e->hand_n[s]; holder++) {
          if (e->hands[s][holder] == target) {
            e->opening = target;
            e->turn = s;
            goto eroeffnung_gefunden;
          }
        }
      }
    }
  }
eroeffnung_gefunden:;
}

static u8 elevens_am_zug(const u8 *stand) {
  const Elevens *e = (const Elevens *)stand;
  return e->winner == KEIN ? e->turn : PLATZ_KEIN;
}

static u16 elevens_zuege(const u8 *stand, Zug *liste) {
  const Elevens *e = (const Elevens *)stand;
  u8 playable[40];
  u8 n_plays, i;
  u16 anz = 0;

  if (e->winner != KEIN) return 0;

  n_plays = playable_count(e, e->turn, playable);
  for (i = 0; i < n_plays; i++) {
    liste[anz].n = 2;
    liste[anz].b[0] = 0; /* play */
    liste[anz].b[1] = playable[i];
    anz++;
  }

  if (n_plays == 0 && draw_allowed(e)) {
    liste[anz].n = 2;
    liste[anz].b[0] = 1; /* draw */
    liste[anz].b[1] = 0;
    anz++;
  }

  if (e->played > 0 || (n_plays == 0 && !draw_allowed(e))) {
    liste[anz].n = 2;
    liste[anz].b[0] = 2; /* end */
    liste[anz].b[1] = 0;
    anz++;
  }

  return anz;
}

static u8 elevens_ziehen(u8 *stand, const Zug *zug) {
  Elevens *e = (Elevens *)stand;
  u8 turn = e->turn;

  if (zug->b[0] == 0) { /* play */
    u8 card = zug->b[1];
    u8 c = card / 20;
    u8 v = (card % 20) + 1;
    u8 i, pos = KEIN;

    for (i = 0; i < e->hand_n[turn]; i++) {
      if (e->hands[turn][i] == card) {
        pos = i;
        break;
      }
    }
    if (pos == KEIN) return KLANG_KLICK;

    for (i = pos; i < e->hand_n[turn] - 1; i++) e->hands[turn][i] = e->hands[turn][i + 1];
    e->hand_n[turn]--;

    if (e->rows_low[c] == 0) {
      e->rows_low[c] = v;
      e->rows_high[c] = v;
    } else {
      if (v < e->rows_low[c]) e->rows_low[c] = v;
      if (v > e->rows_high[c]) e->rows_high[c] = v;
    }

    e->played++;
    e->opening = KEIN;

    if (e->hand_n[turn] == 0) {
      e->winner = turn;
      return KLANG_SIEG;
    }

    /* Wenn keine weiteren Karten gelegt werden können, endet der Zug von selbst */
    if (playable_count(e, turn, 0) == 0) pass_turn(e);

    return KLANG_KARTE;
  }

  if (zug->b[0] == 1) { /* draw */
    if (e->stock_head < e->stock_n) {
      u8 card = e->stock[e->stock_head++];
      e->hands[turn][e->hand_n[turn]++] = card;
      hand_sortieren(e->hands[turn], e->hand_n[turn]);
      e->drawn++;

      if (playable_count(e, turn, 0) == 0 && !draw_allowed(e)) pass_turn(e);
      return KLANG_KARTE;
    }
    return KLANG_KLICK;
  }

  /* end */
  pass_turn(e);
  return KLANG_KLICK;
}

static u8 elevens_ergebnis(const u8 *stand, u8 *sieger) {
  const Elevens *e = (const Elevens *)stand;
  if (e->winner != KEIN) {
    *sieger = 1 << e->winner;
    return ERGEBNIS_SIEG;
  }
  return ERGEBNIS_LAEUFT;
}

/* ------------------------------------------------------------------ Bot */

static u8 hat_karte(const u8 *hand, u8 n, u8 card) {
  u8 i;
  for (i = 0; i < n; i++) if (hand[i] == card) return 1;
  return 0;
}

static u8 chain_after(const u8 *hand, u8 n, u8 card, const u8 *rows_low) {
  u8 c = card / 20;
  u8 v = (card % 20) + 1;
  u8 chain = 0;
  u8 curr;

  /* Nach unten (v - 1, v - 2, ...) */
  if (rows_low[c] == 0 || v < rows_low[c]) {
    curr = v;
    while (curr > 1 && hat_karte(hand, n, c * 20 + (curr - 2))) {
      chain++;
      curr--;
    }
  }
  /* Nach oben (v + 1, v + 2, ...) */
  if (rows_low[c] == 0 || v > rows_low[c]) {
    curr = v;
    while (curr < 20 && hat_karte(hand, n, c * 20 + curr)) {
      chain++;
      curr++;
    }
  }
  return chain;
}

static u8 opens_for_others(const u8 *hand, u8 n, u8 card, const u8 *rows_low) {
  u8 c = card / 20;
  u8 v = (card % 20) + 1;
  u8 curr;

  if (rows_low[c] == 0 || v < rows_low[c]) {
    curr = v;
    while (curr > 1 && hat_karte(hand, n, c * 20 + (curr - 2))) curr--;
    if (curr > 1) return 1;
  }
  if (rows_low[c] == 0 || v > rows_low[c]) {
    curr = v;
    while (curr < 20 && hat_karte(hand, n, c * 20 + curr)) curr++;
    if (curr < 20) return 1;
  }
  return 0;
}

static u8 gap_to_own(const u8 *hand, u8 n, u8 card, const u8 *rows_low) {
  u8 c = card / 20;
  u8 v = (card % 20) + 1;
  u8 best = 20, gap, curr;

  if (rows_low[c] == 0 || v < rows_low[c]) {
    curr = v;
    while (curr > 1 && hat_karte(hand, n, c * 20 + (curr - 2))) curr--;
    gap = 1;
    while (curr > 1) {
      curr--;
      if (hat_karte(hand, n, c * 20 + (curr - 1))) {
        if (gap < best) best = gap;
        break;
      }
      gap++;
    }
  }
  if (rows_low[c] == 0 || v > rows_low[c]) {
    curr = v;
    while (curr < 20 && hat_karte(hand, n, c * 20 + curr)) curr++;
    gap = 1;
    while (curr < 20) {
      curr++;
      if (hat_karte(hand, n, c * 20 + (curr - 1))) {
        if (gap < best) best = gap;
        break;
      }
      gap++;
    }
  }
  return best;
}

static void elevens_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Elevens *e = (const Elevens *)stand;
  u16 anz = elevens_zuege(stand, zugliste);
  u8 plays[40];
  u8 n_plays = 0, i;
  u8 has_end = 0;
  u8 turn = e->turn;
  const u8 *hand = e->hands[turn];
  u8 hn = e->hand_n[turn];

  if (anz == 0) return;

  for (i = 0; i < anz; i++) {
    if (zugliste[i].b[0] == 0) plays[n_plays++] = zugliste[i].b[1];
    else if (zugliste[i].b[0] == 2) has_end = 1;
  }

  if (n_plays == 0) {
    for (i = 0; i < anz; i++) {
      if (zugliste[i].b[0] == 1) { *zug = zugliste[i]; return; }
    }
    *zug = zugliste[0];
    return;
  }

  if (stufe == STUFE_LEICHT) {
    if (has_end && zufall_bis(z, 100) < 35) {
      zug->n = 2; zug->b[0] = 2; zug->b[1] = 0;
      return;
    }
    zug->n = 2; zug->b[0] = 0;
    zug->b[1] = plays[zufall_bis(z, n_plays)];
    return;
  }

  {
    u16 best_score = 0;
    u8 best_card = plays[0];
    u8 best_chain = 0, best_gift = 0;

    for (i = 0; i < n_plays; i++) {
      u8 c = plays[i];
      u8 v = (c % 20) + 1;
      u8 chain = chain_after(hand, hn, c, e->rows_low);
      u8 gift = opens_for_others(hand, hn, c, e->rows_low);
      u16 score = 50 + (u16)chain * 10 + (gift ? 0 : 5);
      if (v == START_WERT && chain > 0) score += 3;
      if (gift && stufe == STUFE_SCHWER) score -= gap_to_own(hand, hn, c, e->rows_low);

      if (score > best_score || i == 0) {
        best_score = score;
        best_card = c;
        best_chain = chain;
        best_gift = gift;
      }
    }

    if (stufe == STUFE_SCHWER && has_end && best_gift && best_chain == 0 && hn > 1) {
      zug->n = 2; zug->b[0] = 2; zug->b[1] = 0;
      return;
    }

    zug->n = 2; zug->b[0] = 0; zug->b[1] = best_card;
  }
}

/* ------------------------------------------------------------------ Prüfmodus */

static u16 elevens_ausgeben(const u8 *stand, u8 *p) {
  const Elevens *e = (const Elevens *)stand;
  u16 n = 0;
  u8 s, i;

  p[n++] = e->seats;
  p[n++] = e->turn;
  p[n++] = e->winner;
  p[n++] = e->played;
  p[n++] = e->drawn;
  p[n++] = e->opening;

  for (i = 0; i < 4; i++) {
    p[n++] = e->rows_low[i];
    p[n++] = e->rows_high[i];
  }

  for (s = 0; s < e->seats; s++) {
    p[n++] = e->hand_n[s];
    for (i = 0; i < e->hand_n[s]; i++) p[n++] = e->hands[s][i];
  }

  {
    u8 rem = e->stock_n - e->stock_head;
    p[n++] = rem;
    for (i = 0; i < rem; i++) p[n++] = e->stock[e->stock_head + i];
  }

  return n;
}

/* ------------------------------------------------------------------ Oberfläche */

#define FELD_ZIEHEN 100
#define FELD_FERTIG 101

static void elevens_gitter(const u8 *stand, u8 *b, u8 *h) {
  const Elevens *e = (const Elevens *)stand;
  u8 hn = e->hand_n[e->turn];
  *b = hn > 0 ? hn : 1;
  *h = 2; /* Zeile 0: Aktionen (Ziehen, Fertig), Zeile 1: Handkarten */
}

static u8 elevens_feld_an(const u8 *stand, u8 x, u8 y) {
  const Elevens *e = (const Elevens *)stand;
  if (y == 0) {
    if (x == 0) return FELD_ZIEHEN;
    if (x == 1) return FELD_FERTIG;
    return FELD_KEIN;
  }
  if (x < e->hand_n[e->turn]) return x;
  return FELD_KEIN;
}

static u8 elevens_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  const Elevens *e = (const Elevens *)stand;
  u8 turn = e->turn;
  u8 i;
  (void)stand;

  if (zug->b[0] == 1) {
    felder[0] = FELD_ZIEHEN;
    return 1;
  }
  if (zug->b[0] == 2) {
    felder[0] = FELD_FERTIG;
    return 1;
  }
  for (i = 0; i < e->hand_n[turn]; i++) {
    if (e->hands[turn][i] == zug->b[1]) {
      felder[0] = i;
      return 1;
    }
  }
  return 0;
}

static const char *const FARBNAMEN[4] = {"Rot:", "Gelb:", "Grün:", "Blau:"};
static const u8 FARBPAL[4] = {PAL_ROT, PAL_GELB, PAL_TEXT, PAL_BLAU};

static void elevens_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Elevens *e = (const Elevens *)stand;
  u8 c, i;
  u8 turn = e->turn;

  karten_farben_laden();

  /* 4 Ablagereihen oben (Zeilen 4 bis 11) */
  for (c = 0; c < 4; c++) {
    u8 y = 4 + c * 2;
    text(2, y, FARBNAMEN[c], FARBPAL[c]);
    if (e->rows_low[c] == 0) {
      text(9, y, "—", PAL_GRAU);
      text(12, y, "[11]", PAL_GRAU);
      text(17, y, "—", PAL_GRAU);
    } else {
      zahl(8, y, e->rows_low[c], 2, FARBPAL[c]);
      text(11, y, "◀", PAL_GRAU);
      text(13, y, "11", FARBPAL[c]);
      text(16, y, "▶", PAL_GRAU);
      zahl(18, y, e->rows_high[c], 2, FARBPAL[c]);
    }
  }

  /* Stapel und Aktionen in Zeile 13/14 */
  flaeche_leeren(1, 13, 30, 3);
  text(2, 14, "Stapel:", PAL_GRAU);
  zahl(10, 14, e->stock_n - e->stock_head, 2, PAL_TEXT);

  /* Aktionen */
  {
    u8 z_ziel = aktiv && (markierung[FELD_ZIEHEN] & MARK_ZIEL);
    u8 z_cur = aktiv && (markierung[FELD_ZIEHEN] & MARK_CURSOR);
    u8 f_ziel = aktiv && (markierung[FELD_FERTIG] & MARK_ZIEL);
    u8 f_cur = aktiv && (markierung[FELD_FERTIG] & MARK_CURSOR);

    kachel(15, 14, z_cur ? K_PFEIL : 0, PAL_GELB);
    text(16, 14, "Ziehen", z_ziel ? PAL_TEXT : PAL_GRAU);

    kachel(23, 14, f_cur ? K_PFEIL : 0, PAL_GELB);
    text(24, 14, "Fertig", f_ziel ? PAL_TEXT : PAL_GRAU);
  }

  /* Handkarten des Spielers am Zug (Zeilen 17 bis 24) */
  flaeche_leeren(1, 17, 30, 8);
  if (aktiv) {
    u8 hn = e->hand_n[turn];
    for (i = 0; i < hn; i++) {
      u8 card = e->hands[turn][i];
      u8 color = card / 20;
      u8 val = (card % 20) + 1;
      u8 x = 2 + (i % 9) * 3;
      u8 y = 17 + (i / 9) * 4;
      u8 m = markierung[i];
      u8 pal = (m & MARK_CURSOR) ? 6 : ((m & MARK_ZIEL) ? 7 : 5);

      if (x + 3 <= BILD_B && y + 4 <= BILD_H) {
        karten_zahl(x, y, color, val, 1, pal);
      }
    }
  } else {
    text(2, 18, "Handkarten verdeckt", PAL_GRAU);
  }
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const ANLEITUNG[] = {
  "Das Familien-Anlegespiel mit 80 Zahlenkarten: Jede Farbe beginnt mit der Elf, dann geht es hinauf bis 20 und hinunter bis 1.",
  "Wer die rote Elf hat, legt sie als Erstes aus. An eine Reihe legst du die nächsthöhere oder nächstniedrigere Zahl an.",
  "In deinem Zug legst du so viele passende Karten, wie du möchtest – mindestens eine, wenn du kannst. Mit „Fertig“ gibst du weiter.",
  "Passt keine Karte, ziehst du vom Stapel.",
  "Wer zuerst alle Karten abgelegt hat, gewinnt.",
  0,
};

static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4", "Spieler 5", "Spieler 6"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_TEXT, PAL_GRAU, PAL_ROT};
static const char *const ZIEHEN_OPT[] = {"3 Karten", "1 Karte", "bis passt"};
static const char *const START_OPT[] = {"Rote Elf", "Frei"};
static const Option OPTIONEN[] = {
  {"Ziehen", ZIEHEN_OPT, 3, 0},
  {"Start", START_OPT, 2, 0},
};

const Spiel spiel_elevens = {
  "Elf zuerst!",
  ANLEITUNG,
  "✚ wählen · A: Karte anlegen, Ziehen oder Fertig",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  6,
  1, /* verdeckt */
  OPTIONEN,
  2,
  FARBEN_KARTEN,
  elevens_aufbauen,
  elevens_am_zug,
  elevens_zuege,
  elevens_ziehen,
  elevens_ergebnis,
  elevens_bot,
  elevens_ausgeben,
  elevens_gitter,
  elevens_feld_an,
  elevens_felder,
  elevens_zeichnen,
  0,
  0,
};
