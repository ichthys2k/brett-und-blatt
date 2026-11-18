/*
 * Zufall wie in der Web-App (packages/engine/src/random.ts): Startwert aus Text mit cyrb128,
 * Zahlenfolge mit sfc32. Gleicher Text ergibt auf dem SNES und im Browser dieselben Zahlen –
 * das prüft apps/snes/test/snes.test.ts.
 */
#ifndef ZUFALL_H
#define ZUFALL_H

#include <snes.h>

typedef struct {
  u32 s[4];
} Zufall;

/** Wie `Rng.fromSeed(seed, stream)`: Text ist „seed/stream“. */
void zufall_aus_text(Zufall *z, const char *text);
/** Wie `Rng.fromSeed(seed, strom)`. */
void zufall_strom(Zufall *z, const char *seed, const char *strom);
/** Seed-Text „s12345“ aus einer Zahl (für Partien auf dem SNES selbst; mindestens 7 Zeichen Platz). */
void seed_aus_zahl(char *seed, u16 zahl);
/** Startwert aus einer Zahl (für Partien auf dem SNES selbst). */
void zufall_aus_zahl(Zufall *z, u16 zahl);
/** Nächste 32-Bit-Zahl (im Browser: `next() * 2^32`). */
u32 zufall_zahl(Zufall *z);
/** Ganze Zahl in [0, grenze) – wie `Rng.int(grenze)`. */
u16 zufall_bis(Zufall *z, u16 grenze);
/** Wahr mit Wahrscheinlichkeit 1/2 – wie `Rng.chance(0.5)`. */
u8 zufall_halb(Zufall *z);

#endif
