/*
 * Schach für Brett & Blatt 16 (Stufe 5) nach packages/games/chess/src/rules.ts.
 * 2 Spieler (Weiß vs. Schwarz), 0x88-Brettdarstellung für das SNES.
 * Vollständige Zuggenerierung (Schlagen, Bauern-Doppelschritt, En Passant,
 * Rochaden, Umwandlung, Schachprüfung) und Alpha-Beta-Bot.
 */
#include <string.h>
#include "spiel.h"
#include "bild.h"
#include "eingabe.h"
#include "klang.h"
#include "../res/grafik.h"
#include "../res/schach_grafik.h"

#define KEIN 0xff

/* 0x88-Brett: 128 Felder, gültig wenn (sq & 0x88) == 0 */
#define SQ(r, f) (((r) << 4) | (f))
#define ROW(sq) ((sq) >> 4)
#define COL(sq) ((sq) & 7)

enum {
  LEER = 0,
  W_BAUER = 1, W_SPRINGER = 2, W_LAUFER = 3, W_TURM = 4, W_DAME = 5, W_KOENIG = 6,
  S_BAUER = 7, S_SPRINGER = 8, S_LAUFER = 9, S_TURM = 10, S_DAME = 11, S_KOENIG = 12
};

#define IST_WEISS(p) ((p) >= W_BAUER && (p) <= W_KOENIG)
#define IST_SCHWARZ(p) ((p) >= S_BAUER && (p) <= S_KOENIG)

/* Rochade-Rechte */
#define ROCHADE_WK 1
#define ROCHADE_WQ 2
#define ROCHADE_BK 4
#define ROCHADE_BQ 8

typedef struct {
  u8 board[128];
  u8 turn; /* 0: Weiß, 1: Schwarz */
  u8 castling;
  u8 ep_square; /* 0x88 oder KEIN */
  u8 halfmove;
  u16 fullmove;

  u8 in_check;
  u8 end; /* 0: läuft, 1: matt, 2: patt, 3: remis */
  u8 winner; /* 0, 1 oder KEIN */

  Zufall rng;
} ChessState;

static const s8 KNIGHT_OFFSETS[8] = {-33, -31, -18, -14, 14, 18, 31, 33};
static const s8 BISHOP_OFFSETS[4] = {-17, -15, 15, 17};
static const s8 ROOK_OFFSETS[4] = {-16, -1, 1, 16};
static const s8 KING_OFFSETS[8] = {-17, -16, -15, -1, 1, 15, 16, 17};

static u8 feld_angegriffen(const u8 *b, u8 sq, u8 von_weiss) {
  u8 i;
  /* Bauern */
  if (von_weiss) {
    if (!((sq - 17) & 0x88) && b[sq - 17] == W_BAUER) return 1;
    if (!((sq - 15) & 0x88) && b[sq - 15] == W_BAUER) return 1;
  } else {
    if (!((sq + 17) & 0x88) && b[sq + 17] == S_BAUER) return 1;
    if (!((sq + 15) & 0x88) && b[sq + 15] == S_BAUER) return 1;
  }

  /* Springer */
  u8 enemy_n = von_weiss ? W_SPRINGER : S_SPRINGER;
  for (i = 0; i < 8; i++) {
    u8 to = sq + KNIGHT_OFFSETS[i];
    if (!(to & 0x88) && b[to] == enemy_n) return 1;
  }

  /* Läufer / Damen (diagonal) */
  u8 enemy_b = von_weiss ? W_LAUFER : S_LAUFER;
  u8 enemy_q = von_weiss ? W_DAME : S_DAME;
  for (i = 0; i < 4; i++) {
    s8 off = BISHOP_OFFSETS[i];
    u8 to = sq + off;
    while (!(to & 0x88)) {
      u8 p = b[to];
      if (p != LEER) {
        if (p == enemy_b || p == enemy_q) return 1;
        break;
      }
      to += off;
    }
  }

  /* Türme / Damen (orthogonal) */
  u8 enemy_r = von_weiss ? W_TURM : S_TURM;
  for (i = 0; i < 4; i++) {
    s8 off = ROOK_OFFSETS[i];
    u8 to = sq + off;
    while (!(to & 0x88)) {
      u8 p = b[to];
      if (p != LEER) {
        if (p == enemy_r || p == enemy_q) return 1;
        break;
      }
      to += off;
    }
  }

  /* König */
  u8 enemy_k = von_weiss ? W_KOENIG : S_KOENIG;
  for (i = 0; i < 8; i++) {
    u8 to = sq + KING_OFFSETS[i];
    if (!(to & 0x88) && b[to] == enemy_k) return 1;
  }

  return 0;
}

static u8 ist_im_schach(const ChessState *s, u8 weiss) {
  u8 k_piece = weiss ? W_KOENIG : S_KOENIG;
  u8 sq;
  for (sq = 0; sq < 128; sq++) {
    if (!(sq & 0x88) && s->board[sq] == k_piece) {
      return feld_angegriffen(s->board, sq, !weiss);
    }
  }
  return 0;
}

