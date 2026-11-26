'use client';
import { useActionState, useRef, useEffect } from 'react';
import { addSecretIdea, addSecretNote, type ActionState } from './actions';
import { Button, Field } from '@/components/ui';

export function SecretIdeaForm({ recipientId }: { recipientId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addSecretIdea, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="$recipient" value={recipientId} />
      <Field label="Ötlet" name="title" required error={state.errors?.title} placeholder="pl. Fazekas workshop" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Link" name="url" type="url" error={state.errors?.url} />
        <Field label="Kb. ár (Ft)" name="price_max" inputMode="numeric" error={state.errors?.price_max} />
      </div>
      {state.message && <p role="status" className="text-sm text-success">{state.message}</p>}
      <Button type="submit" variant="secret" disabled={pending}>🔒 Titkos ötlet mentése</Button>
    </form>
  );
}

export function SecretNoteForm({ recipientId, groups }: { recipientId: string; groups: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addSecretNote, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="$recipient" value={recipientId} />
      <textarea name="body" rows={2} required placeholder="pl. „Én a társasjátékot veszem, ki szállt be a bögrébe?”"
        className="rounded-xl border border-border bg-surface p-3 outline-none focus:border-secret" />
      {groups.length > 1 ? (
        <select name="group_id" className="min-h-11 rounded-xl border border-border bg-surface px-3">
          {groups.map((g) => <option key={g.id} value={g.id}>Látja: {g.name}</option>)}
        </select>
      ) : (
        <input type="hidden" name="group_id" value={groups[0]?.id} />
      )}
      {(state.errors?.body || state.errors?._) && <p className="text-sm text-red-700 dark:text-red-300">{state.errors.body ?? state.errors._}</p>}
      <Button type="submit" variant="secret" disabled={pending}>🔒 Megjegyzés küldése</Button>
    </form>
  );
}
