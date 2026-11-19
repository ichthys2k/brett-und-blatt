/*
 * Go 9×9 für Brett & Blatt 16 (Stufe 5) nach packages/games/go/src/rules.ts.
 * Freiheiten, Ketten, Schlagen, Ko-Regel, Positional Superko, Passen und Flächenauszählung.
 */
#include <string.h>
#include <stdio.h>
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "../res/grafik.h"

#define KEIN 0xff
#define GO_B 9
#define GO_FELDER (GO_B * GO_B)
#define GO_MAX_HIST 400

enum { GO_LEER = 0, GO_SCHWARZ = 1, GO_WEISS = 2 };

static const u32 ZOBRIST[324] = {
  0x510c4619UL, 0xe02e553eUL, 0x7bb98f3aUL, 0x183a8b5UL, 0xe6336d1fUL, 0xf989d237UL, 0xba2529d0UL, 0xfcfbedbfUL,
  0xa8c5ee39UL, 0xb55a53b8UL, 0x1a88a9eeUL, 0xf918a8b4UL, 0x6dc588d3UL, 0x472f513cUL, 0xc1870b8UL, 0x43e1465fUL,
  0xe78ea8aUL, 0x761dc0deUL, 0xeca9c7dUL, 0xf5e7493fUL, 0x84d44cbfUL, 0xa536e9deUL, 0x79afaed8UL, 0x2e9f4a2UL,
  0xb3c8f91cUL, 0x318ec249UL, 0xd13543eaUL, 0x504fd68eUL, 0xf9563be1UL, 0xfb6a9a74UL, 0xacad82a6UL, 0x83d0d79aUL,
  0xbd58ba6bUL, 0xe8a46341UL, 0xfd4255c7UL, 0x48a7297aUL, 0x1c8fc87eUL, 0x558f2d7eUL, 0xb43618aeUL, 0x935f84dfUL,
  0x1b4ef29dUL, 0x66bb3273UL, 0x1e5f1329UL, 0x7b73ebb4UL, 0xc6a87e76UL, 0xe5bd8265UL, 0xebd01b3dUL, 0xfe4e23a6UL,
  0x7d6529dbUL, 0xd39a9b74UL, 0x9e7f3aceUL, 0x5dfe0dfdUL, 0x147d987dUL, 0x493f1344UL, 0xc1af1b0fUL, 0x7b13a768UL,
  0xf02ab277UL, 0x6ae429e5UL, 0x14c73f29UL, 0x976eb1b8UL, 0x6a6bb394UL, 0x9f3e8e98UL, 0x9358942eUL, 0xba7f8cc0UL,
  0x37128f53UL, 0xb9e359cfUL, 0x8980c4e2UL, 0xb28541ecUL, 0x4da15ab0UL, 0xb81a50abUL, 0xb3e67c2cUL, 0xf01b81bdUL,
  0x85a054cbUL, 0x681719b7UL, 0xef1638c7UL, 0x29d754c0UL, 0xaaa99987UL, 0xaabf9c2bUL, 0x7e60c676UL, 0xb3689101UL,
  0x8854d505UL, 0x4c7bf39fUL, 0x730959fbUL, 0x5ef4a9e0UL, 0xb2d14c84UL, 0xf371a5a4UL, 0x3f6d8e86UL, 0x591c32d8UL,
  0x37acf21bUL, 0x94171b6cUL, 0x982ebaf1UL, 0xa1671469UL, 0x3ea8a61cUL, 0x670d5609UL, 0x744e0d0fUL, 0x81948f8UL,
  0x1cd571bUL, 0xcee2330cUL, 0x98fd1eedUL, 0x5f34ccddUL, 0x134efecaUL, 0x5e6cc8a1UL, 0x2869e8bdUL, 0xbab60242UL,
  0x2531989dUL, 0xd264420cUL, 0x1e980cdeUL, 0xff7ba8bfUL, 0xc7edbca9UL, 0x7f6c3635UL, 0xccf7b6e0UL, 0x7f5ed555UL,
  0x1b70d24fUL, 0x261f68b3UL, 0xaa24cbd7UL, 0x58987d78UL, 0xb1dd8a83UL, 0x1130b265UL, 0xe8fe2abbUL, 0x9882d18fUL,
  0x94d94a16UL, 0xee14fbbUL, 0xc5d1ba30UL, 0xa06fac1bUL, 0xe8703b4dUL, 0xc2474e1UL, 0xd5baa21dUL, 0xbed11ec1UL,
  0x3c2778e5UL, 0xb44d9e78UL, 0xf7d12a99UL, 0x82ce18d8UL, 0x7b723e72UL, 0xab3065acUL, 0x57337baeUL, 0x3092562dUL,
  0x30aeabc6UL, 0x5f153c8dUL, 0xe818f92fUL, 0x10913491UL, 0xf662fd90UL, 0x93c58678UL, 0x4258685dUL, 0xa52e1174UL,
  0x8714fc74UL, 0xbd47719UL, 0x23d5a5c2UL, 0x7ad860f4UL, 0xae1da977UL, 0x7d5bd92eUL, 0xc9bd5831UL, 0x35d264ecUL,
  0x50b4d12bUL, 0x98ab5803UL, 0x86c37b16UL, 0xdd983706UL, 0xb46bcdfaUL, 0x77498910UL, 0x8b1eee85UL, 0x8f02d9a2UL,
  0x52e88499UL, 0xd0b3124UL, 0xedf12d3UL, 0x7c2596b1UL, 0x1089e8c8UL, 0x9f8f3e00UL, 0x71af46c7UL, 0xb78aa5fcUL,
  0x859fd8a6UL, 0xafefdb83UL, 0xc76da84cUL, 0x3ee63ebeUL, 0xdf01c6e6UL, 0x1c73d408UL, 0xb8ae0951UL, 0x4906a7f3UL,
  0x22e9a8efUL, 0xe97c21b5UL, 0xc41c5510UL, 0x99703bafUL, 0x5eb7010dUL, 0x6c493686UL, 0x19a3aa8aUL, 0xf2a94293UL,
  0x8592b22eUL, 0xa9346365UL, 0x8e42e8e9UL, 0xb8ab8986UL, 0xfafe842bUL, 0x6505d3d6UL, 0x3090f149UL, 0xf98104b5UL,
  0xfbeecffeUL, 0x6032c036UL, 0x3eb799acUL, 0x7dcd92cdUL, 0x3d1ef5e7UL, 0x97eee2f6UL, 0x3db0e2eeUL, 0x1c4b7118UL,
  0x3f614dacUL, 0xcc4c1e06UL, 0xbe13c1c0UL, 0x35ff875UL, 0x7675edfdUL, 0xb28f2b18UL, 0xaa6c1d2eUL, 0x10f0f08aUL,
  0xd2d748baUL, 0x43c2be1aUL, 0x943f775aUL, 0x20554c30UL, 0xb3b213f9UL, 0xc86428ffUL, 0xe2062602UL, 0xfe08d941UL,
  0x4131f1f1UL, 0x9ef220b6UL, 0x86753544UL, 0x3b69006aUL, 0x77edf6d8UL, 0xefe4da23UL, 0xe0b08e13UL, 0xdf2043eaUL,
  0x3cf060c4UL, 0x2df7eeb0UL, 0xd41152a0UL, 0x36e09dc2UL, 0x8e4122aeUL, 0xe8824324UL, 0xbc34f9b7UL, 0x43430ef6UL,
  0x712628b8UL, 0x321f26a0UL, 0xfa2f565UL, 0x70c1c1a2UL, 0x56411ed8UL, 0xc6dea6b5UL, 0x5309f991UL, 0xeb461e0cUL,
  0x3876c3afUL, 0xe069266eUL, 0x503403bcUL, 0xd83e983dUL, 0x6c1e8981UL, 0x18f015d6UL, 0x5311c693UL, 0x13b1fd32UL,
  0xaee2cc19UL, 0x1b536289UL, 0x974d5808UL, 0xb5c483eeUL, 0x92937772UL, 0x73d460ccUL, 0x67e7a6aUL, 0xef588093UL,
  0x161979f6UL, 0x1dd309c5UL, 0xe19961b0UL, 0x784feb87UL, 0x22d66a18UL, 0x1d36a792UL, 0xf154ed70UL, 0xf3a1baadUL,
  0x5a7b6237UL, 0xf18ebc09UL, 0xe7fe6eceUL, 0x6ed0c07dUL, 0xad343952UL, 0x69d3e7fdUL, 0xb0a5e00bUL, 0x98344d79UL,
  0x22f7d334UL, 0xcab6d0fcUL, 0x5824da8UL, 0xcada1dd3UL, 0xa5671503UL, 0xbf2d8ae0UL, 0xc04036d8UL, 0x15f1e735UL,
  0xbfd247eUL, 0x4124cb27UL, 0xd048a7e7UL, 0x5230921dUL, 0x4e1156a4UL, 0xfc797c06UL, 0xacc36abaUL, 0xf31d0470UL,
  0x21f69a99UL, 0xa61dbaabUL, 0x385293efUL, 0x2fc799f8UL, 0x43e60704UL, 0xe3de1667UL, 0x34e3b2eUL, 0x4158be5bUL,
  0x84ed5752UL, 0xeee70a71UL, 0xfa8c9905UL, 0x5c2db7b3UL, 0xb1aff91eUL, 0x9f0fd558UL, 0xd13816caUL, 0xafc6d87aUL,
  0xedfde1deUL, 0x69072e9dUL, 0x164dd617UL, 0x3d636a50UL, 0x55010ac4UL, 0xff6fade8UL, 0x5087b8a1UL, 0x55eaa668UL,
  0x25d3799bUL, 0x16e7a18bUL, 0xb800ace0UL, 0x1e03bfeeUL, 0x56372931UL, 0xd13b4799UL, 0x80cf54ddUL, 0x20ccff17UL,
  0x5ae65080UL, 0x8e35079bUL, 0xf6086ff8UL, 0x85155263UL
};

