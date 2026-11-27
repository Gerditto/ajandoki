import { JoinGroupForm } from '../../csoportok/forms';

export const metadata = { title: 'Csatlakozás – Súgj!' };

export default async function JoinPage({ params }: PageProps<'/csatlakozas/[kod]'>) {
  const { kod } = await params;
  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className="font-display text-3xl">Meghívást kaptál!</h1>
      <p className="text-muted">Csatlakozz a csoporthoz, és lásd, minek örülnének a többiek. Amit lefoglalsz, azt az ünnepelt soha nem látja.</p>
      <JoinGroupForm initialCode={decodeURIComponent(kod)} />
    </div>
  );
}
