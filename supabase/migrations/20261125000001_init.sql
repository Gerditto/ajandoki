-- =============================================================================
-- Ajándoki – kezdeti séma
--
-- Alapelv: a megajándékozott (recipient) számára a titkos adatok nem "elrejtve"
-- vannak, hanem lekérdezhetetlenek. Minden titkos táblán RLS-szabály zárja ki
-- a címzettet, és a supabase/tests alatti tesztek ezt ellenőrzik.
--
-- Titkos táblák: reservations, item_marks, secret_notes, draw_assignments,
-- valamint az items tábla origin <> 'owner' sorai.
-- =============================================================================

-- Supabase-ben a pgcrypto az "extensions" sémában él.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Típusok
-- -----------------------------------------------------------------------------
create type public.group_kind as enum ('permanent', 'occasional');
create type public.member_role as enum ('owner', 'admin', 'member', 'guest');
create type public.item_origin as enum ('owner', 'giver', 'ai');
create type public.reservation_status as enum (
  'reserved', 'ordered', 'arrived', 'wrapped', 'given', 'released', 'expired'
);
create type public.mark_kind as enum ('not_relevant', 'already_has');
create type public.detail_visibility as enum ('groups', 'selected', 'private');
create type public.draw_status as enum ('draft', 'drawn', 'closed');