typedef struct {
  u8 board[GO_FELDER];
  u8 turn; /* 0: Schwarz, 1: Weiß */
  u8 passes;
  u8 captures[2];
  u8 ko; /* Punkt oder KEIN */

  u8 phase; /* 0: play, 1: scoring, 2: over */
  u8 winner; /* 0, 1 oder KEIN */
  u8 accepted[2];

  u16 history_n;
  u32 history_hi[GO_MAX_HIST];
  u32 history_lo[GO_MAX_HIST];

  Zufall rng;
} GoState;

static const s8 NEIGHBORS[4] = {-9, -1, 1, 9};

static void go_setup(u8 *stand, const u8 *opt, u8 seats, const char *seed) {
  GoState *s = (GoState *)stand;
  memset(s, 0, sizeof(GoState));
  s->ko = KEIN;
  s->winner = KEIN;
  s->history_n = 1;
  s->history_hi[0] = 0;
  s->history_lo[0] = 0;
  zufall_strom(&s->rng, seed, "main");
}

static u8 go_am_zug(const u8 *stand) {
  const GoState *s = (const GoState *)stand;
  if (s->phase == 0) return s->turn;
  if (s->phase == 1) {
    if (!s->accepted[0]) return 0;
    if (!s->accepted[1]) return 1;
  }
  return PLATZ_KEIN;
}

