import 'server-only';

export type Email = { to: string; subject: string; html: string; text: string };

/** Az app nyilvános címe (linkekhez az emailekben). */
export function appUrl() {
  return (process.env.APP_URL ?? 'https://ajandoki.prekopagerda-0.workers.dev').replace(/\/$/, '');
}

export function emailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_FROM);
}

/** Küldés a Brevo tranzakciós API-ján. Hiba esetén false, nem dob. */
export async function sendEmail(email: Email): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: from, name: 'Súgj!' },
        to: [{ email: email.to }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
      }),
    });
    if (!res.ok) console.error('brevo_send_failed', res.status, await res.text().catch(() => ''));
    return res.ok;
  } catch (e) {
    console.error('brevo_send_error', e);
    return false;
  }
}
