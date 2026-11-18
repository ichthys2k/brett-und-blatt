; Grafik und Klänge von Brett & Blatt 16 (erzeugt von werkzeuge/grafik.mjs und werkzeuge/klang.mjs)
.include "hdr.asm"

.section ".grafik" superfree
kacheln:
.incbin "res/kacheln.bin"
kacheln_ende:
farben:
.incbin "res/palette.bin"
.ends

.section ".klang1" superfree
klang_klick:
.incbin "res/klick.brr"
klang_klick_ende:
klang_setzen:
.incbin "res/setzen.brr"
klang_setzen_ende:
klang_start_brr:
.incbin "res/start.brr"
klang_start_ende:
.ends

.section ".klang2" superfree
klang_sieg:
.incbin "res/sieg.brr"
klang_sieg_ende:
klang_ende_brr:
.incbin "res/ende.brr"
klang_ende_ende:
.ends