/* Ketten und Freiheiten */
static u8 chain_points[GO_FELDER];
static u8 visited[GO_FELDER];

static void get_chain_liberties(const u8 *board, u8 pt, u8 *chain_n, u8 *liberties) {
  u8 color = board[pt];
  u8 queue[GO_FELDER];
  u8 q_head = 0, q_tail = 0;
  u8 lib_visited[GO_FELDER];

  memset(visited, 0, GO_FELDER);
  memset(lib_visited, 0, GO_FELDER);
  *chain_n = 0;
  *liberties = 0;

  queue[q_tail++] = pt;
  visited[pt] = 1;
  chain_points[(*chain_n)++] = pt;

  while (q_head < q_tail) {
    u8 curr = queue[q_head++];
    u8 r = curr / GO_B;
    u8 c = curr % GO_B;
    u8 i;

    for (i = 0; i < 4; i++) {
      s8 n_pt = curr + NEIGHBORS[i];
      if (n_pt < 0 || n_pt >= GO_FELDER) continue;
      if (i == 1 && c == 0) continue;
      if (i == 2 && c == GO_B - 1) continue;

      if (board[n_pt] == GO_LEER) {
        if (!lib_visited[n_pt]) {
          lib_visited[n_pt] = 1;
          (*liberties)++;
        }
      } else if (board[n_pt] == color && !visited[n_pt]) {
        visited[n_pt] = 1;
        chain_points[(*chain_n)++] = n_pt;
        queue[q_tail++] = n_pt;
      }
    }
  }
}

