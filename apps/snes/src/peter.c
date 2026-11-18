/*
 * Schwarzer Peter für Brett & Blatt 16 – nach packages/games/black-peter/src/rules.ts, 2–4 Spieler.
 * Paare ablegen, beim Nachbarn ziehen – und bloß nicht den Schwarzen Peter behalten.
 *
 * Karten:
 *   0..63:       Paare 0..31 (a: pair*2, b: pair*2+1)
 *   PETER_KARTE: 0xff (Schwarzer Peter)
 *
 * Züge:
 *   [0, Index, 0, 0] – Karte vom Nachbarn ziehen
 *   [1, 0, 0, 0]     – Eigene Hand mischen
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "../res/grafik.h"

#define KEIN 0xff
#define PETER_KARTE 0xff

typedef struct {
  u8 seats;
  u8 turn;
  u8 loser; /* KEIN oder 0..seats-1 */
  u8 shuffled_this_turn;

  u8 opt_pairs; /* 0: 8, 1: 12, 2: 16 */

  u8 hand_n[PLAETZE_MAX];
  u8 hands[PLAETZE_MAX][33];

  u8 discarded_n;
  u8 discarded_pair[32];
  u8 discarded_seat[32];

  Zufall rng;
} Peter;

static u8 next_with_cards(const Peter *p, u8 from) {
  u8 k;
  for (k = 1; k <= p->seats; k++) {
    u8 seat = (from + k) % p->seats;
    if (p->hand_n[seat] > 0) return seat;
  }
  return KEIN;
}

static u8 source_of(const Peter *p) {
  u8 src = next_with_cards(p, p->turn);
  return (src == p->turn) ? KEIN : src;
}

static void remove_initial_pairs(Peter *p, u8 seat) {
  u8 i, j;
  u8 new_hand[33];
  u8 new_n = 0;
  u8 paired[33];
  u8 n = p->hand_n[seat];

  for (i = 0; i < n; i++) paired[i] = 0;

  for (i = 0; i < n; i++) {
    if (paired[i] || p->hands[seat][i] == PETER_KARTE) continue;
    for (j = i + 1; j < n; j++) {
      if (!paired[j] && (p->hands[seat][i] / 2 == p->hands[seat][j] / 2)) {
        paired[i] = 1;
        paired[j] = 1;
        p->discarded_pair[p->discarded_n] = p->hands[seat][i] / 2;
        p->discarded_seat[p->discarded_n] = seat;
        p->discarded_n++;
        break;
      }
    }
  }

  for (i = 0; i < n; i++) {
    if (!paired[i]) {
      new_hand[new_n++] = p->hands[seat][i];
    }
  }

  p->hand_n[seat] = new_n;
  for (i = 0; i < new_n; i++) {
    p->hands[seat][i] = new_hand[i];
  }
}

/* ------------------------------------------------------------------ Regeln */

static void peter_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Peter *p = (Peter *)stand;
  u8 all_pairs[32];
  u8 deck[65];
  u8 pair_count, deck_n, i, s;

  p->seats = plaetze < 2 ? 2 : (plaetze > PLAETZE_MAX ? PLAETZE_MAX : plaetze);
  p->turn = 0;
  p->loser = KEIN;
  p->shuffled_this_turn = 0;
  p->discarded_n = 0;
  for (s = 0; s < PLAETZE_MAX; s++) p->hand_n[s] = 0;

  p->opt_pairs = optionen[0];
  pair_count = (p->opt_pairs == 0) ? 8 : ((p->opt_pairs == 2) ? 16 : 12);

  zufall_strom(&p->rng, seed, "karten");

  for (i = 0; i < 32; i++) all_pairs[i] = i;
  for (i = 31; i > 0; i--) {
    u16 j = zufall_bis(&p->rng, i + 1);
    u8 t = all_pairs[i];
    all_pairs[i] = all_pairs[j];
    all_pairs[j] = t;
  }

  deck_n = pair_count * 2 + 1;
  for (i = 0; i < pair_count; i++) {
    deck[i * 2] = all_pairs[i] * 2;
    deck[i * 2 + 1] = all_pairs[i] * 2 + 1;
  }
  deck[pair_count * 2] = PETER_KARTE;

  for (i = deck_n - 1; i > 0; i--) {
    u16 j = zufall_bis(&p->rng, i + 1);
    u8 t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }

  for (i = 0; i < deck_n; i++) {
    s = i % p->seats;
    p->hands[s][p->hand_n[s]++] = deck[i];
  }

  for (s = 0; s < p->seats; s++) {
    remove_initial_pairs(p, s);
  }

  p->turn = next_with_cards(p, p->seats - 1);
  if (p->turn == KEIN) p->turn = 0;
}