-- -----------------------------------------------------------------------------
-- Profilok
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 80),
  avatar_path   text,
  birthday      date,
  nameday       text check (nameday ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  locale        text not null default 'hu',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Opcionális, mezőnkénti láthatóságú profiladatok (méret, szín, illat, hobbi…)
create table public.profile_details (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  key         text not null check (char_length(key) between 1 and 40),
  value       text not null check (char_length(value) <= 500),
  visibility  public.detail_visibility not null default 'groups',
  created_at  timestamptz not null default now()
);
create index on public.profile_details (profile_id);

-- -----------------------------------------------------------------------------
-- Csoportok
-- -----------------------------------------------------------------------------
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  kind        public.group_kind not null default 'permanent',
  ends_at     timestamptz,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id         uuid not null references public.groups (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  role             public.member_role not null default 'member',
  shares_wishlist  boolean not null default true,  -- látja-e a csoport a listámat
  joined_at        timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index on public.group_members (profile_id);

-- Mezők, amelyek csak kiválasztott csoportoknak látszanak (visibility = 'selected')
create table public.profile_detail_groups (
  detail_id  uuid not null references public.profile_details (id) on delete cascade,
  group_id   uuid not null references public.groups (id) on delete cascade,
  primary key (detail_id, group_id)
);

-- Meghívókód: csak a hash-t tároljuk, a kódot egyszer mutatjuk meg.
create table public.group_invites (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  code_hash   text not null unique,
  role        public.member_role not null default 'member' check (role in ('member', 'guest')),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  expires_at  timestamptz,
  max_uses    int check (max_uses is null or max_uses > 0),
  uses        int not null default 0,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Kívánságok és titkos ötletek
-- origin = 'owner'  → a címzett saját kívánsága (ő látja, változatlanul)
-- origin = 'giver'  → ajándékozó titkos ötlete (a címzett soha nem látja)
-- origin = 'ai'     → AI-ötlet, amit egy ajándékozó mentett (a címzett soha nem látja)
-- -----------------------------------------------------------------------------
create table public.items (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  created_by     uuid not null references public.profiles (id) on delete cascade,
  origin         public.item_origin not null default 'owner',
  title          text not null check (char_length(title) between 1 and 200),
  url            text check (url is null or url ~* '^https?://'),
  image_url      text check (image_url is null or image_url ~* '^https?://'),
  price_min      numeric(12, 2) check (price_min is null or price_min >= 0),
  price_max      numeric(12, 2) check (price_max is null or price_max >= 0),
  currency       char(3) not null default 'HUF',
  priority       smallint not null default 2 check (priority between 1 and 3),
  category       text,
  size           text,
  color          text,
  occasion       text,
  substitutable  boolean not null default false,
  description    text check (char_length(description) <= 2000),
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint owner_items_created_by_owner check (
    (origin = 'owner') = (created_by = recipient_id)
  ),
  constraint price_range check (price_min is null or price_max is null or price_min <= price_max)
);
create index on public.items (recipient_id);

-- Foglalások. Egy tételnek egyszerre csak egy aktív foglalása lehet –
-- csoportoktól függetlenül, mert a foglalás a tételhez tartozik.
create table public.reservations (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.items (id) on delete cascade,
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  giver_id      uuid not null references public.profiles (id) on delete cascade,
  status        public.reservation_status not null default 'reserved',
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (giver_id <> recipient_id)
);
create unique index reservations_one_active_per_item
  on public.reservations (item_id)
  where status in ('reserved', 'ordered', 'arrived', 'wrapped', 'given');
create index on public.reservations (giver_id);
create index on public.reservations (status, expires_at) where status = 'reserved';

-- "Nem releváns" / "már megvan" jelölés – az eredeti kívánságot nem módosítja.
create table public.item_marks (
  item_id     uuid not null references public.items (id) on delete cascade,
  giver_id    uuid not null references public.profiles (id) on delete cascade,
  kind        public.mark_kind not null,
  created_at  timestamptz not null default now(),
  primary key (item_id, giver_id)
);

-- Titkos megjegyzések egy személyről (opcionálisan egy tételről), csoporton belül.
create table public.secret_notes (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  item_id       uuid references public.items (id) on delete cascade,
  group_id      uuid not null references public.groups (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 2000),
  created_at    timestamptz not null default now(),
  check (author_id <> recipient_id)
);
create index on public.secret_notes (recipient_id, group_id);

-- -----------------------------------------------------------------------------
-- Háztartások (sorsolási kizáráshoz)
-- -----------------------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  name        text not null,
  created_by  uuid not null references public.profiles (id) on delete cascade
);
create table public.household_members (
  household_id  uuid not null references public.households (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  primary key (household_id, profile_id)
);

-- -----------------------------------------------------------------------------
-- Secret Santa
-- -----------------------------------------------------------------------------
create table public.draws (
  id                    uuid primary key default gen_random_uuid(),
  group_id              uuid not null references public.groups (id) on delete cascade,
  name                  text not null check (char_length(name) between 1 and 120),
  event_date            date,
  budget_amount         numeric(12, 2) check (budget_amount is null or budget_amount >= 0),
  currency              char(3) not null default 'HUF',
  forbid_mutual         boolean not null default true,
  exclude_households    boolean not null default true,
  exclude_previous_draw uuid references public.draws (id) on delete set null,
  status                public.draw_status not null default 'draft',
  created_by            uuid not null references public.profiles (id) on delete cascade,
  drawn_at              timestamptz,
  created_at            timestamptz not null default now()
);

create table public.draw_participants (
  draw_id     uuid not null references public.draws (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  pool        text not null default 'main',  -- pl. 'kids' / 'adults' külön sorsolás
  primary key (draw_id, profile_id)
);

-- Egyirányú kizárás; a kölcsönöset két sor jelenti.
create table public.draw_exclusions (
  draw_id      uuid not null references public.draws (id) on delete cascade,
  giver_id     uuid not null references public.profiles (id) on delete cascade,
  receiver_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (draw_id, giver_id, receiver_id),
  check (giver_id <> receiver_id)
);

-- Az eredmény. Mindenki CSAK a saját sorát látja; a szervező sem lát mást.
-- Írni kizárólag a szerveroldali sorsoló tud (service role).
create table public.draw_assignments (
  draw_id      uuid not null references public.draws (id) on delete cascade,
  giver_id     uuid not null references public.profiles (id) on delete cascade,
  receiver_id  uuid not null references public.profiles (id) on delete cascade,
  seen_at      timestamptz,
  primary key (draw_id, giver_id),
  unique (draw_id, receiver_id),
  check (giver_id <> receiver_id)
);

-- -----------------------------------------------------------------------------
-- Értesítések (a foglalási műveletek SOHA nem írnak ide a címzettnek)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.notifications (profile_id, created_at desc);

-- =============================================================================
-- Segédfüggvények (security definer: RLS-rekurzió nélkül kérdeznek)
-- =============================================================================
create or replace function public.is_group_member(p_group uuid, p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members where group_id = p_group and profile_id = p_profile
  );
$$;

create or replace function public.is_group_admin(p_group uuid, p_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = p_group and profile_id = p_profile and role in ('owner', 'admin')
  );
$$;

create or replace function public.shares_group(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members a
    join group_members b on b.group_id = a.group_id
    where a.profile_id = p_a and b.profile_id = p_b
  );
$$;

-- Láthatja-e p_viewer p_recipient kívánságlistáját (és ajándékozhat-e neki)?
create or replace function public.can_give_to(p_viewer uuid, p_recipient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_viewer is not null
     and p_viewer <> p_recipient
     and exists (
       select 1 from group_members v
       join group_members r on r.group_id = v.group_id
       where v.profile_id = p_viewer
         and r.profile_id = p_recipient
         and r.shares_wishlist
     );
$$;

-- 'selected' láthatóságú mező: van-e közös, kiválasztott csoport.
create or replace function public.detail_shared_with(p_detail uuid, p_owner uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile_detail_groups dg
    where dg.detail_id = p_detail
      and is_group_member(dg.group_id, p_viewer)
      and is_group_member(dg.group_id, p_owner)
  );
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.profiles              enable row level security;
alter table public.profile_details       enable row level security;
alter table public.profile_detail_groups enable row level security;
alter table public.groups                enable row level security;
alter table public.group_members         enable row level security;
alter table public.group_invites         enable row level security;
alter table public.items                 enable row level security;
alter table public.reservations          enable row level security;
alter table public.item_marks            enable row level security;
alter table public.secret_notes          enable row level security;
alter table public.households            enable row level security;
alter table public.household_members     enable row level security;
alter table public.draws                 enable row level security;
alter table public.draw_participants     enable row level security;
alter table public.draw_exclusions       enable row level security;
alter table public.draw_assignments      enable row level security;
alter table public.notifications         enable row level security;

-- profiles --------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group(auth.uid(), id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- profile_details -------------------------------------------------------------
create policy details_select on public.profile_details for select to authenticated
  using (
    profile_id = auth.uid()
    or (visibility = 'groups' and public.shares_group(auth.uid(), profile_id))
    or (visibility = 'selected' and public.detail_shared_with(id, profile_id, auth.uid()))
  );
create policy details_write on public.profile_details for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy detail_groups_select on public.profile_detail_groups for select to authenticated
  using (exists (select 1 from public.profile_details d
                 where d.id = detail_id and d.profile_id = auth.uid()));
create policy detail_groups_write on public.profile_detail_groups for all to authenticated
  using (exists (select 1 from public.profile_details d
                 where d.id = detail_id and d.profile_id = auth.uid()))
  with check (exists (select 1 from public.profile_details d
                      where d.id = detail_id and d.profile_id = auth.uid())
              and public.is_group_member(group_id, auth.uid()));

-- groups ----------------------------------------------------------------------
create policy groups_select on public.groups for select to authenticated
  using (public.is_group_member(id, auth.uid()));
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_admin(id, auth.uid())) with check (public.is_group_admin(id, auth.uid()));
create policy groups_delete on public.groups for delete to authenticated
  using (exists (select 1 from public.group_members m
                 where m.group_id = id and m.profile_id = auth.uid() and m.role = 'owner'));
-- Létrehozás: create_group() függvénnyel (a tulajdonosi tagsággal együtt).

-- group_members ---------------------------------------------------------------
create policy members_select on public.group_members for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));
create policy members_update_self on public.group_members for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid()
              and role = (select m.role from public.group_members m
                          where m.group_id = group_members.group_id and m.profile_id = auth.uid()));
create policy members_delete on public.group_members for delete to authenticated
  using (profile_id = auth.uid() or public.is_group_admin(group_id, auth.uid()));
-- Csatlakozás: join_group() függvénnyel.

-- group_invites ---------------------------------------------------------------
create policy invites_select on public.group_invites for select to authenticated
  using (public.is_group_admin(group_id, auth.uid()));
create policy invites_delete on public.group_invites for delete to authenticated
  using (public.is_group_admin(group_id, auth.uid()));
-- Létrehozás: create_invite() függvénnyel.

-- items -----------------------------------------------------------------------
-- A címzett KIZÁRÓLAG a saját maga által rögzített tételeket látja.
create policy items_select on public.items for select to authenticated
  using (
    (recipient_id = auth.uid() and origin = 'owner')
    or public.can_give_to(auth.uid(), recipient_id)
  );
create policy items_insert on public.items for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      (origin = 'owner' and recipient_id = auth.uid())
      or (origin in ('giver', 'ai') and public.can_give_to(auth.uid(), recipient_id))
    )
  );