static u8 zug_erlaubt_go(const GoState *s, u8 pt) {
  if (pt >= GO_FELDER) return 0;
  if (s->board[pt] != GO_LEER) return 0;
  if (pt == s->ko) return 0;

  u8 color = (s->turn == 0) ? GO_SCHWARZ : GO_WEISS;
  u8 enemy = (s->turn == 0) ? GO_WEISS : GO_SCHWARZ;

  /* Temporäres Brett */
  u8 tmp[GO_FELDER];
  memcpy(tmp, s->board, GO_FELDER);
  tmp[pt] = color;

  /* Erst prüfen ob gegnerische Nachbarn geschlagen werden */
  u8 total_captured = 0;
  u8 captured_stones[GO_FELDER];
  u8 r = pt / GO_B;
  u8 c = pt % GO_B;
  u8 i;

  for (i = 0; i < 4; i++) {
    s8 n_pt = pt + NEIGHBORS[i];
    if (n_pt < 0 || n_pt >= GO_FELDER) continue;
    if (i == 1 && c == 0) continue;
    if (i == 2 && c == GO_B - 1) continue;

    if (tmp[n_pt] == enemy) {
      u8 cn, libs;
      get_chain_liberties(tmp, n_pt, &cn, &libs);
      if (libs == 0) {
        u8 j;
        for (j = 0; j < cn; j++) {
          captured_stones[total_captured++] = chain_points[j];
          tmp[chain_points[j]] = GO_LEER;
        }
      }
    }
  }

  /* Eigene Freiheiten prüfen */
  u8 cn, libs;
  get_chain_liberties(tmp, pt, &cn, &libs);
  if (libs == 0) {
    /* Selbstmord ist verboten! */
    return 0;
  }

  /* Positional Superko prüfen: nur prüfen wenn captures möglich oder vorhanden */
  u8 need_superko = 0;
  if (total_captured > 0) need_superko = 1;
  if (s->captures[0] > 0) need_superko = 1;
  if (s->captures[1] > 0) need_superko = 1;

  if (need_superko) {
    if (s->history_n > 0) {
      u32 hi = s->history_hi[s->history_n - 1];
      u32 lo = s->history_lo[s->history_n - 1];
      u16 idx = (pt * 2 + (color - 1)) * 2;
      hi ^= ZOBRIST[idx];
      lo ^= ZOBRIST[idx + 1];
      u8 j;
      for (j = 0; j < total_captured; j++) {
        u8 cp = captured_stones[j];
        u16 cidx = (cp * 2 + (enemy - 1)) * 2;
        hi ^= ZOBRIST[cidx];
        lo ^= ZOBRIST[cidx + 1];
      }
      u16 k;
      for (k = 0; k < s->history_n; k++) {
        if (s->history_hi[k] == hi) {
          if (s->history_lo[k] == lo) {
            return 0; /* Superko: Wiederholung verboten! */
          }
        }
      }
    }
  }

  return 1;
}

