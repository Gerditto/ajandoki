'use client';
import { useActionState } from 'react';
import { sendMagicLink, verifyCode, type LoginState } from './actions';
import { Button, Field } from '@/components/ui';

export function LoginForm({ next }: { next: string }) {
  const [sent, sendAction, sending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const [verify, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyCode, {});

  if (sent.sent) {
    return (
      <div className="flex flex-col gap-5">
        <div role="status" className="rounded-card border border-border bg-surface p-5">
          <p className="font-display text-xl">Nézd meg a postafiókodat!</p>
          <p className="mt-2 text-muted">
            Küldtünk egy levelet ide: <strong>{sent.email}</strong>. Írd be az abban lévő kódot, vagy kattints a linkre.
          </p>
        </div>
        <form action={verifyAction} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={sent.email} />
          <input type="hidden" name="tovabb" value={next} />
          <Field label="Belépőkód" name="token" inputMode="numeric" autoComplete="one-time-code"
            pattern="[0-9]*" maxLength={10} required autoFocus error={verify.errors?.token}
            className="min-h-14 rounded-xl border border-border bg-surface px-3 text-center font-mono text-2xl tracking-[0.4em] outline-none focus:border-primary" />
          <Button type="submit" disabled={verifying}>{verifying ? 'Ellenőrzés…' : 'Belépés'}</Button>
        </form>
        <form action={sendAction}>
          <input type="hidden" name="email" value={sent.email} />
          <input type="hidden" name="tovabb" value={next} />
          <button className="text-sm text-muted underline" disabled={sending}>Nem jött meg? Új kód kérése</button>
        </form>
      </div>
    );
  }

  return (
    <form action={sendAction} className="flex flex-col gap-4">
      <input type="hidden" name="tovabb" value={next} />
      <Field label="E-mail-cím" name="email" type="email" autoComplete="email" inputMode="email" required
        defaultValue={sent.email} error={sent.errors?.email}
        hint="Jelszó nem kell: küldünk egy belépőkódot." />
      <Button type="submit" disabled={sending}>{sending ? 'Küldés…' : 'Belépőkód kérése'}</Button>
    </form>
  );
}
