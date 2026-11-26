export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-1 flex-col justify-center bg-[#132f23] px-6 py-20 text-[#f3ead3]">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-7">
          <p className="text-xs uppercase tracking-[0.3em] text-[#d2b26a]">Ajándoki</p>
          <h1 className="text-4xl leading-tight text-[#f3ead3] sm:text-5xl">A meglepetés biztonságban van.</h1>
          <span className="ornament !w-16" aria-hidden />
          <p className="text-lg leading-relaxed text-[#f3ead3]/80">
            Kívánságlisták, titkos foglalás és igazságos ajándékhúzás a családnak, a barátoknak és a
            munkahelynek. Dupla ajándék nélkül.
          </p>
          <a href="/belepes"
            className="inline-flex min-h-12 w-fit items-center rounded-full bg-[#d2b26a] px-7 font-medium tracking-wide text-[#132f23] transition hover:bg-[#dcc07e]">
            Kezdjük
          </a>
        </div>
      </section>
      <section className="px-6 py-8">
        <p className="mx-auto max-w-xl text-sm text-muted">
          <span aria-hidden className="text-gold">🔒</span> Amit arany lakattal jelölünk, azt a megajándékozott soha nem látja.
        </p>
      </section>
    </main>
  );
}
