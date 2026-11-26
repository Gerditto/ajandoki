/**
 * Az időzített futás belső azonosítója: a titkos service kulcsból származtatott hash.
 * Így nem kell külön titkot felvenni, kívülről pedig nem hívható meg a végpont.
 */
export async function cronKey(serviceKey: string): Promise<string> {
  const data = new TextEncoder().encode(`ajandoki-cron:${serviceKey}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