create policy items_update on public.items for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid()
              and (origin = 'owner') = (recipient_id = auth.uid()));
create policy items_delete on public.items for delete to authenticated
  using (created_by = auth.uid());

-- reservations ----------------------------------------------------------------
-- Közvetlenül csak a saját foglalásomat látom. A többi ajándékozó a
-- gift_status_for() függvényen át csak annyit lát: "foglalt". Írni kizárólag
-- a reserve_item / release_reservation / set_reservation_status függvény tud.
create policy reservations_select_own on public.reservations for select to authenticated
  using (giver_id = auth.uid());

-- item_marks ------------------------------------------------------------------
create policy marks_select_own on public.item_marks for select to authenticated
  using (giver_id = auth.uid());
create policy marks_write on public.item_marks for all to authenticated
  using (giver_id = auth.uid())
  with check (
    giver_id = auth.uid()
    and public.can_give_to(auth.uid(), (select i.recipient_id from public.items i where i.id = item_id))
  );

-- secret_notes ----------------------------------------------------------------
create policy notes_select on public.secret_notes for select to authenticated
  using (recipient_id <> auth.uid() and public.is_group_member(group_id, auth.uid()));
create policy notes_insert on public.secret_notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and recipient_id <> auth.uid()
    and public.is_group_member(group_id, auth.uid())
    and public.is_group_member(group_id, recipient_id)
    and (item_id is null or exists (
          select 1 from public.items i where i.id = item_id and i.recipient_id = secret_notes.recipient_id))
  );
