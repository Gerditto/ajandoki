'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { emailSchema, fieldErrors } from '@/lib/validation/schemas';

export type LoginState = { sent?: boolean; email?: string; next?: string; errors?: Record<string, string> };

function safeNext(v: FormDataEntryValue | null) {
  const next = String(v ?? '/ma');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/ma';
}

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const next = safeNext(formData.get('tovabb'));
  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/confirm?tovabb=${encodeURIComponent(next)}` },
  });
  if (error) {
    const rate = error.status === 429 || /rate/i.test(error.message);
    return {
      errors: {
        email: rate
          ? 'Túl sok belépő levelet kértél. Várj pár percet, vagy használd a legutóbb kapott kódot.'
          : 'Most nem sikerült elküldeni a levelet. Próbáld újra pár perc múlva.',
      },
      email: parsed.data.email,
    };
  }
  return { sent: true, email: parsed.data.email, next };
}

const codeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().regex(/^\d{6,10}$/, 'A kód számjegyekből áll (a levélben találod).'),
});

/** Belépés a levélben kapott számkóddal: bármelyik eszközön, böngészőváltás nélkül működik. */
export async function verifyCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = codeSchema.safeParse({ email: formData.get('email'), token: formData.get('token') });
  if (!parsed.success) return { ...prev, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.token, type: 'email' });
  if (error) return { ...prev, errors: { token: 'Hibás vagy lejárt kód. Kérj újat!' } };
  redirect(safeNext(formData.get('tovabb')));
}