static u8 flaeche_owner[GO_FELDER];
static u8 flaeche_seen[GO_FELDER];
static u8 flaeche_queue[GO_FELDER];
static u8 flaeche_region[GO_FELDER];

static u8 go_flaeche(const u8 *board) {
  u8 p, i;

  memcpy(flaeche_owner, board, GO_FELDER);
  memset(flaeche_seen, 0, GO_FELDER);

  for (p = 0; p < GO_FELDER; p++) {
    if (board[p] != GO_LEER) continue;
    if (flaeche_seen[p]) continue;

    u8 q_head = 0, q_tail = 0;
    u8 reg_n = 0;
    u8 touches = 0;

    flaeche_queue[q_tail++] = p;
    flaeche_seen[p] = 1;

    while (q_head < q_tail) {
      u8 curr = flaeche_queue[q_head++];
      flaeche_region[reg_n++] = curr;
      u8 c = curr % GO_B;

      for (i = 0; i < 4; i++) {
        s8 n_pt = curr + NEIGHBORS[i];
        if (n_pt < 0) continue;
        if (n_pt >= GO_FELDER) continue;
        if (i == 1) { if (c == 0) continue; }
        if (i == 2) { if (c == GO_B - 1) continue; }

        u8 v = board[n_pt];
        if (v == GO_LEER) {
          if (!flaeche_seen[n_pt]) {
            flaeche_seen[n_pt] = 1;
            flaeche_queue[q_tail++] = n_pt;
          }
        } else {
          touches |= v;
        }
      }
    }

    u8 who = GO_LEER;
    if (touches == GO_SCHWARZ) who = GO_SCHWARZ;
    if (touches == GO_WEISS) who = GO_WEISS;

    for (i = 0; i < reg_n; i++) {
      flaeche_owner[flaeche_region[i]] = who;
    }
  }

  u8 black = 0, white = 0;
  for (p = 0; p < GO_FELDER; p++) {
    if (flaeche_owner[p] == GO_SCHWARZ) black++;
    if (flaeche_owner[p] == GO_WEISS) white++;
  }

  /* Weiß hat 7.5 Komi */
  u16 b_score = ((u16)black) * 2;
  u16 w_score = ((u16)white) * 2 + 15;

  if (b_score > w_score) return 0;
  if (w_score > b_score) return 1;
  return KEIN;
}

static u16 go_zuege(const u8 *stand, Zug *liste) {
  const GoState *s = (const GoState *)stand;
  u16 anzahl = 0;
  u8 pt;

  if (s->phase == 1) {
    liste[0].n = 1; liste[0].b[0] = 2; /* acceptScore */
    liste[1].n = 1; liste[1].b[0] = 3; /* resume */
    return 2;
  }
  if (s->phase != 0) return 0;

  /* Passen (1, 0) */
  liste[anzahl].n = 2; liste[anzahl].b[0] = 1; liste[anzahl].b[1] = 0; anzahl++;

  /* Alle erlaubten Schnittpunkte */
  for (pt = 0; pt < GO_FELDER; pt++) {
    if (zug_erlaubt_go(s, pt)) {
      liste[anzahl].n = 2;
      liste[anzahl].b[0] = 0; /* place */
      liste[anzahl].b[1] = pt;
      anzahl++;
    }
  }

  return anzahl;
}

