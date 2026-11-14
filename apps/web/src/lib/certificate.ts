import type { Trophy } from './pokale';

const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
/** Gemalte Bilder der Urkunde (#315): absolute Adressen, weil die Seite in einem neuen Fenster ohne Basisadresse entsteht. */
const ART = {
  paper: new URL('../assets/ehrung/urkunde-hoch.webp', import.meta.url).href,
  cup: new URL('../assets/ehrung/pokal-gold.webp', import.meta.url).href,
  chalice: new URL('../assets/ehrung/turnierkelch.webp', import.meta.url).href,
  sealRed: new URL('../assets/ehrung/siegel-rot.webp', import.meta.url).href,
  sealGold: new URL('../assets/ehrung/siegel-gold.webp', import.meta.url).href,
};
const LEVEL: Record<string, string> = { easy: 'leicht', medium: 'mittel', hard: 'schwer' };

/** Text der Urkunde (Wortlaut, ohne Gestaltung) – getrennt, damit er sich testen lässt. */
export function certificateText(trophy: Trophy, gameName: string, player: string): { title: string; lines: string[] } {
  const date = new Date(trophy.at).toLocaleDateString('de-DE', { dateStyle: 'long' });
  const who = player || 'Eine Spielerin oder ein Spieler';
  if (trophy.cert === 'turnier') return { title: 'Urkunde für den Turniersieg', lines: [`${who} hat am ${date} ein Turnier in „${gameName}“ gewonnen.`, trophy.opponents.length > 0 ? `Mitspielende: ${trophy.opponents.join(', ')}.` : ''] };
  return {
    title: 'Urkunde für einen besonderen Sieg',
    lines: [`${who} hat am ${date} in „${gameName}“ zum ersten Mal gegen den Computer auf der Stufe „${LEVEL[trophy.level ?? 'hard'] ?? 'schwer'}“ gewonnen.`, ''],
  };
}

/** Urkunde als druckbare Seite in einem neuen Fenster; nichts davon geht an einen Server. */
export function printCertificate(trophy: Trophy, gameName: string, player: string): void {
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return;
  const { title, lines } = certificateText(trophy, gameName, player);
  win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escape(title)} – Brett &amp; Blatt</title>
<style>@page{size:A4;margin:0}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:18px Georgia,serif;margin:0;color:#2a1c10}
.page{box-sizing:border-box;position:relative;width:210mm;height:297mm;margin:0 auto;padding:46mm 34mm 40mm;text-align:center;background:#f3e6c6 url(${ART.paper}) center/100% 100% no-repeat}
h1{font-size:34px;margin:8px 0 22px}.cup{height:34mm;width:34mm;object-fit:contain}p{margin:10px 0;line-height:1.5}.name{font-size:30px;font-weight:bold;margin:20px 0}.small{font-size:14px;margin-top:30px}
.seal{position:absolute;right:30mm;bottom:34mm;width:30mm;height:30mm;object-fit:contain}@media screen{body{background:#ddd;padding:12px}}</style></head>
<body><div class="page"><img class="cup" src="${trophy.cert === 'turnier' ? ART.chalice : ART.cup}" alt=""><h1>${escape(title)}</h1><p class="name">${escape(player || '')}</p>
${lines.filter(Boolean).map((line) => `<p>${escape(line)}</p>`).join('')}<p class="small">Brett &amp; Blatt · spiele.lipponer.de</p><img class="seal" src="${trophy.cert === 'turnier' ? ART.sealGold : ART.sealRed}" alt=""></div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
}
