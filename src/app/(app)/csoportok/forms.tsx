'use client';
import { useActionState, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { createGroup, createInvite, joinGroup, type GroupState } from './actions';
import { Button, Card, Field } from '@/components/ui';

export function CreateGroupForm() {
  const [state, action, pending] = useActionState<GroupState, FormData>(createGroup, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Csoport neve" name="name" required placeholder="pl. Család, Kollégák" error={state.errors?.name} />
      <fieldset className="flex gap-2">
        <legend className="mb-2 text-sm font-medium">Típus</legend>
        {[['permanent', 'Állandó'], ['occasional', 'Alkalmi']].map(([v, l]) => (
          <label key={v} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-border text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <input type="radio" name="kind" value={v} defaultChecked={v === 'permanent'} className="sr-only" />{l}
          </label>
        ))}
      </fieldset>
      {state.errors?._ && <p role="alert" className="text-red-700 dark:text-red-300">{state.errors._}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Létrehozás…' : 'Csoport létrehozása'}</Button>
    </form>
  );
}

export function JoinGroupForm({ initialCode = '' }: { initialCode?: string }) {
  const [state, action, pending] = useActionState<GroupState, FormData>(joinGroup, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Meghívókód" name="code" required defaultValue={initialCode} autoCapitalize="characters"
        className="min-h-12 rounded-xl border border-border bg-surface px-3 font-mono text-lg uppercase tracking-widest outline-none focus:border-primary"
        error={state.errors?.code} />
      <Button type="submit" disabled={pending}>{pending ? 'Csatlakozás…' : 'Csatlakozom'}</Button>
    </form>
  );
}

export function InvitePanel({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [state, action, pending] = useActionState<GroupState, FormData>(createInvite, {});
  const [qr, setQr] = useState<string>();
  const [copied, setCopied] = useState(false);
  const link = state.code && typeof window !== 'undefined' ? `${window.location.origin}/csatlakozas/${state.code}` : '';

  useEffect(() => {
    if (link) QRCode.toDataURL(link, { margin: 1, width: 240 }).then(setQr);
  }, [link]);

  if (!state.code) {
    return (
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="group_id" value={groupId} />
        <Button type="submit" disabled={pending}>{pending ? 'Készül…' : '+ Tagok meghívása'}</Button>
        {state.errors?._ && <p className="text-sm text-red-700 dark:text-red-300">{state.errors._}</p>}
      </form>
    );
  }

  const share = async () => {
    const text = `Csatlakozz a(z) „${groupName}” csoporthoz az Ajándokiban! Meghívókód: ${state.code}`;
    if (navigator.share) {
      await navigator.share({ title: 'Meghívó', text, url: link }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setCopied(true);
    }
  };

  return (
    <Card className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted">Meghívókód (14 napig érvényes)</p>
      <p className="font-mono text-3xl tracking-[0.3em]">{state.code}</p>
      {qr && <img src={qr} alt="QR-kód a csatlakozáshoz" width={200} height={200} className="rounded-lg bg-white p-2" />}
      <Button type="button" onClick={share}>{copied ? 'Vágólapra másolva ✓' : 'Megosztás / link másolása'}</Button>
      <p className="text-xs text-muted">A kódot biztonsági okokból csak most látod. Később bármikor kérhetsz újat.</p>
    </Card>
  );
}
