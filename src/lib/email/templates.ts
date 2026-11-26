/** Ünnepélyes, egyszerű HTML levélsablon (mélyzöld + arany), táblázatos elrendezés a levelezők miatt. */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type Line = { title: string; detail?: string; href?: string };

export function layout(opts: { heading: string; intro?: string; lines?: Line[]; cta?: { label: string; href: string }; footer: string }) {
  const lines = (opts.lines ?? [])
    .map((l) => `<tr><td style="padding:12px 0;border-bottom:1px solid #e3dac6">
      <div style="font-size:16px;color:#16241d;font-weight:600">${l.href ? `<a href="${esc(l.href)}" style="color:#1c4532;text-decoration:none">${esc(l.title)}</a>` : esc(l.title)}</div>
      ${l.detail ? `<div style="font-size:14px;color:#5e6a62;margin-top:2px">${esc(l.detail)}</div>` : ''}
    </td></tr>`)
    .join('');
  return `<!doctype html><html lang="hu"><body style="margin:0;background:#f6f2e8;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f2e8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf7;border:1px solid #e3dac6;border-radius:14px">
<tr><td style="background:#163a2a;border-radius:14px 14px 0 0;padding:22px 28px">
  <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#d2b26a">Ajándoki</div>
</td></tr>
<tr><td style="padding:28px">
  <h1 style="margin:0 0 6px;font-family:Georgia,serif;font-weight:500;font-size:24px;color:#1c4532">${esc(opts.heading)}</h1>
  <div style="width:48px;height:1px;background:#b48a3c;margin:12px 0 16px"></div>
  ${opts.intro ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#16241d">${esc(opts.intro)}</p>` : ''}
  ${lines ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}</table>` : ''}
  ${opts.cta ? `<p style="margin:24px 0 0"><a href="${esc(opts.cta.href)}" style="display:inline-block;background:#1c4532;color:#fbf6e9;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${esc(opts.cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:12px;line-height:1.5;color:#5e6a62">${esc(opts.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function plainText(opts: { heading: string; intro?: string; lines?: Line[]; cta?: { label: string; href: string }; footer: string }) {
  return [
    opts.heading,
    '',
    opts.intro ?? '',
    ...(opts.lines ?? []).map((l) => `• ${l.title}${l.detail ? ` – ${l.detail}` : ''}`),
    '',
    opts.cta ? `${opts.cta.label}: ${opts.cta.href}` : '',
    '',
    opts.footer,
  ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
}
