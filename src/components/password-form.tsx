'use client';
import { useActionState } from 'react';
import { updatePassword, type LoginState } from '@/app/belepes/actions';
import { Button, Field } from '@/components/ui';

export function PasswordForm({ highlight }: { highlight?: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(updatePassword, {});
  return (
    <form action={action} className={`flex flex-col gap-4 ${highlight ? 'rounded-card border-2 border-primary p-4' : ''}`}>
      <h2 className="font-display text-xl">{highlight ? 'Adj meg új jelszót' : 'Jelszó módosítása'}</h2>
      <Field label="Új jelszó" name="password" type="password" autoComplete="new-password" minLength={8} required
        error={state.errors?.password} />
      {state.info && <p role="status" className="text-success">{state.info}</p>}
      <Button type="submit" variant="ghost" disabled={pending}>{pending ? 'Mentés…' : 'Jelszó mentése'}</Button>
    </form>
  );
}