static u8 peter_am_zug(const u8 *stand) {
  const Peter *p = (const Peter *)stand;
  return p->loser != KEIN ? PLATZ_KEIN : p->turn;
}

static u16 peter_zuege(const u8 *stand, Zug *liste) {
  const Peter *p = (const Peter *)stand;
  u16 anzahl = 0;
  u8 src, i;

  if (p->loser != KEIN) return 0;
  src = source_of(p);
  if (src == KEIN) return 0;

  for (i = 0; i < p->hand_n[src]; i++) {
    liste[anzahl].n = 2;
    liste[anzahl].b[0] = 0; /* draw */
    liste[anzahl].b[1] = i;
    anzahl++;
  }

  if (!p->shuffled_this_turn && p->hand_n[p->turn] > 1) {
    liste[anzahl].n = 2;
    liste[anzahl].b[0] = 1; /* shuffle */
    liste[anzahl].b[1] = 0;
    anzahl++;
  }

  return anzahl;
}

static u8 peter_ziehen(u8 *stand, const Zug *zug) {
  Peter *p = (Peter *)stand;
  u8 actor = p->turn;
  u8 typ = zug->b[0];

  if (typ == 1) {
    /* shuffle */
    u8 n = p->hand_n[actor];
    u8 i;
    for (i = n - 1; i > 0; i--) {
      u16 j = zufall_bis(&p->rng, i + 1);
      u8 t = p->hands[actor][i];
      p->hands[actor][i] = p->hands[actor][j];
      p->hands[actor][j] = t;
    }
    p->shuffled_this_turn = 1;
    return KLANG_KARTE;
  }

  if (typ == 0) {
    /* draw */
    u8 src = source_of(p);
    u8 idx = zug->b[1];
    u8 card, pos, i, match_idx = KEIN, rem, s;

    if (src == KEIN || idx >= p->hand_n[src]) return KLANG_KLICK;
    card = p->hands[src][idx];

    /* Karte aus source entfernen */
    for (i = idx; i + 1 < p->hand_n[src]; i++) {
      p->hands[src][i] = p->hands[src][i + 1];
    }
    p->hand_n[src]--;

    /* An zufälliger Stelle in actor-Hand einfügen */
    pos = zufall_bis(&p->rng, p->hand_n[actor] + 1);
    for (i = p->hand_n[actor]; i > pos; i--) {
      p->hands[actor][i] = p->hands[actor][i - 1];
    }
    p->hands[actor][pos] = card;
    p->hand_n[actor]++;

    /* Paar prüfen */
    if (card != PETER_KARTE) {
      for (i = 0; i < p->hand_n[actor]; i++) {
        if (i != pos && p->hands[actor][i] != PETER_KARTE && (p->hands[actor][i] / 2 == card / 2)) {
          match_idx = i;
          break;
        }
      }
      if (match_idx != KEIN) {
        /* Paar ablegen */
        u8 first = (pos < match_idx) ? pos : match_idx;
        u8 second = (pos < match_idx) ? match_idx : pos;

        p->discarded_pair[p->discarded_n] = card / 2;
        p->discarded_seat[p->discarded_n] = actor;
        p->discarded_n++;

        /* Zweite Karte zuerst entfernen, dann erste */
        for (i = second; i + 1 < p->hand_n[actor]; i++) {
          p->hands[actor][i] = p->hands[actor][i + 1];
        }
        p->hand_n[actor]--;
        for (i = first; i + 1 < p->hand_n[actor]; i++) {
          p->hands[actor][i] = p->hands[actor][i + 1];
        }
        p->hand_n[actor]--;
      }
    }

    p->shuffled_this_turn = 0;

    /* Prüfen, ob Spiel vorbei ist (remaining <= 1) */
    rem = 0;
    for (s = 0; s < p->seats; s++) rem += p->hand_n[s];
    if (rem <= 1) {
      for (s = 0; s < p->seats; s++) {
        if (p->hand_n[s] > 0) {
          p->loser = s;
          break;
        }
      }
      return KLANG_SIEG;
    }

    /* Weiter bei source, falls er noch Karten hat, sonst next */
    p->turn = (p->hand_n[src] > 0) ? src : next_with_cards(p, src);
    if (p->turn == KEIN) p->turn = src;

    return (match_idx != KEIN) ? KLANG_SETZEN : KLANG_KARTE;
  }

  return KLANG_KLICK;
}