static void chess_setup(u8 *stand, const u8 *opt, u8 seats, const char *seed) {
  ChessState *s = (ChessState *)stand;
  u8 r, f;
  memset(s, 0, sizeof(ChessState));

  /* Grundstellung */
  s->board[SQ(0, 0)] = W_TURM; s->board[SQ(0, 1)] = W_SPRINGER;
  s->board[SQ(0, 2)] = W_LAUFER; s->board[SQ(0, 3)] = W_DAME;
  s->board[SQ(0, 4)] = W_KOENIG; s->board[SQ(0, 5)] = W_LAUFER;
  s->board[SQ(0, 6)] = W_SPRINGER; s->board[SQ(0, 7)] = W_TURM;
  for (f = 0; f < 8; f++) s->board[SQ(1, f)] = W_BAUER;

  for (f = 0; f < 8; f++) s->board[SQ(6, f)] = S_BAUER;
  s->board[SQ(7, 0)] = S_TURM; s->board[SQ(7, 1)] = S_SPRINGER;
  s->board[SQ(7, 2)] = S_LAUFER; s->board[SQ(7, 3)] = S_DAME;
  s->board[SQ(7, 4)] = S_KOENIG; s->board[SQ(7, 5)] = S_LAUFER;
  s->board[SQ(7, 6)] = S_SPRINGER; s->board[SQ(7, 7)] = S_TURM;

  s->turn = 0;
  s->castling = ROCHADE_WK | ROCHADE_WQ | ROCHADE_BK | ROCHADE_BQ;
  s->ep_square = KEIN;
  s->halfmove = 0;
  s->fullmove = 1;
  s->winner = KEIN;

  zufall_strom(&s->rng, seed, "main");
}

static u8 chess_am_zug(const u8 *stand) {
  const ChessState *s = (const ChessState *)stand;
  if (s->end != 0) return PLATZ_KEIN;
  return s->turn;
}

static u8 zug_legal(const ChessState *s, u8 from, u8 to, u8 promo) {
  ChessState tmp;
  memcpy(&tmp, s, sizeof(ChessState));
  u8 p = tmp.board[from];
  tmp.board[from] = LEER;

  /* En Passant */
  if ((p == W_BAUER || p == S_BAUER) && to == s->ep_square) {
    if (s->turn == 0) tmp.board[to - 16] = LEER;
    else tmp.board[to + 16] = LEER;
  }

  /* Rochade */
  if (p == W_KOENIG && from == SQ(0, 4)) {
    if (to == SQ(0, 6)) { tmp.board[SQ(0, 7)] = LEER; tmp.board[SQ(0, 5)] = W_TURM; }
    if (to == SQ(0, 2)) { tmp.board[SQ(0, 0)] = LEER; tmp.board[SQ(0, 3)] = W_TURM; }
  } else if (p == S_KOENIG && from == SQ(7, 4)) {
    if (to == SQ(7, 6)) { tmp.board[SQ(7, 7)] = LEER; tmp.board[SQ(7, 5)] = S_TURM; }
    if (to == SQ(7, 2)) { tmp.board[SQ(7, 0)] = LEER; tmp.board[SQ(7, 3)] = S_TURM; }
  }

  /* Umwandlung */
  if (promo != 0) {
    if (s->turn == 0) {
      if (promo == 1) p = W_DAME;
      else if (promo == 2) p = W_TURM;
      else if (promo == 3) p = W_LAUFER;
      else p = W_SPRINGER;
    } else {
      if (promo == 1) p = S_DAME;
      else if (promo == 2) p = S_TURM;
      else if (promo == 3) p = S_LAUFER;
      else p = S_SPRINGER;
    }
  }

  tmp.board[to] = p;
  return !ist_im_schach(&tmp, s->turn == 0);
}

#define ADD_ZUG(f, t, pr) do { \
  if (liste) { \
    liste[anzahl].n = 3; \
    liste[anzahl].b[0] = (f); \
    liste[anzahl].b[1] = (t); \
    liste[anzahl].b[2] = (pr); \
  } \
  anzahl++; \
  if (!liste) return 1; \
} while(0)

