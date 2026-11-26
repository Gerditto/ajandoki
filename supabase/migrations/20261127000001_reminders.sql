-- =============================================================================
-- Emlékeztetők: beállítás a profilban + napló a dupla küldés ellen.
-- =============================================================================

alter table public.profiles
  add column if not exists email_reminders boolean not null default true;

-- Minden elküldött email egy sor; a key egyedi (pl. "digest:<profil>:2026-12-01").
-- RLS bekapcsolva, policy nincs: csak a szerver (service role) éri el.
create table if not exists public.email_log (
  key         text primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  sent_at     timestamptz not null default now()
);
alter table public.email_log enable row level security;
create index if not exists email_log_profile_idx on public.email_log (profile_id, sent_at desc);

-- A napi futás lejártatja a régi foglalásokat.
grant execute on function public.expire_reservations() to service_role;
