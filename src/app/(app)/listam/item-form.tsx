'use client';
import { useActionState } from 'react';
import { saveOwnItem, type ItemState } from './actions';
import { Button, Field } from '@/components/ui';

export type ItemRow = {
  id: string; title: string; url: string | null; image_url: string | null;
  price_min: number | null; price_max: number | null; priority: number;
  category: string | null; size: string | null; color: string | null;
  occasion: string | null; substitutable: boolean; description: string | null;
};

export function ItemForm({ item }: { item?: ItemRow }) {
  const [state, action, pending] = useActionState<ItemState, FormData>(saveOwnItem, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {item && <input type="hidden" name="$id" value={item.id} />}
      <Field label="Mit szeretnél?" name="title" required defaultValue={item?.title} error={e.title}
        placeholder="pl. Kézzel festett kerámia bögre" />
      <Field label="Link (nem kötelező)" name="url" type="url" inputMode="url" defaultValue={item?.url ?? ''} error={e.url}
        placeholder="https://…" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ár ettől (Ft)" name="price_min" inputMode="numeric" defaultValue={item?.price_min ?? ''} error={e.price_min} />
        <Field label="Ár eddig (Ft)" name="price_max" inputMode="numeric" defaultValue={item?.price_max ?? ''} error={e.price_max} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Mennyire fontos?</legend>
        <div className="flex gap-2">
          {[[3, 'Nagyon'], [2, 'Örülnék neki'], [1, 'Ha belefér']].map(([v, l]) => (
            <label key={v} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-border px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="radio" name="priority" value={v} defaultChecked={(item?.priority ?? 2) === v} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <details className="rounded-xl border border-border p-3" open={!!(item?.size || item?.color || item?.category || item?.occasion || item?.description)}>
        <summary className="cursor-pointer text-sm font-medium">További részletek</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Méret" name="size" defaultValue={item?.size ?? ''} error={e.size} />
            <Field label="Szín" name="color" defaultValue={item?.color ?? ''} error={e.color} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategória" name="category" defaultValue={item?.category ?? ''} placeholder="pl. könyv, élmény" />
            <Field label="Alkalom" name="occasion" defaultValue={item?.occasion ?? ''} placeholder="pl. karácsony" />
          </div>
          <Field label="Kép linkje" name="image_url" type="url" defaultValue={item?.image_url ?? ''} error={e.image_url} />
          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-sm font-medium">Megjegyzés</label>
            <textarea id="description" name="description" rows={3} defaultValue={item?.description ?? ''}
              className="rounded-xl border border-border bg-surface p-3 outline-none focus:border-primary" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="substitutable" defaultChecked={item?.substitutable} className="size-5 accent-[var(--primary)]" />
            Hasonló is jó (nem kell pontosan ez a termék)
          </label>
        </div>
      </details>
      {e._ && <p role="alert" className="text-red-700 dark:text-red-300">{e._}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Mentés…' : 'Mentés'}</Button>
    </form>
  );
}