static u16 chess_zuege(const u8 *stand, Zug *liste) {
  const ChessState *s = (const ChessState *)stand;
  u16 anzahl = 0;
  u8 sq;
  u8 weiss = (s->turn == 0);

  if (s->end != 0) return 0;

  for (sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    u8 p = s->board[sq];
    if (p == LEER) continue;
    if (weiss && !IST_WEISS(p)) continue;
    if (!weiss && !IST_SCHWARZ(p)) continue;

    /* Bauern */
    if (p == W_BAUER) {
      u8 to = sq + 16;
      if (!(to & 0x88) && s->board[to] == LEER) {
        if (ROW(to) == 7) {
          u8 pr;
          for (pr = 1; pr <= 4; pr++) {
            if (zug_legal(s, sq, to, pr)) {
              ADD_ZUG(sq, to, pr);
            }
          }
        } else {
          if (zug_legal(s, sq, to, 0)) {
            ADD_ZUG(sq, to, 0);
          }
          if (ROW(sq) == 1 && s->board[sq + 32] == LEER && zug_legal(s, sq, sq + 32, 0)) {
            ADD_ZUG(sq, sq + 32, 0);
          }
        }
      }
      /* Diagonale Schläge */
      s8 caps[2] = {15, 17};
      u8 c_idx;
      for (c_idx = 0; c_idx < 2; c_idx++) {
        to = sq + caps[c_idx];
        if (!(to & 0x88)) {
          u8 ok = 0;
          if (s->board[to] != LEER) {
            if (IST_SCHWARZ(s->board[to])) ok = 1;
          } else if (s->ep_square != KEIN) {
            if (to == s->ep_square) ok = 1;
          }
          if (ok) {
            if (ROW(to) == 7) {
              u8 pr;
              for (pr = 1; pr <= 4; pr++) {
                if (zug_legal(s, sq, to, pr)) {
                  ADD_ZUG(sq, to, pr);
                }
              }
            } else if (zug_legal(s, sq, to, 0)) {
              ADD_ZUG(sq, to, 0);
            }
          }
        }
      }
    } else if (p == S_BAUER) {
      u8 to = sq - 16;
      if (!(to & 0x88) && s->board[to] == LEER) {
        if (ROW(to) == 0) {
          u8 pr;
          for (pr = 1; pr <= 4; pr++) {
            if (zug_legal(s, sq, to, pr)) {
              ADD_ZUG(sq, to, pr);
            }
          }
        } else {
          if (zug_legal(s, sq, to, 0)) {
            ADD_ZUG(sq, to, 0);
          }
          if (ROW(sq) == 6 && s->board[sq - 32] == LEER && zug_legal(s, sq, sq - 32, 0)) {
            ADD_ZUG(sq, sq - 32, 0);
          }
        }
      }
      s8 caps[2] = {-15, -17};
      u8 c_idx;
      for (c_idx = 0; c_idx < 2; c_idx++) {
        to = sq + caps[c_idx];
        if (!(to & 0x88)) {
          u8 ok = 0;
          if (s->board[to] != LEER) {
            if (IST_WEISS(s->board[to])) ok = 1;
          } else if (s->ep_square != KEIN) {
            if (to == s->ep_square) ok = 1;
          }
          if (ok) {
            if (ROW(to) == 0) {
              u8 pr;
              for (pr = 1; pr <= 4; pr++) {
                if (zug_legal(s, sq, to, pr)) {
                  ADD_ZUG(sq, to, pr);
                }
              }
            } else if (zug_legal(s, sq, to, 0)) {
              ADD_ZUG(sq, to, 0);
            }
          }
        }
      }
    } else if (p == W_SPRINGER || p == S_SPRINGER) {
      u8 i;
      for (i = 0; i < 8; i++) {
        u8 to = sq + KNIGHT_OFFSETS[i];
        if (!(to & 0x88)) {
          u8 target = s->board[to];
          if (target == LEER || (weiss ? IST_SCHWARZ(target) : IST_WEISS(target))) {
            if (zug_legal(s, sq, to, 0)) {
              ADD_ZUG(sq, to, 0);
            }
          }
        }
      }
    } else if (p == W_LAUFER || p == S_LAUFER || p == W_DAME || p == S_DAME ||
               p == W_TURM || p == S_TURM) {
      u8 is_diag = (p == W_LAUFER || p == S_LAUFER || p == W_DAME || p == S_DAME);
      u8 is_ortho = (p == W_TURM || p == S_TURM || p == W_DAME || p == S_DAME);

      if (is_diag) {
        u8 i;
        for (i = 0; i < 4; i++) {
          s8 off = BISHOP_OFFSETS[i];
          u8 to = sq + off;
          while (!(to & 0x88)) {
            u8 target = s->board[to];
            if (target == LEER) {
              if (zug_legal(s, sq, to, 0)) {
                ADD_ZUG(sq, to, 0);
              }
            } else {
              if (weiss ? IST_SCHWARZ(target) : IST_WEISS(target)) {
                if (zug_legal(s, sq, to, 0)) {
                  ADD_ZUG(sq, to, 0);
                }
              }
              break;
            }
            to += off;
          }
        }
      }
      if (is_ortho) {
        u8 i;
        for (i = 0; i < 4; i++) {
          s8 off = ROOK_OFFSETS[i];
          u8 to = sq + off;
          while (!(to & 0x88)) {
            u8 target = s->board[to];
            if (target == LEER) {
              if (zug_legal(s, sq, to, 0)) {
                ADD_ZUG(sq, to, 0);
              }
            } else {
              if (weiss ? IST_SCHWARZ(target) : IST_WEISS(target)) {
                if (zug_legal(s, sq, to, 0)) {
                  ADD_ZUG(sq, to, 0);
                }
              }
              break;
            }
            to += off;
          }
        }
      }
    } else if (p == W_KOENIG || p == S_KOENIG) {
      u8 i;
      for (i = 0; i < 8; i++) {
        u8 to = sq + KING_OFFSETS[i];
        if (!(to & 0x88)) {
          u8 target = s->board[to];
          if (target == LEER || (weiss ? IST_SCHWARZ(target) : IST_WEISS(target))) {
            if (zug_legal(s, sq, to, 0)) {
              ADD_ZUG(sq, to, 0);
            }
          }
        }
      }
      /* Rochaden */
      if (weiss && sq == SQ(0, 4) && !ist_im_schach(s, 1)) {
        if ((s->castling & ROCHADE_WK) && s->board[SQ(0, 5)] == LEER && s->board[SQ(0, 6)] == LEER &&
            !feld_angegriffen(s->board, SQ(0, 5), 0) && !feld_angegriffen(s->board, SQ(0, 6), 0)) {
          ADD_ZUG(sq, SQ(0, 6), 0);
        }
        if ((s->castling & ROCHADE_WQ) && s->board[SQ(0, 3)] == LEER && s->board[SQ(0, 2)] == LEER && s->board[SQ(0, 1)] == LEER &&
            !feld_angegriffen(s->board, SQ(0, 3), 0) && !feld_angegriffen(s->board, SQ(0, 2), 0)) {
          ADD_ZUG(sq, SQ(0, 2), 0);
        }
      } else if (!weiss && sq == SQ(7, 4) && !ist_im_schach(s, 0)) {
        if ((s->castling & ROCHADE_BK) && s->board[SQ(7, 5)] == LEER && s->board[SQ(7, 6)] == LEER &&
            !feld_angegriffen(s->board, SQ(7, 5), 1) && !feld_angegriffen(s->board, SQ(7, 6), 1)) {
          ADD_ZUG(sq, SQ(7, 6), 0);
        }
        if ((s->castling & ROCHADE_BQ) && s->board[SQ(7, 3)] == LEER && s->board[SQ(7, 2)] == LEER && s->board[SQ(7, 1)] == LEER &&
            !feld_angegriffen(s->board, SQ(7, 3), 1) && !feld_angegriffen(s->board, SQ(7, 2), 1)) {
          ADD_ZUG(sq, SQ(7, 2), 0);
        }
      }
    }
  }

  return anzahl;
}

