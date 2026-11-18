/*
 * Prüf-Emulator für Brett & Blatt 16: ein winziges libretro-Frontend ohne Fenster.
 *
 * Es lädt einen libretro-Kern (Snes9x oder bsnes) und ein ROM und liest Befehle zeilenweise
 * von stdin. Jede Antwort ist genau eine Zeile auf stdout, die mit „ok“ oder „fehler“ beginnt.
 * Die Node-Tests (`apps/snes/test/emu.ts`) steuern es so: Knöpfe drücken, Bilder laufen lassen,
 * Arbeitsspeicher (WRAM) und Batteriespeicher (SRAM) lesen und schreiben, Bildschirmfotos.
 *
 *   emu <kern.so> <rom.sfc>
 *
 * Befehle (Zahlen hexadezimal, außer Bildanzahl und Länge):
 *   run <bilder>                      Bilder (Frames) emulieren
 *   pad <port> <maske>                Knöpfe eines Controllers setzen (Bits = libretro-Joypad-Ids)
 *   peek <adresse> <länge>            WRAM lesen (Adresse 0–1ffff, also $7e0000 = 0)
 *   poke <adresse> <hexbytes>         WRAM schreiben
 *   speek / spoke                     dasselbe für SRAM
 *   until <adresse> <wert> <max>      Bilder laufen lassen, bis das Byte den Wert hat
 *   shot <datei.png>                  Bildschirmfoto als PNG
 *   audio                             größter Ausschlag der Tonausgabe seit dem letzten Aufruf
 *   rec                               Tonaufnahme beginnen
 *   recsave <datei.wav>               Tonaufnahme beenden und als WAV (Stereo, 32 kHz) speichern
 *   reset                             Neustart (SRAM bleibt)
 *   quit
 */
#include <dlfcn.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "libretro.h"

static void (*core_init)(void);
static void (*core_deinit)(void);
static void (*core_set_environment)(retro_environment_t);
static void (*core_set_video_refresh)(retro_video_refresh_t);
static void (*core_set_audio_sample)(retro_audio_sample_t);
static void (*core_set_audio_sample_batch)(retro_audio_sample_batch_t);
static void (*core_set_input_poll)(retro_input_poll_t);
static void (*core_set_input_state)(retro_input_state_t);
static bool (*core_load_game)(const struct retro_game_info *);
static void (*core_run)(void);
static void (*core_reset)(void);
static void *(*core_get_memory_data)(unsigned);
static size_t (*core_get_memory_size)(unsigned);
static void (*core_set_controller_port_device)(unsigned, unsigned);

static enum retro_pixel_format pixel_format = RETRO_PIXEL_FORMAT_0RGB1555;
static uint8_t frame_rgb[512 * 512 * 3];
static unsigned frame_w, frame_h;
static uint16_t pads[8];
static int audio_peak;
static int16_t *rec_buf;
static size_t rec_len, rec_cap;

static void log_cb(enum retro_log_level level, const char *fmt, ...) {
  if (level < RETRO_LOG_WARN) return;
  va_list ap;
  va_start(ap, fmt);
  vfprintf(stderr, fmt, ap);
  va_end(ap);
}

static bool environment(unsigned cmd, void *data) {
  switch (cmd) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
      pixel_format = *(const enum retro_pixel_format *)data;
      return true;
    case RETRO_ENVIRONMENT_GET_CAN_DUPE:
      *(bool *)data = true;
      return true;
    case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
    case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:
      *(const char **)data = ".";
      return true;
    case RETRO_ENVIRONMENT_GET_LOG_INTERFACE:
      ((struct retro_log_callback *)data)->log = log_cb;
      return true;
    default:
      return false;
  }
}

