/** Bietet Bytes oder Text als Datei zum Speichern an (im Browser; Safari auf iOS öffnet sie ggf. in einem neuen Tab). */
export function downloadFile(name: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Ein Dateiname ohne Pfad- und Sonderzeichen. */
export const safeFileName = (name: string, fallback = 'paket'): string => name.replace(/[^\p{L}\p{N}._ -]+/gu, '').trim().slice(0, 60) || fallback;