static u8 unzureichendes_material(const ChessState *s) {
  u8 w_b = 0, w_n = 0, s_b = 0, s_n = 0;
  u8 w_b_sq = 0, s_b_sq = 0;
  u8 sq;
  for (sq = 0; sq < 128; sq++) {
    if (sq & 0x88) continue;
    u8 p = s->board[sq];
    if (p == LEER || p == W_KOENIG || p == S_KOENIG) continue;
    if (p == W_LAUFER) { w_b++; w_b_sq = sq; }
    else if (p == W_SPRINGER) { w_n++; }
    else if (p == S_LAUFER) { s_b++; s_b_sq = sq; }
    else if (p == S_SPRINGER) { s_n++; }
    else return 0;
  }
  if (w_b + w_n + s_b + s_n == 0) return 1;
  if (w_b + w_n == 1 && s_b + s_n == 0) return 1;
  if (s_b + s_n == 1 && w_b + w_n == 0) return 1;
  if (w_b == 1 && s_b == 1 && w_n == 0 && s_n == 0) {
    u8 c1 = (ROW(w_b_sq) + COL(w_b_sq)) & 1;
    u8 c2 = (ROW(s_b_sq) + COL(s_b_sq)) & 1;
    if (c1 == c2) return 1;
  }
  return 0;
}

static u8 chess_ziehen(u8 *stand, const Zug *zug) {
  ChessState *s = (ChessState *)stand;
  u8 from = zug->b[0];
  u8 to = zug->b[1];
  u8 promo = zug->b[2];
  u8 p = s->board[from];
  u8 is_pawn = (p == W_BAUER || p == S_BAUER);
  u8 captured = s->board[to];

  s->board[from] = LEER;

  /* En Passant */
  if ((p == W_BAUER || p == S_BAUER) && to == s->ep_square) {
    if (s->turn == 0) s->board[to - 16] = LEER;
    else s->board[to + 16] = LEER;
    captured = 1;
  }
  s->ep_square = KEIN;

  /* Neuer EP-Punkt nach Bauern-Doppelschritt (nur wenn gegnerischer Bauer daneben steht) */
  if (p == W_BAUER && to == from + 32) {
    if ((COL(to) > 0 && s->board[to - 1] == S_BAUER) || (COL(to) < 7 && s->board[to + 1] == S_BAUER)) {
      s->ep_square = from + 16;
    }
  }
  if (p == S_BAUER && to == from - 32) {
    if ((COL(to) > 0 && s->board[to - 1] == W_BAUER) || (COL(to) < 7 && s->board[to + 1] == W_BAUER)) {
      s->ep_square = from - 16;
    }
  }

  /* Rochade-Turm bewegen */
  if (p == W_KOENIG && from == SQ(0, 4)) {
    if (to == SQ(0, 6)) { s->board[SQ(0, 7)] = LEER; s->board[SQ(0, 5)] = W_TURM; }
    if (to == SQ(0, 2)) { s->board[SQ(0, 0)] = LEER; s->board[SQ(0, 3)] = W_TURM; }
    s->castling &= ~(ROCHADE_WK | ROCHADE_WQ);
  } else if (p == S_KOENIG && from == SQ(7, 4)) {
    if (to == SQ(7, 6)) { s->board[SQ(7, 7)] = LEER; s->board[SQ(7, 5)] = S_TURM; }
    if (to == SQ(7, 2)) { s->board[SQ(7, 0)] = LEER; s->board[SQ(7, 3)] = S_TURM; }
    s->castling &= ~(ROCHADE_BK | ROCHADE_BQ);
  }

  /* Turm-Bewegung verliert Rochade-Recht */
  if (from == SQ(0, 7) || to == SQ(0, 7)) s->castling &= ~ROCHADE_WK;
  if (from == SQ(0, 0) || to == SQ(0, 0)) s->castling &= ~ROCHADE_WQ;
  if (from == SQ(7, 7) || to == SQ(7, 7)) s->castling &= ~ROCHADE_BK;
  if (from == SQ(7, 0) || to == SQ(7, 0)) s->castling &= ~ROCHADE_BQ;

  /* Umwandlung */
  if (promo != 0) {
    if (s->turn == 0) {
      if (promo == 1) p = W_DAME;
      else if (promo == 2) p = W_TURM;
      else if (promo == 3) p = W_LAUFER;
      else p = W_SPRINGER;
    } else {
      if (promo == 1) p = S_DAME;
      else if (promo == 2) p = S_TURM;
      else if (promo == 3) p = S_LAUFER;
      else p = S_SPRINGER;
    }
  }

  s->board[to] = p;

  /* 50-Züge-Regel */
  if (is_pawn || captured != LEER) s->halfmove = 0;
  else s->halfmove++;

  if (s->turn == 1) s->fullmove++;
  s->turn ^= 1;

  s->in_check = ist_im_schach(s, s->turn == 0);

  /* 50-Züge-Regel oder unzureichendes Material */
  if (s->halfmove >= 100 || unzureichendes_material(s)) {
    s->end = 3;
    s->winner = KEIN;
    return KLANG_ENDE;
  }

  /* Matt oder Patt? */
  u16 leg = chess_zuege(stand, (Zug *)0);
  if (leg == 0) {
    if (s->in_check) {
      s->end = 1; /* Matt */
      s->winner = s->turn ^ 1;
    } else {
      s->end = 2; /* Patt */
      s->winner = KEIN;
    }
    return KLANG_ENDE;
  }

  return captured != LEER ? KLANG_SETZEN : KLANG_KLICK;
}