static void video_refresh(const void *data, unsigned width, unsigned height, size_t pitch) {
  if (!data || width > 512 || height > 512) return;
  frame_w = width;
  frame_h = height;
  for (unsigned y = 0; y < height; y++) {
    const uint8_t *row = (const uint8_t *)data + y * pitch;
    uint8_t *out = frame_rgb + (size_t)y * width * 3;
    for (unsigned x = 0; x < width; x++) {
      unsigned r, g, b;
      if (pixel_format == RETRO_PIXEL_FORMAT_XRGB8888) {
        uint32_t p = ((const uint32_t *)row)[x];
        r = (p >> 16) & 0xff, g = (p >> 8) & 0xff, b = p & 0xff;
      } else if (pixel_format == RETRO_PIXEL_FORMAT_RGB565) {
        uint16_t p = ((const uint16_t *)row)[x];
        r = ((p >> 11) & 31) * 255 / 31, g = ((p >> 5) & 63) * 255 / 63, b = (p & 31) * 255 / 31;
      } else {
        uint16_t p = ((const uint16_t *)row)[x];
        r = ((p >> 10) & 31) * 255 / 31, g = ((p >> 5) & 31) * 255 / 31, b = (p & 31) * 255 / 31;
      }
      out[x * 3] = r, out[x * 3 + 1] = g, out[x * 3 + 2] = b;
    }
  }
}

static void track_audio(int16_t l, int16_t r) {
  int a = abs(l), b = abs(r);
  if (a > audio_peak) audio_peak = a;
  if (b > audio_peak) audio_peak = b;
  if (rec_buf) {
    if (rec_len + 2 > rec_cap) {
      rec_cap = rec_cap * 2 + 65536;
      rec_buf = realloc(rec_buf, rec_cap * sizeof(int16_t));
    }
    rec_buf[rec_len++] = l;
    rec_buf[rec_len++] = r;
  }
}
static void audio_sample(int16_t l, int16_t r) { track_audio(l, r); }
static size_t audio_batch(const int16_t *data, size_t frames) {
  for (size_t i = 0; i < frames; i++) track_audio(data[i * 2], data[i * 2 + 1]);
  return frames;
}
static void input_poll(void) {}
static int16_t input_state(unsigned port, unsigned device, unsigned index, unsigned id) {
  (void)index;
  if (port >= 8 || (device & RETRO_DEVICE_MASK) != RETRO_DEVICE_JOYPAD) return 0;
  if (id == RETRO_DEVICE_ID_JOYPAD_MASK) return (int16_t)pads[port];
  return (pads[port] >> id) & 1;
}

/* --- PNG ohne Bibliothek: unkomprimierte Deflate-Blöcke --- */
static uint32_t crc_table[256];
static void crc_init(void) {
  for (uint32_t n = 0; n < 256; n++) {
    uint32_t c = n;
    for (int k = 0; k < 8; k++) c = c & 1 ? 0xedb88320u ^ (c >> 1) : c >> 1;
    crc_table[n] = c;
  }
}
static uint32_t crc(uint32_t c, const uint8_t *buf, size_t len) {
  for (size_t i = 0; i < len; i++) c = crc_table[(c ^ buf[i]) & 0xff] ^ (c >> 8);
  return c;
}
static void put32(uint8_t *p, uint32_t v) { p[0] = v >> 24, p[1] = v >> 16, p[2] = v >> 8, p[3] = v; }
static void chunk(FILE *f, const char *type, const uint8_t *data, uint32_t len) {
  uint8_t head[8];
  put32(head, len);
  memcpy(head + 4, type, 4);
  fwrite(head, 1, 8, f);
  if (len) fwrite(data, 1, len, f);
  uint32_t c = crc(0xffffffffu, (const uint8_t *)type, 4);
  c = crc(c, data, len) ^ 0xffffffffu;
  uint8_t tail[4];
  put32(tail, c);
  fwrite(tail, 1, 4, f);
}
static int write_png(const char *path) {
  if (!frame_w) return 0;
  size_t row = frame_w * 3 + 1, raw_len = row * frame_h;
  uint8_t *raw = malloc(raw_len);
  for (unsigned y = 0; y < frame_h; y++) {
    raw[y * row] = 0;
    memcpy(raw + y * row + 1, frame_rgb + (size_t)y * frame_w * 3, frame_w * 3);
  }
  size_t blocks = (raw_len + 65534) / 65535;
  size_t z_len = 2 + raw_len + blocks * 5 + 4;
  uint8_t *z = malloc(z_len), *p = z;
  *p++ = 0x78, *p++ = 0x01;
  uint32_t a = 1, b = 0;
  for (size_t off = 0; off < raw_len; off += 65535) {
    size_t n = raw_len - off < 65535 ? raw_len - off : 65535;
    *p++ = off + n >= raw_len;
    *p++ = n & 0xff, *p++ = n >> 8, *p++ = ~n & 0xff, *p++ = (~n >> 8) & 0xff;
    memcpy(p, raw + off, n);
    p += n;
  }
  for (size_t i = 0; i < raw_len; i++) a = (a + raw[i]) % 65521, b = (b + a) % 65521;
  put32(p, (b << 16) | a);
  FILE *f = fopen(path, "wb");
  if (!f) return 0;
  static const uint8_t sig[8] = {0x89, 'P', 'N', 'G', 13, 10, 26, 10};
  fwrite(sig, 1, 8, f);
  uint8_t ihdr[13];
  put32(ihdr, frame_w), put32(ihdr + 4, frame_h);
  ihdr[8] = 8, ihdr[9] = 2, ihdr[10] = ihdr[11] = ihdr[12] = 0;
  chunk(f, "IHDR", ihdr, 13);
  chunk(f, "IDAT", z, (uint32_t)z_len);
  chunk(f, "IEND", NULL, 0);
  fclose(f);
  free(raw), free(z);
  return 1;
}

