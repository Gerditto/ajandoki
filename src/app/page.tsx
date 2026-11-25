export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="font-display text-4xl leading-tight">A meglepetés biztonságban van.</h1>
      <p className="text-lg text-muted">
        Kívánságlisták, titkos foglalás és igazságos ajándékhúzás a családnak, a barátoknak és a
        munkahelynek. Dupla ajándék nélkül.
      </p>
      <div className="rounded-card border border-border bg-secret-soft p-4 text-secret">
        <span aria-hidden>🔒</span> Amit lilával látsz, azt a megajándékozott soha nem látja.
      </div>
    </main>
  );
}
