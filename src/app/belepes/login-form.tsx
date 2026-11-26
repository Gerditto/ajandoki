'use client';
import { useActionState, useState } from 'react';
import {
  sendMagicLink, signInWithPassword, signUpWithPassword, verifyCode, type LoginState,
} from './actions';
import { Button, Field } from '@/components/ui';

type Mode = 'login' | 'signup' | 'forgot';

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>('login');
  const [login, loginAction, loggingIn] = useActionState<LoginState, FormData>(signInWithPassword, {});
  const [signup, signupAction, signingUp] = useActionState<LoginState, FormData>(signUpWithPassword, {});
  const [forgot, forgotAction, sending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const [verify, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyCode, {});

  const tabs = (
    <div role="tablist" className="grid grid-cols-2 rounded-full border border-border p-1">
      {(['login', 'signup'] as const).map((m) => (
        <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
          className={`min-h-10 rounded-full text-sm font-medium ${mode === m ? 'bg-primary text-primary-contrast' : 'text-muted'}`}>
          {m === 'login' ? 'Belépés' : 'Regisztráció'}
        </button>
      ))}
    </div>
  );

  if (mode === 'forgot') {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-muted">Küldünk egy belépőkódot. Belépés után a Profil oldalon új jelszót adhatsz meg.</p>
        {!forgot.sent && (
          <form action={forgotAction} className="flex flex-col gap-4">
            <input type="hidden" name="tovabb" value={next} />
            <Field label="E-mail-cím" name="email" type="email" autoComplete="email" required
              defaultValue={forgot.email ?? login.email} error={forgot.errors?.email} />
            <Button type="submit" disabled={sending}>{sending ? 'Küldés…' : 'Belépőkód kérése'}</Button>
          </form>
        )}
        {(forgot.sent || forgot.email) && (
          <form action={verifyAction} className="flex flex-col gap-4">
            {forgot.sent && <p role="status">Elküldtük a kódot ide: <strong>{forgot.email}</strong></p>}
            <input type="hidden" name="email" value={forgot.email} />
            <Field label="Belépőkód" name="token" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]*" maxLength={10} required error={verify.errors?.token} />
            <Button type="submit" variant="ghost" disabled={verifying}>{verifying ? 'Ellenőrzés…' : 'Belépés kóddal'}</Button>
          </form>
        )}
        <button type="button" onClick={() => setMode('login')} className="text-sm text-muted underline">Vissza a belépéshez</button>
      </div>
    );
  }

  const state = mode === 'login' ? login : signup;
  return (
    <div className="flex flex-col gap-5">
      {tabs}
      {state.info ? (
        <p role="status" className="rounded-card border border-border bg-surface p-4">{state.info}</p>
      ) : (
        <form key={mode} action={mode === 'login' ? loginAction : signupAction} className="flex flex-col gap-4">
          <input type="hidden" name="tovabb" value={next} />
          <Field label="E-mail-cím" name="email" type="email" autoComplete="email" inputMode="email" required
            defaultValue={state.email} error={state.errors?.email} />
          <Field label="Jelszó" name="password" type="password" minLength={8} required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            hint={mode === 'signup' ? 'Legalább 8 karakter.' : undefined} error={state.errors?.password} />
          <Button type="submit" disabled={loggingIn || signingUp}>
            {mode === 'login' ? (loggingIn ? 'Belépés…' : 'Belépés') : (signingUp ? 'Regisztráció…' : 'Fiók létrehozása')}
          </Button>
        </form>
      )}
      {mode === 'login' && (
        <button type="button" onClick={() => setMode('forgot')} className="text-sm text-muted underline">
          Elfelejtettem a jelszavam
        </button>
      )}
    </div>
  );
}
