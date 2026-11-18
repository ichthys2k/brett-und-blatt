#include "zufall.h"

void zufall_aus_text(Zufall *z, const char *text) {
  u32 h1 = 1779033703UL;
  u32 h2 = 3144134277UL;
  u32 h3 = 1013904242UL;
  u32 h4 = 2773480762UL;
  u32 k;
  const u8 *p = (const u8 *)text;
  while (*p) {
    k = *p++;
    h1 = h2 ^ ((h1 ^ k) * 597399067UL);
    h2 = h3 ^ ((h2 ^ k) * 2869860233UL);
    h3 = h4 ^ ((h3 ^ k) * 951274213UL);
    h4 = h1 ^ ((h4 ^ k) * 2716044179UL);
  }
  h1 = (h3 ^ (h1 >> 18)) * 597399067UL;
  h2 = (h4 ^ (h2 >> 22)) * 2869860233UL;
  h3 = (h1 ^ (h3 >> 17)) * 951274213UL;
  h4 = (h2 ^ (h4 >> 19)) * 2716044179UL;
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  z->s[0] = h1;
  z->s[1] = h2;
  z->s[2] = h3;
  z->s[3] = h4;
}

void zufall_aus_zahl(Zufall *z, u16 zahl) {
  char text[8];
  u8 i;
  // Text „s“ und fünf Ziffern, damit derselbe Weg wie bei Text-Startwerten genutzt wird.
  text[0] = 's';
  for (i = 0; i < 5; i++) {
    text[5 - i] = '0' + zahl % 10;
    zahl /= 10;
  }
  text[6] = 0;
  zufall_aus_text(z, text);
}

u32 zufall_zahl(Zufall *z) {
  u32 a = z->s[0];
  u32 b = z->s[1];
  u32 c = z->s[2];
  u32 d = z->s[3];
  u32 t = a + b + d;
  d = d + 1;
  a = b ^ (b >> 9);
  b = c + (c << 3);
  c = (c << 21) | (c >> 11);
  c = c + t;
  z->s[0] = a;
  z->s[1] = b;
  z->s[2] = c;
  z->s[3] = d;
  return t;
}

u16 zufall_bis(Zufall *z, u16 grenze) {
  // floor(t / 2^32 * grenze) = obere 16 Bit von (t * grenze) >> 16, ohne 48-Bit-Zahlen.
  u32 t = zufall_zahl(z);
  u32 oben = (t >> 16) * grenze;
  u32 unten = ((t & 0xffff) * grenze) >> 16;
  return (u16)((oben + unten) >> 16);
}

u8 zufall_halb(Zufall *z) {
  return zufall_zahl(z) < 0x80000000UL;
}
