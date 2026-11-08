import type { Trophy } from './pokale';

const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
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
<style>body{font:18px Georgia,serif;margin:0;padding:32px;color:#000}.page{border:6px double #000;border-radius:12px;padding:48px 36px;text-align:center;max-width:620px;margin:0 auto}
h1{font-size:34px;margin:12px 0 28px}.cup{font-size:72px}p{margin:10px 0;line-height:1.5}.name{font-size:30px;font-weight:bold;margin:20px 0}.small{font-size:14px;margin-top:36px}</style></head>
<body><div class="page"><div class="cup">🏆</div><h1>${escape(title)}</h1><p class="name">${escape(player || '')}</p>
${lines.filter(Boolean).map((line) => `<p>${escape(line)}</p>`).join('')}<p class="small">Brett &amp; Blatt · spiele.lipponer.de</p></div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
}
