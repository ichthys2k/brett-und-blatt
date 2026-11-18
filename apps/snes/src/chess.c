/*
 * Schach für Brett & Blatt 16 (Stufe 5) nach packages/games/chess/src/rules.ts.
 * 2 Spieler (Weiß vs. Schwarz), 0x88-Brettdarstellung für das SNES.
 * Vollständige Zuggenerierung (Schlagen, Bauern-Doppelschritt, En Passant,
 * Rochaden, Umwandlung, Schachprüfung) und Alpha-Beta-Bot.
 */
#include <string.h>
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "../res/grafik.h"

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

static const char *const FIGUREN_SYM[] = {
  ".", "B", "S", "L", "T", "D", "K", "b", "s", "l", "t", "d", "k"
};

static void chess_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const ChessState *s = (const ChessState *)stand;
  flaeche_leeren(0, 0, 32, 28);

  text(2, 1, "Schach", PAL_TEXT);
  if (s->in_check) text(12, 1, "Schach!", PAL_ROT);

  u8 r, f;
  for (r = 0; r < 8; r++) {
    for (f = 0; f < 8; f++) {
      u8 sq = SQ(7 - r, f);
      u8 p = s->board[sq];
      u8 pal = IST_WEISS(p) ? PAL_GELB : (p != LEER ? PAL_BLAU : PAL_GRAU);
      text(8 + f * 2, 4 + r * 2, FIGUREN_SYM[p], pal);
    }
  }
}

const Spiel spiel_chess = {
  "Schach",
  (const char *const[]){
    "Klassisches Schach für 2 Spieler.",
    "",
    "Weiß beginnt. Matt, Patt,",
    "Rochaden, En Passant und Bauernumwandlung.",
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
  4, 4,
  0, 0, 0
};