static u8 go_ziehen(u8 *stand, const Zug *zug) {
  GoState *s = (GoState *)stand;
  u8 typ = zug->b[0];

  if (s->phase == 1) {
    u8 p = go_am_zug(stand);
    if (typ == 2) { /* acceptScore */
      s->accepted[p] = 1;
      if (s->accepted[0]) {
        if (s->accepted[1]) {
          u8 w = go_flaeche(s->board);
          s->phase = 2; /* over */
          s->winner = w;
          return KLANG_ENDE;
        }
      }
      return KLANG_KLICK;
    }
    if (typ == 3) { /* resume */
      s->phase = 0;
      s->passes = 0;
      s->accepted[0] = 0;
      s->accepted[1] = 0;
      return KLANG_KLICK;
    }
    return KLANG_KLICK;
  }

  if (typ == 1) { /* pass */
    s->passes++;
    s->ko = KEIN;
    s->turn ^= 1;
    if (s->passes >= 2) {
      s->phase = 1; /* scoring */
      s->accepted[0] = 0;
      s->accepted[1] = 0;
      return KLANG_KLICK;
    }
    return KLANG_KLICK;
  }

  if (typ == 0) { /* place */
    u8 pt = zug->b[1];
    u8 color = (s->turn == 0) ? GO_SCHWARZ : GO_WEISS;
    u8 enemy = (s->turn == 0) ? GO_WEISS : GO_SCHWARZ;

    s->board[pt] = color;
    s->passes = 0;

    /* Schlagen */
    u8 total_captured = 0;
    u8 captured_stones[GO_FELDER];
    u8 single_captured_pt = KEIN;
    u8 r = pt / GO_B;
    u8 c = pt % GO_B;
    u8 i;

    for (i = 0; i < 4; i++) {
      s8 n_pt = pt + NEIGHBORS[i];
      if (n_pt < 0 || n_pt >= GO_FELDER) continue;
      if (i == 1 && c == 0) continue;
      if (i == 2 && c == GO_B - 1) continue;

      if (s->board[n_pt] == enemy) {
        u8 cn, libs;
        get_chain_liberties(s->board, n_pt, &cn, &libs);
        if (libs == 0) {
          u8 j;
          for (j = 0; j < cn; j++) {
            captured_stones[total_captured++] = chain_points[j];
            s->board[chain_points[j]] = GO_LEER;
          }
          if (cn == 1) single_captured_pt = n_pt;
        }
      }
    }

    s->captures[s->turn] += total_captured;

    /* Ko-Regel: Genau 1 Stein geschlagen und eigener Stein hat genau 1 Freiheit */
    s->ko = KEIN;
    if (total_captured == 1) {
      u8 cn, libs;
      get_chain_liberties(s->board, pt, &cn, &libs);
      if (cn == 1 && libs == 1) {
        s->ko = single_captured_pt;
      }
    }

    /* History aktualisieren */
    if (s->history_n > 0 && s->history_n < GO_MAX_HIST) {
      u32 hi = s->history_hi[s->history_n - 1];
      u32 lo = s->history_lo[s->history_n - 1];
      u16 idx = (pt * 2 + (color - 1)) * 2;
      hi ^= ZOBRIST[idx];
      lo ^= ZOBRIST[idx + 1];
      u8 j;
      for (j = 0; j < total_captured; j++) {
        u8 cp = captured_stones[j];
        u16 cidx = (cp * 2 + (enemy - 1)) * 2;
        hi ^= ZOBRIST[cidx];
        lo ^= ZOBRIST[cidx + 1];
      }
      s->history_hi[s->history_n] = hi;
      s->history_lo[s->history_n] = lo;
      s->history_n++;
    }

    s->turn ^= 1;
    return total_captured > 0 ? KLANG_SETZEN : KLANG_KLICK;
  }

  return KLANG_KLICK;
}

static u8 go_ergebnis(const u8 *stand, u8 *sieger) {
  const GoState *s = (const GoState *)stand;
  if (s->phase != 2) return ERGEBNIS_LAEUFT;
  if (s->winner != KEIN) {
    *sieger = (1 << s->winner);
    return ERGEBNIS_SIEG;
  }
  *sieger = 0;
  return ERGEBNIS_REMIS;
}