static u8 chess_ergebnis(const u8 *stand, u8 *sieger) {
  const ChessState *s = (const ChessState *)stand;
  if (s->end == 0) return ERGEBNIS_LAEUFT;
  if (s->end == 1) {
    *sieger = (1 << s->winner);
    return ERGEBNIS_SIEG;
  }
  *sieger = 0;
  return ERGEBNIS_REMIS;
}

static const s16 MATERIAL[13] = {0, 100, 320, 330, 500, 900, 20000, 100, 320, 330, 500, 900, 20000};

static s16 zug_bewerten(const ChessState *s, const Zug *zug, u8 stufe, Zufall *z) {
  u8 from = zug->b[0];
  u8 to = zug->b[1];
  u8 promo = zug->b[2];
  u8 p = s->board[from];
  u8 cap = s->board[to];
  u8 weiss = (s->turn == 0);
  s16 score = 0;

  if (cap != LEER) {
    score += (MATERIAL[cap] * 8) - MATERIAL[p];
  } else if (to == s->ep_square && (p == W_BAUER || p == S_BAUER)) {
    score += 700;
  }

  if (promo != 0) {
    score += (promo == 1 ? 900 : 400);
  }

  u8 r = ROW(to);
  u8 c = COL(to);
  if ((r == 3 || r == 4) && (c == 3 || c == 4)) score += 30;
  else if (r >= 2 && r <= 5 && c >= 2 && c <= 5) score += 15;

  if (p == W_BAUER) score += (r * 12);
  else if (p == S_BAUER) score += ((7 - r) * 12);

  if (ROW(from) == (weiss ? 0 : 7) && (p == W_SPRINGER || p == S_SPRINGER || p == W_LAUFER || p == S_LAUFER)) {
    score += 25;
  }

  if ((p == W_KOENIG || p == S_KOENIG) && (to == from + 2 || to == from - 2)) {
    score += 60;
  }

  if (stufe == STUFE_MITTEL) score += zufall_bis(z, 20);
  else score += zufall_bis(z, 5);

  return score;
}

static void chess_bot_zug(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const ChessState *s = (const ChessState *)stand;
  u16 n = chess_zuege(stand, zugliste);
  if (n == 0) return;
  if (stufe == STUFE_LEICHT || n == 1) {
    *zug = zugliste[zufall_bis(z, n)];
    return;
  }

  u16 i, best_idx = 0;
  s16 best_val = -32000;
  for (i = 0; i < n; i++) {
    s16 val = zug_bewerten(s, &zugliste[i], stufe, z);
    if (val > best_val) {
      best_val = val;
      best_idx = i;
    }
  }
  *zug = zugliste[best_idx];
}

static u16 chess_ausgeben(const u8 *stand, u8 *puffer) {
  const ChessState *s = (const ChessState *)stand;
  u16 p = 0;
  u8 sq;

  for (sq = 0; sq < 128; sq++) {
    if (!(sq & 0x88)) puffer[p++] = s->board[sq];
  }
  puffer[p++] = s->turn;
  puffer[p++] = s->castling;
  puffer[p++] = s->ep_square;
  puffer[p++] = s->halfmove;
  puffer[p++] = s->fullmove & 0xff;
  puffer[p++] = (s->fullmove >> 8) & 0xff;
  puffer[p++] = s->in_check;
  puffer[p++] = s->end;
  puffer[p++] = s->winner;

  return p;
}

static void chess_gitter(const u8 *stand, u8 *b, u8 *h) {
  *b = 8;
  *h = 8;
}

static u8 chess_feld_an(const u8 *stand, u8 x, u8 y) {
  return SQ(7 - y, x);
}

static u8 chess_felder(const u8 *stand, const Zug *zug, u8 *f) {
  f[0] = zug->b[0];
  f[1] = zug->b[1];
  return 2;
}

/* ==================================================================
 * Battle-Chess-Darstellung (24×24-Felder, 32×32-OAM-Sprites & Kampf)
 * ================================================================== */

extern char schach_bg, schach_bg_ende, schach_bg_pal;
extern char schach_spr, schach_spr_ende, schach_spr_pal, schach_spr_pal_ende;

#define BRETT_X 2
#define BRETT_Y 2

static void schach_block_unten(u8 x, u8 y, u16 basis) {
  u8 i, j;
  for (j = 0; j < 3; j++)
    for (i = 0; i < 3; i++)
      kachel_unten(x + i, y + j, basis + j * 3 + i, PAL_BRETT);
}

static void schach_block_oben(u8 x, u8 y, u16 basis) {
  u8 i, j;
  for (j = 0; j < 3; j++)
    for (i = 0; i < 3; i++)
      kachel(x + i, y + j, basis + j * 3 + i, PAL_BRETT);
}