static void *sym(void *lib, const char *name) {
  void *p = dlsym(lib, name);
  if (!p) {
    fprintf(stderr, "Symbol fehlt im Kern: %s\n", name);
    exit(2);
  }
  return p;
}

static int hexval(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

static void cmd_peek(unsigned type, unsigned long addr, unsigned long len) {
  uint8_t *mem = core_get_memory_data(type);
  size_t size = core_get_memory_size(type);
  if (!mem || addr + len > size) {
    printf("fehler Bereich %lx+%lu außerhalb (Größe %zu)\n", addr, len, size);
    return;
  }
  printf("ok ");
  for (unsigned long i = 0; i < len; i++) printf("%02x", mem[addr + i]);
  printf("\n");
}

static void cmd_poke(unsigned type, unsigned long addr, const char *hex) {
  uint8_t *mem = core_get_memory_data(type);
  size_t size = core_get_memory_size(type), n = strlen(hex) / 2;
  if (!mem || addr + n > size) {
    printf("fehler Bereich %lx+%zu außerhalb (Größe %zu)\n", addr, n, size);
    return;
  }
  for (size_t i = 0; i < n; i++) mem[addr + i] = (uint8_t)(hexval(hex[i * 2]) << 4 | hexval(hex[i * 2 + 1]));
  printf("ok\n");
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Aufruf: emu <kern.so> <rom.sfc>\n");
    return 2;
  }
  setvbuf(stdout, NULL, _IOLBF, 0);
  crc_init();
  void *lib = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
  if (!lib) {
    fprintf(stderr, "Kern nicht ladbar: %s\n", dlerror());
    return 2;
  }
  core_init = sym(lib, "retro_init");
  core_deinit = sym(lib, "retro_deinit");
  core_set_environment = sym(lib, "retro_set_environment");
  core_set_video_refresh = sym(lib, "retro_set_video_refresh");
  core_set_audio_sample = sym(lib, "retro_set_audio_sample");
  core_set_audio_sample_batch = sym(lib, "retro_set_audio_sample_batch");
  core_set_input_poll = sym(lib, "retro_set_input_poll");
  core_set_input_state = sym(lib, "retro_set_input_state");
  core_load_game = sym(lib, "retro_load_game");
  core_run = sym(lib, "retro_run");
  core_reset = sym(lib, "retro_reset");
  core_get_memory_data = sym(lib, "retro_get_memory_data");
  core_get_memory_size = sym(lib, "retro_get_memory_size");
  core_set_controller_port_device = sym(lib, "retro_set_controller_port_device");

  core_set_environment(environment);
  core_init();
  core_set_video_refresh(video_refresh);
  core_set_audio_sample(audio_sample);
  core_set_audio_sample_batch(audio_batch);
  core_set_input_poll(input_poll);
  core_set_input_state(input_state);

  FILE *f = fopen(argv[2], "rb");
  if (!f) {
    fprintf(stderr, "ROM nicht lesbar: %s\n", argv[2]);
    return 2;
  }
  fseek(f, 0, SEEK_END);
  long size = ftell(f);
  fseek(f, 0, SEEK_SET);
  void *rom = malloc(size);
  if (fread(rom, 1, size, f) != (size_t)size) return 2;
  fclose(f);
  struct retro_game_info info = {argv[2], rom, (size_t)size, NULL};
  if (!core_load_game(&info)) {
    fprintf(stderr, "ROM wurde vom Kern abgelehnt\n");
    return 2;
  }
  core_set_controller_port_device(0, RETRO_DEVICE_JOYPAD);
  core_set_controller_port_device(1, RETRO_DEVICE_JOYPAD);
  printf("ok bereit\n");

  char line[8192];
  while (fgets(line, sizeof line, stdin)) {
    char cmd[16] = "", a[4096] = "", b[4096] = "", c[64] = "";
    int n = sscanf(line, "%15s %4095s %4095s %63s", cmd, a, b, c);
    if (n < 1) continue;
    if (!strcmp(cmd, "quit")) {
      printf("ok\n");
      break;
    } else if (!strcmp(cmd, "run")) {
      long frames = strtol(a, NULL, 10);
      for (long i = 0; i < frames; i++) core_run();
      printf("ok\n");
    } else if (!strcmp(cmd, "pad")) {
      unsigned port = strtoul(a, NULL, 10);
      if (port < 8) pads[port] = (uint16_t)strtoul(b, NULL, 16);
      printf("ok\n");
    } else if (!strcmp(cmd, "peek")) {
      cmd_peek(RETRO_MEMORY_SYSTEM_RAM, strtoul(a, NULL, 16), strtoul(b, NULL, 10));
    } else if (!strcmp(cmd, "poke")) {
      cmd_poke(RETRO_MEMORY_SYSTEM_RAM, strtoul(a, NULL, 16), b);
    } else if (!strcmp(cmd, "speek")) {
      cmd_peek(RETRO_MEMORY_SAVE_RAM, strtoul(a, NULL, 16), strtoul(b, NULL, 10));
    } else if (!strcmp(cmd, "spoke")) {
      cmd_poke(RETRO_MEMORY_SAVE_RAM, strtoul(a, NULL, 16), b);
    } else if (!strcmp(cmd, "until")) {
      uint8_t *mem = core_get_memory_data(RETRO_MEMORY_SYSTEM_RAM);
      unsigned long addr = strtoul(a, NULL, 16), value = strtoul(b, NULL, 16);
      long max = strtol(c, NULL, 10), i = 0;
      while (i < max && mem[addr] != value) core_run(), i++;
      if (mem[addr] == value) printf("ok %ld\n", i);
      else printf("fehler Zeitüberschreitung nach %ld Bildern\n", i);
    } else if (!strcmp(cmd, "shot")) {
      printf(write_png(a) ? "ok\n" : "fehler kein Bild\n");
    } else if (!strcmp(cmd, "audio")) {
      printf("ok %d\n", audio_peak);
      audio_peak = 0;
    } else if (!strcmp(cmd, "rec")) {
      free(rec_buf);
      rec_cap = 65536;
      rec_len = 0;
      rec_buf = malloc(rec_cap * sizeof(int16_t));
      printf("ok\n");
    } else if (!strcmp(cmd, "recsave")) {
      FILE *w = rec_buf ? fopen(a, "wb") : NULL;
      if (!w) {
        printf("fehler keine Aufnahme\n");
        continue;
      }
      uint32_t bytes = (uint32_t)(rec_len * 2), rate = 32040;
      uint8_t h[44] = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ', 16, 0, 0, 0, 1, 0, 2, 0};
      memcpy(h + 24, &rate, 4);
      uint32_t byterate = rate * 4;
      memcpy(h + 28, &byterate, 4);
      h[32] = 4, h[34] = 16;
      memcpy(h + 36, "data", 4);
      memcpy(h + 40, &bytes, 4);
      uint32_t riff = bytes + 36;
      memcpy(h + 4, &riff, 4);
      fwrite(h, 1, 44, w);
      fwrite(rec_buf, 2, rec_len, w);
      fclose(w);
      free(rec_buf);
      rec_buf = NULL;
      printf("ok %zu\n", rec_len / 2);
    } else if (!strcmp(cmd, "reset")) {
      core_reset();
      printf("ok\n");
    } else {
      printf("fehler unbekannter Befehl %s\n", cmd);
    }
  }
  core_deinit();
  return 0;
}
