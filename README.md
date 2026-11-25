# Ajándoki

Intelligens, közösségi ajándékozási asszisztens: kívánságlisták, titkos foglalás,
csoportok és Secret Santa. Magyar elsőként, nemzetközi bővítésre tervezve.

A termékterv (versenytárselemzés, PRD, architektúra, adatmodell, MVP, ütemterv):
lásd a projekt tervdokumentumát.

## A legfontosabb szabály

A megajándékozott **kizárólag a saját maga által rögzített adatokat** látja.
A foglalások, titkos ötletek, megjegyzések és a sorsolás eredménye számára
adatbázisszinten lekérdezhetetlenek (PostgreSQL RLS), nem csak a felületen
rejtettek. Ezt a `supabase/tests/privacy.test.sql` minden változtatásnál ellenőrzi.

## Felépítés

| Mappa | Tartalom |
| --- | --- |
| `src/app` | Next.js (App Router) oldalak |
| `src/lib/supabase` | Supabase kliensek (böngésző, szerver, service role) |
| `src/lib/draw` | Secret Santa sorsoló algoritmus és tesztjei |
| `supabase/migrations` | Adatbázisséma, RLS-szabályok, üzleti függvények |
| `supabase/tests` | Titkossági és egyidejű foglalási tesztek |
| `scripts/test-db.sh` | Adatbázistesztek futtatása helyi PostgreSQL-en |

## Fejlesztés

```bash
pnpm install
cp .env.example .env.local   # Supabase URL és kulcsok
pnpm dev
```

Tesztek:

```bash
pnpm test        # egységtesztek (sorsolás)
pnpm test:db     # titkossági + 50 párhuzamos foglalás teszt (PostgreSQL 16 kell)
pnpm lint && pnpm typecheck
```

## Döntések

- **Titkosság az adatbázisban.** Minden titkos tábla RLS-sel zárja ki a címzettet;
  írni csak `security definer` függvényeken át lehet (`reserve_item`,
  `release_reservation`, `set_reservation_status`).
- **Dupla foglalás.** Részleges egyedi index (`reservations_one_active_per_item`)
  + sorzár a tételen. Csoportokon átnyúlóan is működik, és a válasz
  (`unavailable`) nem árulja el, ki vagy melyik csoportban foglalt.
- **Sorsolás a szerveren.** Az eredményt service role írja be; mindenki csak a
  saját sorát látja, a szervező sem lát mást (`draw_progress` csak azt mutatja,
  ki nézte meg).
- **Meghívókód.** Csak a SHA-256 hash-e tárolódik.
- **Betűk.** A `next/font` saját domainről szolgálja ki őket (nincs Google Fonts hívás).