create policy notes_delete on public.secret_notes for delete to authenticated
  using (author_id = auth.uid());

-- households ------------------------------------------------------------------
create policy households_select on public.households for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));
create policy households_write on public.households for all to authenticated
  using (public.is_group_admin(group_id, auth.uid()))
  with check (public.is_group_admin(group_id, auth.uid()) and created_by = auth.uid());
create policy household_members_select on public.household_members for select to authenticated
  using (exists (select 1 from public.households h
                 where h.id = household_id and public.is_group_member(h.group_id, auth.uid())));
create policy household_members_write on public.household_members for all to authenticated
  using (exists (select 1 from public.households h
                 where h.id = household_id and public.is_group_admin(h.group_id, auth.uid())))
  with check (exists (select 1 from public.households h
                      where h.id = household_id and public.is_group_admin(h.group_id, auth.uid())
                        and public.is_group_member(h.group_id, profile_id)));

-- draws -----------------------------------------------------------------------
create policy draws_select on public.draws for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));
create policy draws_insert on public.draws for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(group_id, auth.uid())
              and status = 'draft');
-- A szervező csak a vázlatot szerkesztheti; a sorsolás állapotát a szerver állítja.
create policy draws_update on public.draws for update to authenticated
  using (created_by = auth.uid() and status = 'draft')
  with check (created_by = auth.uid() and status = 'draft');
create policy draws_delete on public.draws for delete to authenticated
  using (created_by = auth.uid());

create policy participants_select on public.draw_participants for select to authenticated
  using (exists (select 1 from public.draws d
                 where d.id = draw_id and public.is_group_member(d.group_id, auth.uid())));
create policy participants_write on public.draw_participants for all to authenticated
  using (exists (select 1 from public.draws d
                 where d.id = draw_id and d.created_by = auth.uid() and d.status = 'draft'))
  with check (exists (select 1 from public.draws d
                      where d.id = draw_id and d.created_by = auth.uid() and d.status = 'draft'
                        and public.is_group_member(d.group_id, profile_id)));

create policy exclusions_organizer on public.draw_exclusions for all to authenticated
  using (exists (select 1 from public.draws d
                 where d.id = draw_id and d.created_by = auth.uid()))
  with check (exists (select 1 from public.draws d
                      where d.id = draw_id and d.created_by = auth.uid() and d.status = 'draft'));

