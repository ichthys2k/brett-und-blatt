; Grafik und Klänge von Brett & Blatt 16 (erzeugt von werkzeuge/grafik.mjs und werkzeuge/klang.mjs)
.include "hdr.asm"

.section ".grafik1" superfree
kacheln_a:
.incbin "res/kacheln_a.bin"
kacheln_a_ende:
farben:
.incbin "res/palette.bin"
.ends

.section ".grafik2" superfree
kacheln_b:
.incbin "res/kacheln_b.bin"
kacheln_b_ende:
karten:
.incbin "res/karten.bin"
spielfarben:
.incbin "res/spielfarben.bin"
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
klang_wuerfeln:
.incbin "res/wuerfeln.brr"
klang_wuerfeln_ende:
klang_karte:
.incbin "res/karte.brr"
klang_karte_ende:
.ends

.section ".grafik_schach" superfree
schach_bg:
.incbin "res/schach_bg.bin"
schach_bg_ende:
schach_bg_pal:
.incbin "res/schach_bg_pal.bin"
schach_spr_pal:
.incbin "res/schach_spr_pal.bin"
schach_spr_pal_ende:
.ends

.section ".grafik_schach_spr" superfree
schach_spr:
.incbin "res/schach_spr.bin"
schach_spr_ende:
.ends

.section ".grafik_karten" superfree
karten_bg:
.incbin "res/karten_bg.bin"
karten_bg_ende:
karten_bg_pal:
.incbin "res/karten_bg_pal.bin"
.ends

.section ".grafik_brett" superfree
brett_bg:
.incbin "res/brett_bg.bin"
brett_bg_ende:
brett_bg_pal:
.incbin "res/brett_bg_pal.bin"
.ends