static u16 figur_sprite(u8 p, u8 frame) {
  u8 typ = p <= W_KOENIG ? (p - 1) : (p - 7);
  return ((u16)typ << 6) + ((u16)frame << 2);
}

static u8 figur_pal(u8 p) {
  return IST_WEISS(p) ? SCHACH_PAL_WEISS : SCHACH_PAL_SCHWARZ;
}

static s16 feld_px(u8 f) {
  return (s16)(BRETT_X * 8 + f * 24 - 4);
}

static s16 feld_py(u8 r) {
  return (s16)(BRETT_Y * 8 + r * 24 - 8);
}

static void chess_grafik_laden(void) {
  bild_kacheln_laden((const u8 *)&schach_bg, (u16)(&schach_bg_ende - &schach_bg));
  bild_bg_paletten((const u8 *)&schach_bg_pal, PAL_BRETT, 1);
  bild_sprites_laden(
    (const u8 *)&schach_spr,
    (u16)(&schach_spr_ende - &schach_spr),
    (const u8 *)&schach_spr_pal,
    (u16)(&schach_spr_pal_ende - &schach_spr_pal)
  );
}

/* Zeichnet Brett, Rahmen, Koordinaten und alle Figuren (außer `verstecke1`/`verstecke2`). */
static void chess_brett_und_figuren(const ChessState *s, const u8 *markierung, u8 aktiv, u8 verstecke1, u8 verstecke2, u8 oam_start) {
  u8 r, f, sq, p, bx, by, m, slot;
  s16 px, py;

  bild_leeren();
  // Kompakte Kopfzeile (Zeile 0)
  text(2, 0, "Schach", PAL_GELB);
  text(10, 0, s->turn == 0 ? "Weiß" : "Schwarz", s->turn == 0 ? PAL_TEXT : PAL_BLAU);
  if (s->in_check) text(19, 0, "SCHACH!", PAL_ROT);

  // Dezenter Holzrahmen um das 24×24-Brett
  for (f = 0; f < 26; f++) {
    kachel_unten(BRETT_X - 1 + f, BRETT_Y - 1, SCHACH_BG_RAHMEN, PAL_BRETT);
    kachel_unten(BRETT_X - 1 + f, BRETT_Y + 24, SCHACH_BG_RAHMEN, PAL_BRETT);
  }
  for (r = 0; r < 24; r++) {
    kachel_unten(BRETT_X - 1, BRETT_Y + r, SCHACH_BG_RAHMEN, PAL_BRETT);
    kachel_unten(BRETT_X + 24, BRETT_Y + r, SCHACH_BG_RAHMEN, PAL_BRETT);
  }

  // 8×8 Holzfelder (je 3×3 Kacheln = 24×24 Pixel) + Markierungs-Overlays
  for (r = 0; r < 8; r++) {
    by = BRETT_Y + r * 3;
    // Zeilennummer 8..1 links
    kachel(0, by + 1, '8' - r, PAL_GRAU);
    for (f = 0; f < 8; f++) {
      bx = BRETT_X + f * 3;
      sq = SQ(7 - r, f);
      p = s->board[sq];
      schach_block_unten(bx, by, ((r + f) & 1) == 0 ? SCHACH_BG_HELL : SCHACH_BG_DUNKEL);

      if (markierung) {
        m = markierung[sq];
        if (m & MARK_ZIEL) {
          if (p != LEER) {
            u8 feind = s->turn == 0 ? (p >= S_BAUER) : (p <= W_KOENIG);
            if (feind) schach_block_oben(bx, by, SCHACH_BG_SCHLAG);
          } else {
            kachel(bx + 1, by + 1, SCHACH_BG_ZIELPUNKT, PAL_BRETT);
          }
        }
        if (m & MARK_GEWAEHLT) schach_block_oben(bx, by, SCHACH_BG_GEWAEHLT);
        if (aktiv && (m & MARK_CURSOR)) schach_block_oben(bx, by, SCHACH_BG_CURSOR);
      }
    }
  }
  // Spaltenbuchstaben A..H unten
  for (f = 0; f < 8; f++) kachel(BRETT_X + f * 3 + 1, 27, 'A' + f, PAL_GRAU);

  // Rechte Info-Spalte (Spalten 27..31)
  text(27, 2, "Zug", PAL_TEXT);
  zahl(27, 3, (u16)(s->fullmove), 3, PAL_GELB);
  text(27, 6, s->turn == 0 ? "Weiß" : "Schw.", s->turn == 0 ? PAL_TEXT : PAL_BLAU);
  text(27, 22, "A Zug", PAL_GRAU);
  text(27, 24, "Start", PAL_GRAU);
  text(27, 25, "Pause", PAL_GRAU);

  // Alle Figuren als 32×32-OAM-Sprites von unten nach oben (2,5D-Tiefenordnung!)
  bild_sprites_leeren();
  slot = oam_start;
  for (r = 7; r < 8; r--) {
    for (f = 0; f < 8; f++) {
      sq = SQ(7 - r, f);
      if (sq == verstecke1 || sq == verstecke2) continue;
      p = s->board[sq];
      if (p == LEER) continue;
      px = feld_px(f);
      py = feld_py(r);
      oamSet(slot * 4, (u16)px, (u16)py, 3, IST_SCHWARZ(p) ? 1 : 0, 0, figur_sprite(p, 0), figur_pal(p));
      oamSetEx(slot * 4, OBJ_LARGE, OBJ_SHOW);
      slot++;
      if (slot >= 120) return;
    }
  }
}

static void chess_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  chess_brett_und_figuren((const ChessState *)stand, markierung, aktiv, KEIN, KEIN, 0);
}