-- draw_assignments: KIZÁRÓLAG a húzó a saját sorát. Nincs insert/update/delete
-- policy, ezért a kliens írni sem tud.
create policy assignments_select_own on public.draw_assignments for select to authenticated
  using (giver_id = auth.uid());

-- notifications ---------------------------------------------------------------
create policy notifications_own on public.notifications for select to authenticated
  using (profile_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- =============================================================================
-- Üzleti függvények
-- =============================================================================

-- Csoport létrehozása a létrehozó tulajdonosi tagságával együtt.
create or replace function public.create_group(p_name text, p_kind public.group_kind default 'permanent',
                                               p_ends_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  insert into groups (name, kind, ends_at, created_by)
    values (p_name, p_kind, p_ends_at, auth.uid()) returning id into v_group;
  insert into group_members (group_id, profile_id, role) values (v_group, auth.uid(), 'owner');
  return v_group;
end;
$$;

-- Meghívókód létrehozása (csak admin). A nyers kódot egyszer adjuk vissza.
create or replace function public.create_invite(p_group uuid, p_expires_at timestamptz default null,
                                                p_max_uses int default null,
                                                p_role public.member_role default 'member')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not is_group_admin(p_group, auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- 10 karakter, félreérthető karakterek nélkül (0/O, 1/I/L)
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
    into v_code
    from (select extensions.gen_random_bytes(10) as b) r, generate_series(0, 9) as i;
  insert into group_invites (group_id, code_hash, role, created_by, expires_at, max_uses)
    values (p_group, encode(extensions.digest(v_code, 'sha256'), 'hex'), p_role, auth.uid(), p_expires_at, p_max_uses);
  return v_code;
end;
$$;

-- Csatlakozás meghívókóddal. Érvénytelen kódnál nem árulja el, miért.
create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv group_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_inv from group_invites
    where code_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex')
    for update;
  if not found
     or (v_inv.expires_at is not null and v_inv.expires_at < now())
     or (v_inv.max_uses is not null and v_inv.uses >= v_inv.max_uses) then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;
  insert into group_members (group_id, profile_id, role)
    values (v_inv.group_id, auth.uid(), v_inv.role)
    on conflict (group_id, profile_id) do nothing;
  if found then
    update group_invites set uses = uses + 1 where id = v_inv.id;
  end if;
  return v_inv.group_id;
end;
$$;

-- Tétel lefoglalása. Eredmény: 'ok' | 'unavailable' | 'not_found'.
-- 'unavailable' nem árulja el, ki és melyik csoportban foglalta.
-- A tétel sorát zároljuk, így az egyidejű kérések sorban futnak; a részleges
-- egyedi index ezen felül adatbázisszinten is kizárja a dupla foglalást.
create or replace function public.reserve_item(p_item uuid, p_expires_at timestamptz default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_recipient uuid;
begin
  select recipient_id into v_recipient from items
    where id = p_item and archived_at is null
    for update;
  if not found or not can_give_to(auth.uid(), v_recipient) then
    return 'not_found';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;

  update reservations set status = 'expired', updated_at = now()
    where item_id = p_item and status = 'reserved' and expires_at is not null and expires_at <= now();

  begin
    insert into reservations (item_id, recipient_id, giver_id, expires_at)
      values (p_item, v_recipient, auth.uid(), p_expires_at);
  exception when unique_violation then
    return 'unavailable';
  end;
  return 'ok';
end;
$$;

create or replace function public.release_reservation(p_reservation uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update reservations set status = 'released', updated_at = now()
    where id = p_reservation and giver_id = auth.uid()
      and status in ('reserved', 'ordered', 'arrived', 'wrapped');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.set_reservation_status(p_reservation uuid,
                                                         p_status public.reservation_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('reserved', 'ordered', 'arrived', 'wrapped', 'given') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  -- Megrendelés után a foglalás már nem jár le.
  update reservations
    set status = p_status,
        expires_at = case when p_status = 'reserved' then expires_at else null end,
        updated_at = now()
    where id = p_reservation and giver_id = auth.uid()
      and status in ('reserved', 'ordered', 'arrived', 'wrapped', 'given');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end;
$$;

-- Egy személy tételeinek állapota az AJÁNDÉKOZÓ szemszögéből.
-- A címzettnek (vagy kívülállónak) üres eredményt ad.
-- reserved_by csak akkor kap értéket, ha a foglaló és a lekérdező közös csoportban van;
-- így más csoportok tagjai és léte nem derül ki.
create or replace function public.gift_status_for(p_recipient uuid)
returns table (
  item_id uuid,
  state text,               -- 'free' | 'mine' | 'taken'
  reservation_id uuid,      -- csak a saját foglalásnál
  reservation_status public.reservation_status,
  reserved_by uuid,
  not_relevant_count int
)
language sql stable security definer set search_path = public as $$
  select i.id,
         case when r.id is null then 'free'
              when r.giver_id = auth.uid() then 'mine'
              else 'taken' end,
         case when r.giver_id = auth.uid() then r.id end,
         case when r.giver_id = auth.uid() then r.status end,
         case when r.giver_id is not null and shares_group(auth.uid(), r.giver_id) then r.giver_id end,
         (select count(*)::int from item_marks m where m.item_id = i.id and m.kind = 'not_relevant')
  from items i
  left join reservations r
    on r.item_id = i.id
   and r.status in ('reserved', 'ordered', 'arrived', 'wrapped', 'given')
   and not (r.status = 'reserved' and r.expires_at is not null and r.expires_at <= now())
  where i.recipient_id = p_recipient
    and i.archived_at is null
    and can_give_to(auth.uid(), p_recipient);
$$;

-- Lejárt foglalások felszabadítása (pg_cron hívja 5 percenként).
create or replace function public.expire_reservations()
returns int language sql security definer set search_path = public as $$
  with x as (
    update reservations set status = 'expired', updated_at = now()
     where status = 'reserved' and expires_at is not null and expires_at <= now()
    returning 1
  )
  select count(*)::int from x;
$$;

-- Saját húzott lekérdezése + "megnéztem" jelölés.
create or replace function public.my_draw_assignment(p_draw uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_receiver uuid;
begin
  update draw_assignments set seen_at = coalesce(seen_at, now())
    where draw_id = p_draw and giver_id = auth.uid()
    returning receiver_id into v_receiver;
  return v_receiver;
end;
$$;

-- A szervező csak azt látja, ki nézte már meg a húzását – azt nem, kit húzott.
create or replace function public.draw_progress(p_draw uuid)
returns table (profile_id uuid, has_seen boolean)
language sql stable security definer set search_path = public as $$
  select a.giver_id, a.seen_at is not null
  from draw_assignments a
  join draws d on d.id = a.draw_id
  where a.draw_id = p_draw and is_group_member(d.group_id, auth.uid());
$$;

-- =============================================================================
-- Jogosultságok: a függvényeket csak bejelentkezett felhasználó hívhatja.
-- =============================================================================
revoke all on function public.expire_reservations() from public, anon, authenticated;
revoke all on function public.create_group(text, public.group_kind, timestamptz) from public, anon;
revoke all on function public.create_invite(uuid, timestamptz, int, public.member_role) from public, anon;
revoke all on function public.join_group(text) from public, anon;
revoke all on function public.reserve_item(uuid, timestamptz) from public, anon;
revoke all on function public.release_reservation(uuid) from public, anon;
revoke all on function public.set_reservation_status(uuid, public.reservation_status) from public, anon;
revoke all on function public.gift_status_for(uuid) from public, anon;
revoke all on function public.my_draw_assignment(uuid) from public, anon;
revoke all on function public.draw_progress(uuid) from public, anon;
grant execute on function public.create_group(text, public.group_kind, timestamptz) to authenticated;
grant execute on function public.create_invite(uuid, timestamptz, int, public.member_role) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.reserve_item(uuid, timestamptz) to authenticated;
grant execute on function public.release_reservation(uuid) to authenticated;
grant execute on function public.set_reservation_status(uuid, public.reservation_status) to authenticated;
grant execute on function public.gift_status_for(uuid) to authenticated;
grant execute on function public.my_draw_assignment(uuid) to authenticated;
grant execute on function public.draw_progress(uuid) to authenticated;

-- updated_at karbantartás
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();
