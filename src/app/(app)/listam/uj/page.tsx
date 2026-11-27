import { ItemForm } from '../item-form';
export const metadata = { title: 'Új kívánság – Súgj!' };
export default function NewItemPage() {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="font-display text-3xl">Új kívánság</h1>
      <ItemForm />
    </div>
  );
}