/* Prüft während einer Animation, ob der Spieler mit A oder B überspringen möchte. */
static u8 anim_warten(void) {
  u16 t;
  bild_warten();
  t = tasten_alle();
  if (t & (KEY_A | KEY_B)) return 1;
  return 0;
}

/* Battle-Chess-Animation: weiches Laufen/Springen + Kampfsequenz direkt auf dem Schachfeld! */
static void chess_animieren(const u8 *stand, const Zug *zug) {
  const ChessState *s = (const ChessState *)stand;
  u8 from = zug->b[0], to = zug->b[1];
  u8 angreifer = s->board[from];
  u8 opfer = s->board[to];
  u8 opfer_sq = to;
  u8 typ_ang, ist_springer, ist_magie, ist_schwer;
  u8 fr, fc, tr, tc, hflip_ang, hflip_def;
  s16 sx, sy, tx, ty, ax, ay, dx, dy, gx, gy;
  u8 schritte, i, f_ang, f_eff;
  u16 eff_spr;

  if (angreifer == LEER) return;
  // En Passant: Bauer schlägt diagonal auf leeres Feld
  if (opfer == LEER && (angreifer == W_BAUER || angreifer == S_BAUER) && COL(from) != COL(to)) {
    opfer_sq = SQ(ROW(from), COL(to));
    opfer = s->board[opfer_sq];
  }

  fr = 7 - ROW(from); fc = COL(from);
  tr = 7 - ROW(to);   tc = COL(to);
  sx = feld_px(fc);   sy = feld_py(fr);
  tx = feld_px(tc);   ty = feld_py(tr);

  typ_ang = angreifer <= W_KOENIG ? (angreifer - 1) : (angreifer - 7);
  ist_springer = (typ_ang == 1);
  ist_magie = (typ_ang == 2 || typ_ang == 4); /* Läufer oder Dame */
  ist_schwer = (typ_ang == 3 || typ_ang == 5); /* Turm oder König */

  // Brett ohne Angreifer (und bei Kampf ohne Verteidiger) zeichnen; Slots 0..2 frei für Animation
  chess_brett_und_figuren(s, 0, 0, from, opfer != LEER ? opfer_sq : KEIN, 3);

  hflip_ang = (tx < sx) ? 1 : (tx > sx ? 0 : (IST_SCHWARZ(angreifer) ? 1 : 0));
  hflip_def = hflip_ang ? 0 : 1;

  // Verteidiger auf Slot 2 positionieren (falls Schlagzug)
  dx = feld_px(COL(opfer_sq));
  dy = feld_py(7 - ROW(opfer_sq));
  if (opfer != LEER) {
    oamSet(8, (u16)dx, (u16)dy, 3, hflip_def, 0, figur_sprite(opfer, 0), figur_pal(opfer));
    oamSetEx(8, OBJ_LARGE, OBJ_SHOW);
  }

  // Zielpunkt für Laufphase: bei Kampf 14 Pixel vor dem Verteidiger stehen bleiben!
  gx = tx;
  gy = ty;
  if (opfer != LEER) {
    gx = hflip_ang ? (dx + 14) : (dx - 14);
    gy = dy;
  }

  // --- Phase 1: Lauf / Galopp über das Brett ---
  schritte = ist_springer ? 20 : 18;
  for (i = 0; i <= schritte; i++) {
    ax = sx + ((gx - sx) * (s16)i) / (s16)schritte;
    ay = sy + ((gy - sy) * (s16)i) / (s16)schritte;
    if (ist_springer) {
      // Parabel-Sprungbogen über andere Figuren hinweg
      s16 bogen = (s16)i * (s16)(schritte - i);
      ay -= bogen / 6;
    }
    f_ang = ((i >> 2) & 1);
    oamSet(4, (u16)ax, (u16)ay, 3, hflip_ang, 0, figur_sprite(angreifer, f_ang), figur_pal(angreifer));
    oamSetEx(4, OBJ_LARGE, OBJ_SHOW);
    if (i == 6 || i == 14) klang_spielen(KLANG_KLICK);
    if (anim_warten()) { bild_wackeln(0, 0); return; }
  }

  // Kein Schlagzug -> fertig!
  if (opfer == LEER) return;

  // --- Phase 2: Battle-Chess-Duell direkt auf dem Schachfeld! ---
  // A) Konfrontation (8 Bilder)
  oamSet(4, (u16)gx, (u16)gy, 3, hflip_ang, 0, figur_sprite(angreifer, 0), figur_pal(angreifer));
  oamSet(8, (u16)dx, (u16)dy, 3, hflip_def, 0, figur_sprite(opfer, 0), figur_pal(opfer));
  for (i = 0; i < 8; i++) {
    if (anim_warten()) { bild_wackeln(0, 0); return; }
  }

  // B) Erster Schlagabtausch mit Funken / Magieblitz (16 Bilder)
  klang_spielen(KLANG_SETZEN);
  for (i = 0; i < 16; i++) {
    s16 stoss = (i < 8) ? (hflip_ang ? -5 : 5) : 0;
    oamSet(4, (u16)(gx + stoss), (u16)gy, 3, hflip_ang, 0, figur_sprite(angreifer, i < 10 ? 2 : 0), figur_pal(angreifer));
    // Verteidiger pariert kurz
    oamSet(8, (u16)dx, (u16)dy, 3, hflip_def, 0, figur_sprite(opfer, (i >= 4 && i < 12) ? 2 : 0), figur_pal(opfer));
    if (i >= 3 && i < 11) {
      eff_spr = ist_magie ? (i < 7 ? SCHACH_SPR_MAGIE_A : SCHACH_SPR_MAGIE_B) : (i < 7 ? SCHACH_SPR_FUNKE_A : SCHACH_SPR_FUNKE_B);
      oamSet(0, (u16)((gx + dx) / 2 + 8), (u16)(dy + 6), 3, 0, 0, eff_spr, SCHACH_PAL_EFFEKT);
      oamSetEx(0, OBJ_SMALL, OBJ_SHOW);
    } else {
      oamSetEx(0, OBJ_SMALL, OBJ_HIDE);
    }
    if (anim_warten()) { bild_wackeln(0, 0); return; }
  }

  // C) Entscheidungsschlag + Treffer-Blitz + Screen-Shake! (18 Bilder)
  klang_spielen(ist_schwer ? KLANG_WUERFELN : KLANG_SETZEN);
  for (i = 0; i < 18; i++) {
    s16 stoss = (i < 10) ? (hflip_ang ? -7 : 7) : 0;
    u8 def_pal = (i >= 2 && i < 8 && (i & 1)) ? SCHACH_PAL_TREFFER : figur_pal(opfer);
    s16 def_rueck = (i >= 2 && i < 10) ? (hflip_ang ? -3 : 3) : 0;
    oamSet(4, (u16)(gx + stoss), (u16)gy, 3, hflip_ang, 0, figur_sprite(angreifer, i < 12 ? 2 : 0), figur_pal(angreifer));
    oamSet(8, (u16)(dx + def_rueck), (u16)dy, 3, hflip_def, 0, figur_sprite(opfer, i < 10 ? 0 : 3), def_pal);

    if (i >= 2 && i < 14) {
      if (ist_magie) eff_spr = (i & 2) ? SCHACH_SPR_MAGIE_B : SCHACH_SPR_MAGIE_A;
      else if (ist_schwer) eff_spr = (i & 2) ? SCHACH_SPR_STAUB_B : SCHACH_SPR_STAUB_A;
      else eff_spr = (i & 2) ? SCHACH_SPR_FUNKE_B : SCHACH_SPR_FUNKE_A;
      oamSet(0, (u16)(dx + 8), (u16)(dy + 8), 3, 0, 0, eff_spr, SCHACH_PAL_EFFEKT);
      oamSetEx(0, OBJ_SMALL, OBJ_SHOW);
    } else {
      oamSetEx(0, OBJ_SMALL, OBJ_HIDE);
    }

    // Bildschirm-Wackeln beim Einschlag
    if (i >= 2 && i < 8) {
      s8 w = ist_schwer ? 3 : 2;
      bild_wackeln((i & 1) ? w : -w, (i & 2) ? 1 : -1);
    } else {
      bild_wackeln(0, 0);
    }
    if (anim_warten()) { bild_wackeln(0, 0); return; }
  }
  bild_wackeln(0, 0);

  // D) Sturz & Auflösen des Verteidigers + Staubwolke (16 Bilder)
  for (i = 0; i < 16; i++) {
    oamSet(4, (u16)gx, (u16)gy, 3, hflip_ang, 0, figur_sprite(angreifer, 0), figur_pal(angreifer));
    if (i < 12 && ((i < 6) || (i & 1))) {
      oamSet(8, (u16)dx, (u16)dy, 3, hflip_def, 0, figur_sprite(opfer, 3), figur_pal(opfer));
      oamSetEx(8, OBJ_LARGE, OBJ_SHOW);
    } else {
      oamSetEx(8, OBJ_LARGE, OBJ_HIDE);
    }
    if (i < 10) {
      f_eff = (i < 5) ? SCHACH_SPR_STAUB_A : SCHACH_SPR_STAUB_B;
      oamSet(0, (u16)(dx + 8), (u16)(dy + 12), 3, 0, 0, f_eff, SCHACH_PAL_EFFEKT);
      oamSetEx(0, OBJ_SMALL, OBJ_SHOW);
    } else {
      oamSetEx(0, OBJ_SMALL, OBJ_HIDE);
    }
    if (anim_warten()) return;
  }

  // E) Sieger rückt triumphierend auf das eroberte Feld ein (8 Bilder)
  for (i = 0; i <= 8; i++) {
    ax = gx + ((tx - gx) * (s16)i) / 8;
    ay = gy + ((ty - gy) * (s16)i) / 8;
    oamSet(4, (u16)ax, (u16)ay, 3, hflip_ang, 0, figur_sprite(angreifer, (i >> 2) & 1), figur_pal(angreifer));
    if (anim_warten()) return;
  }
}

const Spiel spiel_chess = {
  "Schach",
  (const char *const[]){
    "Battle Chess für 2 Spieler.",
    "",
    "Weiß beginnt. Matt, Patt,",
    "Rochaden, En Passant und",
    "animierte Kämpfe auf dem Brett.",
    0
  },
  "A Auswählen / Ziehen",
  (const char *const[]){"Weiß", "Schwarz"},
  (const u8[]){PAL_GELB, PAL_BLAU},
  2, 2,
  0,
  0, 0,
  FARBEN_TTT,
  chess_setup,
  chess_am_zug,
  chess_zuege,
  chess_ziehen,
  chess_ergebnis,
  chess_bot_zug,
  chess_ausgeben,
  chess_gitter,
  chess_feld_an,
  chess_felder,
  chess_zeichnen,
  4, 6,
  0, 0, 0,
  chess_grafik_laden,
  chess_animieren
};
