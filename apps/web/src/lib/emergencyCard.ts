import { formatCode } from '@brett-und-blatt/ui/sync';
import { renderSVG } from 'uqr';

const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** Notfallkarte als druckbare Seite in einem neuen Fenster; nichts davon geht an einen Server. */
export function printEmergencyCard(card: { playerCode: string; syncCode: string }, link: string): void {
  const win = window.open('', '_blank', 'width=640,height=800');
  if (!win) return;
  const qr = renderSVG(link, { border: 2, whiteColor: '#ffffff', blackColor: '#000000' });
  win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Notfallkarte – Brett &amp; Blatt</title>
<style>body{font:16px system-ui,sans-serif;margin:24px;color:#000}.card{border:2px dashed #000;border-radius:16px;padding:24px;max-width:480px}
h1{font-size:22px;margin:0 0 8px}p{margin:6px 0}.code{font:700 26px ui-monospace,monospace;letter-spacing:2px;margin:10px 0}.qr{width:180px;margin:12px 0}.qr svg{width:100%;height:auto}</style></head>
<body><div class="card"><h1>🪪 Notfallkarte – Brett &amp; Blatt</h1>
<p>Sicherungscode (öffnet den Ausweis auch ohne PIN):</p><p class="code">${escape(formatCode(card.syncCode))}</p>
<p>Spielercode: <strong>${escape(card.playerCode)}</strong></p><div class="qr">${qr}</div>
<p>Gut aufbewahren und niemandem zeigen. Wer diese Karte hat, kann als du spielen.</p><p>spiele.lipponer.de</p></div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
}
