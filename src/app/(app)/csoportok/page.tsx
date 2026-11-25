import { Card } from '@/components/ui';
export const metadata = { title: 'Csoportok – Ajándoki' };
export default function GroupsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Csoportok</h1>
      <Card><p className="text-muted">A csoportok és a meghívók a következő lépésben érkeznek.</p></Card>
    </div>
  );
}