static void go_bot_zug(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  u16 n = go_zuege(stand, zugliste);
  if (n == 0) return;
  if (stufe == STUFE_LEICHT || n == 1) {
    *zug = zugliste[zufall_bis(z, n)];
    return;
  }

  const GoState *s = (const GoState *)stand;
  if (s->phase == 1) {
    *zug = zugliste[0]; /* acceptScore */
    return;
  }

  /* Bewertungsfunktion für Züge */
  u16 i;
  s16 best_score = -30000;
  u16 best_idx = 0;

  for (i = 0; i < n; i++) {
    if (zugliste[i].b[0] == 1) { /* Pass */
      s16 score = -50;
      if (score > best_score) {
        best_score = score;
        best_idx = i;
      }
      continue;
    }

    u8 pt = zugliste[i].b[1];
    s16 score = 0;

    /* Sternpunkte bevorzugen */
    if (pt == 20 || pt == 24 || pt == 40 || pt == 56 || pt == 60) score += 30;

    /* 3. und 4. Linie bevorzugen */
    u8 r = pt / GO_B;
    u8 c = pt % GO_B;
    if (r >= 2 && r <= 6 && c >= 2 && c <= 6) score += 15;
    /* 1. Linie meiden */
    if (r == 0 || r == 8 || c == 0 || c == 8) score -= 15;

    /* Probeweise Zug ausführen zur Bewertung von Freiheiten / Schlagen */
    u8 color = (s->turn == 0) ? GO_SCHWARZ : GO_WEISS;
    u8 enemy = (s->turn == 0) ? GO_WEISS : GO_SCHWARZ;
    u8 tmp[GO_FELDER];
    memcpy(tmp, s->board, GO_FELDER);
    tmp[pt] = color;

    u8 captured = 0;
    u8 ni;
    for (ni = 0; ni < 4; ni++) {
      s8 n_pt = pt + NEIGHBORS[ni];
      if (n_pt < 0 || n_pt >= GO_FELDER) continue;
      if (ni == 1 && c == 0) continue;
      if (ni == 2 && c == GO_B - 1) continue;

      if (tmp[n_pt] == enemy) {
        u8 cn, libs;
        get_chain_liberties(tmp, n_pt, &cn, &libs);
        if (libs == 0) {
          captured += cn;
          u8 j;
          for (j = 0; j < cn; j++) tmp[chain_points[j]] = GO_LEER;
        }
      }
    }

    score += (s16)captured * 40;

    u8 my_cn, my_libs;
    get_chain_liberties(tmp, pt, &my_cn, &my_libs);
    if (my_libs == 1) {
      score -= 80; /* Selbst-Atari meiden */
    } else {
      score += (s16)my_libs * 5;
    }

    /* Kleiner Zufallsfaktor */
    score += zufall_bis(z, 5);

    if (score > best_score) {
      best_score = score;
      best_idx = i;
    }
  }

  *zug = zugliste[best_idx];
}

static u16 go_ausgeben(const u8 *stand, u8 *puffer) {
  const GoState *s = (const GoState *)stand;
  u16 p = 0;
  u8 i;

  for (i = 0; i < GO_FELDER; i++) puffer[p++] = s->board[i];
  puffer[p++] = s->turn;
  puffer[p++] = s->passes;
  puffer[p++] = s->captures[0];
  puffer[p++] = s->captures[1];
  puffer[p++] = s->ko;
  puffer[p++] = s->phase;
  puffer[p++] = s->winner;

  return p;
}

static void go_gitter(const u8 *stand, u8 *b, u8 *h) {
  *b = 9;
  *h = 9;
}

static u8 go_feld_an(const u8 *stand, u8 x, u8 y) {
  return y * GO_B + x;
}

static u8 go_felder(const u8 *stand, const Zug *zug, u8 *f) {
  if (zug->b[0] == 0) {
    f[0] = zug->b[1];
    return 1;
  }
  return 0;
}

#include "../res/brett_grafik.h"
extern char brett_bg, brett_bg_ende, brett_bg_pal;

static void go_grafik_laden(void) {
  bild_kacheln_laden((const u8 *)&brett_bg, (u16)(&brett_bg_ende - &brett_bg));
  bild_bg_paletten((const u8 *)&brett_bg_pal, PAL_BRETT, 3);
}

static void go_block_unten(u8 x, u8 y, u16 basis) {
  kachel_unten(x, y, basis, PAL_BRETT);
  kachel_unten(x + 1, y, basis + 1, PAL_BRETT);
  kachel_unten(x, y + 1, basis + 2, PAL_BRETT);
  kachel_unten(x + 1, y + 1, basis + 3, PAL_BRETT);
}

