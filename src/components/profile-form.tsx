'use client';
import { useActionState } from 'react';
import { saveProfile, type ProfileState } from '@/lib/profile-actions';
import { Button, Field } from '@/components/ui';

type Initial = { display_name?: string | null; birthday?: string | null; nameday?: string | null };

export function ProfileForm({ initial, onboarding = false, next }: { initial?: Initial; onboarding?: boolean; next?: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {onboarding && <input type="hidden" name="$onboarding" value="1" />}
      {next && <input type="hidden" name="$next" value={next} />}
      <Field label="Hogy szólíthatunk?" name="display_name" required autoComplete="given-name"
        defaultValue={initial?.display_name ?? ''} error={state.errors?.display_name} />
      <Field label="Születésnap (nem kötelező)" name="birthday" type="date"
        defaultValue={initial?.birthday ?? ''} error={state.errors?.birthday} />
      <Field label="Névnap (nem kötelező)" name="nameday" placeholder="pl. 07-26" pattern="\d{2}-\d{2}"
        defaultValue={initial?.nameday ?? ''} error={state.errors?.nameday}
        hint="Hónap-nap formában. Hamarosan névnapnaptárból is választhatsz." />
      {state.errors?._ && <p role="alert" className="text-red-700 dark:text-red-300">{state.errors._}</p>}
      {state.ok && <p role="status" className="text-success">Elmentve.</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Mentés…' : onboarding ? 'Tovább' : 'Mentés'}</Button>
    </form>
  );
}