static u8 peter_ergebnis(const u8 *stand, u8 *sieger) {
  const Peter *p = (const Peter *)stand;
  u8 s;
  if (p->loser != KEIN) {
    *sieger = 0;
    for (s = 0; s < p->seats; s++) {
      if (s != p->loser) *sieger |= (1 << s);
    }
    return ERGEBNIS_SIEG;
  }
  return ERGEBNIS_LAEUFT;
}

/* ------------------------------------------------------------------ Bot */

static void peter_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Peter *p = (const Peter *)stand;
  u16 anzahl = peter_zuege(stand, zugliste);
  u8 has_peter = 0, i;
  u16 shuffle_chance;

  if (anzahl == 0) return;
  if (anzahl == 1) {
    *zug = zugliste[0];
    return;
  }

  for (i = 0; i < p->hand_n[p->turn]; i++) {
    if (p->hands[p->turn][i] == PETER_KARTE) has_peter = 1;
  }

  if (stufe == STUFE_SCHWER) shuffle_chance = has_peter ? 90 : 40;
  else if (stufe == STUFE_MITTEL) shuffle_chance = has_peter ? 60 : 25;
  else shuffle_chance = has_peter ? 20 : 10;

  for (i = 0; i < anzahl; i++) {
    if (zugliste[i].b[0] == 1) { /* shuffle */
      if (zufall_bis(z, 100) < shuffle_chance) {
        *zug = zugliste[i];
        return;
      }
    }
  }

  /* Sonst zufällig ziehen */
  {
    u8 draw_count = 0;
    u16 target;
    for (i = 0; i < anzahl; i++) {
      if (zugliste[i].b[0] == 0) draw_count++;
    }
    if (draw_count > 0) {
      target = zufall_bis(z, draw_count);
      for (i = 0; i < anzahl; i++) {
        if (zugliste[i].b[0] == 0) {
          if (target == 0) {
            *zug = zugliste[i];
            return;
          }
          target--;
        }
      }
    }
  }

  *zug = zugliste[0];
}

/* ------------------------------------------------------------------ Prüfmodus */

static u16 peter_ausgeben(const u8 *stand, u8 *puffer) {
  const Peter *p = (const Peter *)stand;
  u16 pos = 0;
  u8 s, i;

  puffer[pos++] = p->seats;
  puffer[pos++] = p->turn;
  puffer[pos++] = p->loser;
  puffer[pos++] = p->shuffled_this_turn;

  puffer[pos++] = p->discarded_n;
  for (i = 0; i < p->discarded_n; i++) {
    puffer[pos++] = p->discarded_seat[i];
    puffer[pos++] = p->discarded_pair[i];
  }

  for (s = 0; s < p->seats; s++) {
    puffer[pos++] = p->hand_n[s];
    for (i = 0; i < p->hand_n[s]; i++) puffer[pos++] = p->hands[s][i];
  }

  for (i = 0; i < 4; i++) {
    u32 v = p->rng.s[i];
    puffer[pos++] = (u8)(v & 0xff);
    puffer[pos++] = (u8)((v >> 8) & 0xff);
    puffer[pos++] = (u8)((v >> 16) & 0xff);
    puffer[pos++] = (u8)((v >> 24) & 0xff);
  }

  return pos;
}