static void go_block_oben(u8 x, u8 y, u16 basis) {
  kachel(x, y, basis, PAL_BRETT);
  kachel(x + 1, y, basis + 1, PAL_BRETT);
  kachel(x, y + 1, basis + 2, PAL_BRETT);
  kachel(x + 1, y + 1, basis + 3, PAL_BRETT);
}

static void go_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const GoState *s = (const GoState *)stand;
  u8 r, c, bx, by, pt, v;
  u16 basis;

  flaeche_leeren(0, 4, 32, 21);
  text(0, 5, "Fang:", PAL_GRAU);
  text(0, 6, "S:", PAL_TEXT);
  zahl(2, 6, s->captures[0], 2, PAL_GELB);
  text(0, 8, "W:", PAL_TEXT);
  zahl(2, 8, s->captures[1], 2, PAL_TEXT);

  /* Holzrahmen um das 18×18-Kaya-Brett (ab x=7, y=5) */
  for (c = 0; c < 20; c++) {
    kachel_unten(6 + c, 4, BRETT_GO_RAHMEN, PAL_BRETT);
    kachel_unten(6 + c, 23, BRETT_GO_RAHMEN, PAL_BRETT);
  }
  for (r = 0; r < 18; r++) {
    kachel_unten(6, 5 + r, BRETT_GO_RAHMEN, PAL_BRETT);
    kachel_unten(25, 5 + r, BRETT_GO_RAHMEN, PAL_BRETT);
  }

  for (r = 0; r < GO_B; r++) {
    by = 5 + r * 2;
    for (c = 0; c < GO_B; c++) {
      bx = 7 + c * 2;
      pt = r * GO_B + c;
      v = s->board[pt];

      if (r == 0 && c == 0) basis = BRETT_GO_OL;
      else if (r == 0 && c == 8) basis = BRETT_GO_OR;
      else if (r == 8 && c == 0) basis = BRETT_GO_UL;
      else if (r == 8 && c == 8) basis = BRETT_GO_UR;
      else if (r == 0) basis = BRETT_GO_OBEN;
      else if (r == 8) basis = BRETT_GO_UNTEN;
      else if (c == 0) basis = BRETT_GO_LINKS;
      else if (c == 8) basis = BRETT_GO_RECHTS;
      else if ((r == 2 || r == 6) && (c == 2 || c == 6)) basis = BRETT_GO_HOSHI;
      else if (r == 4 && c == 4) basis = BRETT_GO_HOSHI;
      else basis = BRETT_GO_MITTE;

      go_block_unten(bx, by, basis);
      if (v == GO_SCHWARZ) go_block_oben(bx, by, BRETT_GO_SCHWARZ);
      else if (v == GO_WEISS) go_block_oben(bx, by, BRETT_GO_WEISS);

      if (aktiv && markierung && (markierung[pt] & MARK_CURSOR)) {
        go_block_oben(bx, by, BRETT_GO_CURSOR);
      }
    }
  }
}

const Spiel spiel_go = {
  "Go",
  (const char *const[]){
    "Klassisches Go auf dem 9×9-Brett.",
    "",
    "Schwarz beginnt. Steine setzen,",
    "Gebiet umzingeln, Ketten schlagen und Ko.",
    0
  },
  "A Stein setzen / Passen",
  (const char *const[]){"Schwarz", "Weiß"},
  (const u8[]){PAL_BLAU, PAL_GELB},
  2, 2,
  0,
  0, 0,
  FARBEN_TTT,
  go_setup,
  go_am_zug,
  go_zuege,
  go_ziehen,
  go_ergebnis,
  go_bot_zug,
  go_ausgeben,
  go_gitter,
  go_feld_an,
  go_felder,
  go_zeichnen,
  4, 4,
  0, 0, 0,
  go_grafik_laden,
  0,
  0
};
