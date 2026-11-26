'use client';
import { useActionState } from 'react';
import { createDraw, type DrawFormState } from './actions';
import { Button, Field } from '@/components/ui';

type Member = { id: string; name: string };

export function NewDrawForm({ groupId, members, previousDraws }: {
  groupId: string; members: Member[]; previousDraws: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<DrawFormState, FormData>(createDraw, {});
  const year = new Date().getFullYear();
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="group_id" value={groupId} />
      <Field label="Megnevezés" name="name" required defaultValue={`Karácsony ${year}`} error={state.errors?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ajándékozás napja" name="event_date" type="date" defaultValue={`${year}-12-24`} error={state.errors?.event_date} />
        <Field label="Értékhatár (Ft)" name="budget" inputMode="numeric" placeholder="pl. 5000" hint="Nem kötelező" error={state.errors?.budget} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Résztvevők</legend>
        {members.map((m) => (
          <label key={m.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-3 has-[:checked]:border-gold">
            <input type="checkbox" name="participants" value={m.id} defaultChecked className="size-4 accent-[var(--primary)]" />
            {m.name}
          </label>
        ))}
        {state.errors?.participants && <p className="text-sm text-red-700 dark:text-red-300">{state.errors.participants}</p>}
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="forbid_mutual" defaultChecked className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>Ne húzhassák egymást kölcsönösen<br /><span className="text-muted">Ha Anna Bélát húzza, Béla nem húzhatja Annát.</span></span>
      </label>

      {previousDraws.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Ne ismétlődjenek a párok ebből a sorsolásból</span>
          <select name="exclude_previous_draw" defaultValue={previousDraws[0].id}
            className="min-h-11 rounded-xl border border-border bg-surface px-3">
            <option value="">Mindegy</option>
            {previousDraws.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      )}

      {state.errors?._ && <p role="alert" className="text-red-700 dark:text-red-300">{state.errors._}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Mentés…' : 'Tovább a kizárásokhoz'}</Button>
    </form>
  );
}