/* ------------------------------------------------------------------ Oberfläche */

static void peter_gitter(const u8 *stand, u8 *breite, u8 *hoehe) {
  const Peter *p = (const Peter *)stand;
  u8 src = source_of(p);
  u8 sn = (src != KEIN) ? p->hand_n[src] : 1;
  *breite = (sn > 7) ? sn : 7;
  *hoehe = 3;
}

static u8 peter_feld_an(const u8 *stand, u8 x, u8 y) {
  const Peter *p = (const Peter *)stand;
  u8 src = source_of(p);
  if (y == 0 && src != KEIN) {
    if (x < p->hand_n[src]) return x; /* verdeckte Karte vom Nachbarn ziehen */
  }
  if (y == 1 && x == 0 && !p->shuffled_this_turn && p->hand_n[p->turn] > 1) {
    return 100; /* Mischen */
  }
  return FELD_KEIN;
}

static u8 peter_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  (void)stand;
  if (zug->b[0] == 0) {
    felder[0] = zug->b[1];
    return 1;
  }
  if (zug->b[0] == 1) {
    felder[0] = 100;
    return 1;
  }
  return 0;
}

static void peter_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Peter *p = (const Peter *)stand;
  u8 src = source_of(p);
  u8 i, x, y;
  (void)aktiv;

  flaeche_leeren(0, 0, 32, 28);

  /* Nachbar oben, bei dem man zieht */
  if (src != KEIN) {
    text(2, 2, "Vom Nachbarn ziehen:", PAL_TEXT);
    for (i = 0; i < p->hand_n[src]; i++) {
      u8 pal = (markierung[i] & (MARK_GEWAEHLT | MARK_CURSOR)) ? PAL_BRETT_AUSWAHL : PAL_BRETT;
      x = 2 + i * 3;
      y = 4;
      if (x + 3 <= 31) {
        karten_koerper(x, y, KARTEN_RUECKEN, pal);
      }
    }
  }

  /* Mischen-Button */
  if (!p->shuffled_this_turn && p->hand_n[p->turn] > 1) {
    u8 pal = (markierung[100] & MARK_CURSOR) ? PAL_GELB : PAL_TEXT;
    text(2, 10, "[MISCHEN]", pal);
  }

  /* Abgelegte Paare */
  text(18, 10, "Paare:", PAL_TEXT);
  zahl(25, 10, p->discarded_n, 2, PAL_GELB);

  /* Eigene Handkarten unten */
  text(2, 18, "Deine Hand:", PAL_TEXT);
  for (i = 0; i < p->hand_n[0]; i++) {
    x = 2 + i * 3;
    y = 20;
    if (x + 3 <= 31) {
      u8 c = p->hands[0][i];
      if (c == PETER_KARTE) {
        karten_koerper(x, y, KARTEN_BLANKO, PAL_BRETT);
        text(x + 1, y + 1, "P", PAL_ROT);
      } else {
        u8 pair = c / 2;
        karten_zahl(x, y, pair % 4, pair + 1, 1, PAL_BRETT);
      }
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const ANLEITUNG[] = {
  "Paare werden sofort abgelegt.",
  "Ziehe eine verdeckte Karte vom Nachbarn.",
  "Bildet sie ein Paar, lege es ab.",
  "Wer keine Karten mehr hat, ist fertig.",
  "Wer den Schwarzen Peter behaelt, verliert!",
  0
};

static const char *const OPT_PAIRS[] = {"8 Paare", "12 Paare", "16 Paare"};

static const Option OPTIONEN[] = {
  {"Paare", OPT_PAIRS, 3, 1},
};

static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_GRAU};

const Spiel spiel_peter = {
  "Schwarzer Peter",
  ANLEITUNG,
  "A Karte waehlen",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2, 4,
  1, /* verdeckt */
  OPTIONEN,
  1,
  FARBEN_KARTEN,
  peter_aufbauen,
  peter_am_zug,
  peter_zuege,
  peter_ziehen,
  peter_ergebnis,
  peter_bot,
  peter_ausgeben,
  peter_gitter,
  peter_feld_an,
  peter_felder,
  peter_zeichnen,
  0, 0,
};
