'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { emailSchema, fieldErrors } from '@/lib/validation/schemas';

export type LoginState = {
  sent?: boolean;
  email?: string;
  info?: string;
  errors?: Record<string, string>;
};

function safeNext(v: FormDataEntryValue | null) {
  const next = String(v ?? '/ma');
  return next.startsWith('/') && !next.startsWith('//') ? next : '/ma';
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Érvénytelen e-mail-cím'),
  password: z.string().min(8, 'A jelszó legalább 8 karakter legyen').max(72),
});

/** Belépés e-mail-címmel és jelszóval. */
export async function signInWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({ email: formData.get('email'), password: formData.get('password') });
  const email = String(formData.get('email') ?? '');
  if (!parsed.success) return { email, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const unconfirmed = /confirm/i.test(error.message);
    return {
      email,
      errors: {
        password: unconfirmed
          ? 'Ezt az e-mail-címet még meg kell erősítened a kapott levélben.'
          : 'Hibás e-mail-cím vagy jelszó.',
      },
    };
  }
  redirect(safeNext(formData.get('tovabb')));
}

/** Regisztráció e-mail-címmel és jelszóval. */
export async function signUpWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({ email: formData.get('email'), password: formData.get('password') });
  const email = String(formData.get('email') ?? '');
  if (!parsed.success) return { email, errors: fieldErrors(parsed.error) };

  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/confirm?tovabb=%2Fbemutatkozas` },
  });
  if (error) {
    if (/registered|exists/i.test(error.message)) {
      return { email, errors: { email: 'Ezzel a címmel már van fiók. Lépj be, vagy kérj új jelszót.' } };
    }
    if (/weak|pwned|password/i.test(error.message)) {
      return { email, errors: { password: 'Ez a jelszó túl gyenge vagy kiszivárgott. Válassz másikat.' } };
    }
    return { email, errors: { email: 'Most nem sikerült a regisztráció. Próbáld újra pár perc múlva.' } };
  }
  // Ha a Supabase-ben ki van kapcsolva az e-mail-megerősítés, azonnal van munkamenet.
  if (data.session) redirect('/bemutatkozas');
  return { email, info: 'Küldtünk egy megerősítő levelet. Kattints a benne lévő linkre, utána be tudsz lépni.' };
}

/** Elfelejtett jelszó: belépőkód küldése e-mailben (utána a profilban új jelszó adható meg). */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const next = safeNext(formData.get('tovabb'));
  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm?tovabb=${encodeURIComponent(next)}` },
  });
  if (error) {
    const rate = error.status === 429 || /rate/i.test(error.message);
    return {
      email: parsed.data.email,
      errors: {
        email: rate
          ? 'Túl sok levelet kértél. Várj pár percet, vagy használd a legutóbb kapott kódot.'
          : 'Most nem sikerült elküldeni a levelet. Próbáld újra pár perc múlva.',
      },
    };
  }
  return { sent: true, email: parsed.data.email };
}

const codeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().regex(/^\d{6,10}$/, 'A kód számjegyekből áll (a levélben találod).'),
});

export async function verifyCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = codeSchema.safeParse({ email: formData.get('email'), token: formData.get('token') });
  if (!parsed.success) return { ...prev, errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.token, type: 'email' });
  if (error) return { ...prev, errors: { token: 'Hibás vagy lejárt kód. Kérj újat!' } };
  redirect('/profil?uj-jelszo=1');
}

const newPassword = z.object({ password: z.string().min(8, 'Legalább 8 karakter').max(72) });

/** Jelszó beállítása/módosítása bejelentkezve. */
export async function updatePassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = newPassword.safeParse({ password: formData.get('password') });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { errors: { password: 'Nem sikerült menteni. Válassz erősebb jelszót, vagy próbáld újra.' } };
  return { info: 'Az új jelszavad elmentve.' };
}
