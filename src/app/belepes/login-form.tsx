'use client';
import { useActionState } from 'react';
import { sendMagicLink, type LoginState } from './actions';
import { Button, Field } from '@/components/ui';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.sent) {
    return (
      <div role="status" className="rounded-card border border-border bg-surface p-5">
        <p className="font-display text-xl">Nézd meg a postafiókodat!</p>
        <p className="mt-2 text-muted">
          Küldtünk egy belépő linket ide: <strong>{state.email}</strong>. Kattints rá ezen az eszközön.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="tovabb" value={next} />
      <Field
        label="E-mail-cím"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        error={state.errors?.email}
        hint="Jelszó nem kell: küldünk egy belépő linket."
      />
      <Button type="submit" disabled={pending}>
        {pending ? 'Küldés…' : 'Belépő link kérése'}
      </Button>
    </form>
  );
}
