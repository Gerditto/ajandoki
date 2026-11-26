-- =============================================================================
-- Titkossági és jogosultsági tesztek.
-- Futtatás: scripts/test-db.sh (üres adatbázison, ON_ERROR_STOP mellett).
-- Bármely assert bukása leállítja a futást, nem nulla kilépési kóddal.
--
-- Szereplők:
--   anna  – megajándékozott; tagja a "Család" és a "Munka" csoportnak
--   bela  – családtag, ajándékozó
--   eva   – családtag, ajándékozó
--   csilla – csak Anna munkahelyi csoportjában van
--   dani  – kívülálló
-- =============================================================================
\set ON_ERROR_STOP 1
\set anna   '00000000-0000-0000-0000-0000000000a1'
\set bela   '00000000-0000-0000-0000-0000000000b2'
\set eva    '00000000-0000-0000-0000-0000000000e5'
\set csilla '00000000-0000-0000-0000-0000000000c3'
\set dani   '00000000-0000-0000-0000-0000000000d4'

-- ---- Adatok (adminként) ------------------------------------------------------
insert into auth.users (id) values (:'anna'), (:'bela'), (:'eva'), (:'csilla'), (:'dani');
insert into profiles (id, display_name) values
  (:'anna', 'Anna'), (:'bela', 'Béla'), (:'eva', 'Éva'), (:'csilla', 'Csilla'), (:'dani', 'Dani');

-- Helper: felhasználóváltás
create or replace function pg_temp.login(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
end $$;

-- ---- Anna létrehozza a csoportokat és a meghívókat --------------------------
select pg_temp.login(:'anna');
set role authenticated;
select create_group('Család') as family \gset
select create_group('Munka', 'occasional') as work \gset
select create_invite(:'family') as family_code \gset
select create_invite(:'work') as work_code \gset

insert into items (recipient_id, created_by, origin, title, price_max)
  values (:'anna', :'anna', 'owner', 'Kerámia bögre', 8000) returning id as i1 \gset
insert into items (recipient_id, created_by, origin, title)
  values (:'anna', :'anna', 'owner', 'Társasjáték') returning id as i2 \gset
insert into profile_details (profile_id, key, value, visibility)
  values (:'anna', 'cipőméret', '38', 'private');
insert into profile_details (profile_id, key, value, visibility)
  values (:'anna', 'kedvenc szín', 'zöld', 'groups');
reset role;

-- ---- Csatlakozások -----------------------------------------------------------
select pg_temp.login(:'bela');   set role authenticated; select join_group(:'family_code'); reset role;
select pg_temp.login(:'eva');    set role authenticated; select join_group(:'family_code'); reset role;
select pg_temp.login(:'csilla'); set role authenticated; select join_group(:'work_code');   reset role;

-- Érvénytelen kód
select pg_temp.login(:'dani'); set role authenticated;
do $$ begin
  begin
    perform join_group('NEMLETEZO1');
    raise exception 'FAIL: érvénytelen kóddal csatlakozni lehetett';
  exception when others then
    if sqlerrm <> 'invalid_invite' then raise; end if;
  end;
end $$;
reset role;

-- ---- Béla titkos ötletet és megjegyzést ad Annához --------------------------
select pg_temp.login(:'bela'); set role authenticated;
insert into items (recipient_id, created_by, origin, title)
  values (:'anna', :'bela', 'giver', 'Fazekas workshop') returning id as i3 \gset
insert into secret_notes (recipient_id, item_id, group_id, author_id, body)
  values (:'anna', :'i1', :'family', :'bela', 'Zöld színben szeretné');
select reserve_item(:'i1') = 'ok' as ok \gset
\if :ok
\else
  \echo 'FAIL: Béla nem tudta lefoglalni az i1-et'
  \quit 1
\endif
reset role;

-- ---- Csilla (másik csoport) ugyanazt próbálja: nem sikerülhet ----------------
select pg_temp.login(:'csilla'); set role authenticated;
do $$ begin
  assert (select reserve_item((select id from items where title = 'Kerámia bögre'))) = 'unavailable',
    'FAIL: csoportokon átnyúló dupla foglalás lehetséges';
  -- Csilla látja, hogy foglalt, de nem látja, ki foglalta (nincs közös csoportjuk)
  assert (select state from gift_status_for('00000000-0000-0000-0000-0000000000a1')
          where item_id = (select id from items where title = 'Kerámia bögre')) = 'taken',
    'FAIL: Csilla nem látja foglaltnak';
  assert (select reserved_by from gift_status_for('00000000-0000-0000-0000-0000000000a1')
          where item_id = (select id from items where title = 'Kerámia bögre')) is null,
    'FAIL: Csilla látja a más csoportbeli foglaló kilétét';
  -- Csilla nem látja a családi titkos megjegyzést
  assert (select count(*) from secret_notes) = 0, 'FAIL: Csilla látja a családi megjegyzést';
  -- Csilla nem látja Anna privát cipőméretét, de a csoportoknak szóló színt igen
  assert (select count(*) from profile_details where key = 'cipőméret') = 0, 'FAIL: privát mező kiszivárgott';
  assert (select count(*) from profile_details where key = 'kedvenc szín') = 1, 'FAIL: csoportmező nem látszik';
  -- Nem releváns jelölés: az eredeti kívánság változatlan marad
  insert into item_marks (item_id, giver_id, kind)
    values ((select id from items where title = 'Társasjáték'), '00000000-0000-0000-0000-0000000000c3', 'not_relevant');
end $$;
reset role;

-- ---- Éva (azonos csoport Bélával) látja, hogy Béla foglalta ------------------
select pg_temp.login(:'eva'); set role authenticated;
do $$ begin
  assert (select reserved_by from gift_status_for('00000000-0000-0000-0000-0000000000a1')
          where item_id = (select id from items where title = 'Kerámia bögre'))
         = '00000000-0000-0000-0000-0000000000b2', 'FAIL: Éva nem látja, hogy Béla foglalt';
  assert (select count(*) from secret_notes) = 1, 'FAIL: Éva nem látja a családi megjegyzést';
  assert (select count(*) from items) = 3, 'FAIL: Éva nem lát minden tételt (owner + giver)';
  -- Közvetlenül nem lát más foglalást
  assert (select count(*) from reservations) = 0, 'FAIL: Éva közvetlenül látja Béla foglalását';
  -- Közvetlen írás tiltott
  begin
    insert into reservations (item_id, recipient_id, giver_id)
      values ((select id from items where title = 'Társasjáték'),
              '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e5');
    raise exception 'FAIL: közvetlen foglalásbeszúrás lehetséges';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---- A LEGFONTOSABB: Anna semmit nem láthat ---------------------------------
select pg_temp.login(:'anna'); set role authenticated;
do $$ begin
  assert (select count(*) from items) = 2, 'FAIL: Anna mások ötleteit is látja';
  assert (select count(*) from items where origin <> 'owner') = 0, 'FAIL: Anna lát nem saját tételt';
  assert (select count(*) from reservations) = 0, 'FAIL: Anna lát foglalást';
  assert (select count(*) from item_marks) = 0, 'FAIL: Anna lát jelölést';
  assert (select count(*) from secret_notes) = 0, 'FAIL: Anna lát titkos megjegyzést';
  assert (select count(*) from notifications) = 0, 'FAIL: Anna értesítést kapott';
  assert (select count(*) from gift_status_for('00000000-0000-0000-0000-0000000000a1')) = 0,
    'FAIL: Anna lekérdezheti a saját ajándékállapotát';
  assert (select reserve_item((select id from items where title = 'Kerámia bögre'))) = 'not_found',
    'FAIL: Anna saját tételére a válasz elárulja a foglalást';
  -- Az eredeti kívánság változatlan (a nem releváns jelölés nem módosította)
  assert (select title from items where title = 'Társasjáték') = 'Társasjáték', 'FAIL: kívánság módosult';
  -- Saját profiladatait mind látja
  assert (select count(*) from profile_details) = 2, 'FAIL: Anna nem látja a saját mezőit';
  -- Nem tud "giver" tételt írni magának, és nem tudja átírni Béla ötletét
  begin
    insert into items (recipient_id, created_by, origin, title)
      values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'giver', 'x');
    raise exception 'FAIL: Anna giver-tételt írt magának';
  exception when check_violation or insufficient_privilege then null;
  end;
end $$;
-- A titkos tétel törlése/módosítása 0 sort érint (nem is látja)
update items set title = 'feltört' where origin = 'giver';
delete from secret_notes;
delete from reservations;
reset role;
do $$ begin
  assert (select count(*) from items where title = 'Fazekas workshop') = 1, 'FAIL: Anna módosította a titkos ötletet';
  assert (select count(*) from secret_notes) = 1, 'FAIL: Anna törölte a titkos megjegyzést';
  assert (select count(*) from reservations where status = 'reserved') = 1, 'FAIL: Anna törölte a foglalást';
end $$;

-- ---- Kívülálló (Dani) és anon ------------------------------------------------
select pg_temp.login(:'dani'); set role authenticated;
do $$ begin
  assert (select count(*) from items) = 0, 'FAIL: Dani lát tételt';
  assert (select count(*) from profiles) = 1, 'FAIL: Dani más profilját látja';
  assert (select count(*) from groups) = 0, 'FAIL: Dani lát csoportot';
  assert (select reserve_item((select id from items limit 1))) = 'not_found', 'FAIL: Dani foglalhat';
end $$;
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  assert (select count(*) from items) = 0, 'FAIL: anon lát tételt';
  assert (select count(*) from profiles) = 0, 'FAIL: anon lát profilt';
  begin
    perform reserve_item(gen_random_uuid());
    raise exception 'FAIL: anon hívhatja a foglalást';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---- Lejárt foglalás felszabadul -------------------------------------------
insert into reservations (item_id, recipient_id, giver_id, expires_at)
  values (:'i2', :'anna', :'bela', now() - interval '1 minute');
select pg_temp.login(:'csilla'); set role authenticated;
do $$ begin
  assert (select reserve_item((select id from items where title = 'Társasjáték'))) = 'ok',
    'FAIL: lejárt foglalás nem szabadult fel';
end $$;
reset role;
do $$ begin
  assert (select count(*) from reservations where item_id = (select id from items where title = 'Társasjáték')
          and status = 'expired') = 1, 'FAIL: a lejárt foglalás nem lett lejártnak jelölve';
end $$;

-- ---- Béla feloldja a foglalását, Éva lefoglalhatja --------------------------
select pg_temp.login(:'bela'); set role authenticated;
select release_reservation((select id from reservations where item_id = :'i1' and status = 'reserved'));
reset role;
select pg_temp.login(:'eva'); set role authenticated;
do $$ begin
  assert (select reserve_item((select id from items where title = 'Kerámia bögre'))) = 'ok',
    'FAIL: feloldás után nem foglalható';
end $$;
reset role;

-- ---- Secret Santa: mindenki csak a saját húzottját látja ---------------------
select pg_temp.login(:'bela'); set role authenticated;
insert into draws (group_id, name, created_by) values (:'family', 'Karácsony 2026', :'bela')
  returning id as draw \gset
reset role;
-- A sorsolást a szerver írja be (service role); itt adminként szimuláljuk.
insert into draw_assignments (draw_id, giver_id, receiver_id) values
  (:'draw', :'anna', :'bela'), (:'draw', :'bela', :'eva'), (:'draw', :'eva', :'anna');
update draws set status = 'drawn', drawn_at = now() where id = :'draw';

select pg_temp.login(:'bela'); set role authenticated;  -- a szervező
do $$ begin
  assert (select count(*) from draw_assignments) = 1, 'FAIL: a szervező mások húzását is látja';
  assert (select receiver_id from draw_assignments) = '00000000-0000-0000-0000-0000000000e5',
    'FAIL: a szervező nem a saját húzottját látja';
  -- A szervező a lezárt sorsolást nem írhatja át
  update draws set status = 'draft';
  begin
    insert into draw_assignments (draw_id, giver_id, receiver_id)
      values ((select id from draws limit 1), '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAIL: a kliens írhat sorsolási eredményt';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from draw_progress((select id from draws limit 1))) = 3, 'FAIL: draw_progress';
end $$;
reset role;
do $$ begin
  assert (select status from draws limit 1) = 'drawn', 'FAIL: a szervező visszaállította a sorsolást vázlatra';
end $$;

select pg_temp.login(:'anna'); set role authenticated;
do $$ begin
  assert (select count(*) from draw_assignments) = 1, 'FAIL: Anna mások húzását látja';
  assert my_draw_assignment((select id from draws limit 1)) = '00000000-0000-0000-0000-0000000000b2',
    'FAIL: Anna húzottja hibás';
end $$;
reset role;

-- ---- commit_draw / reset_draw -------------------------------------------------
-- A szervező nem hívhatja a commit_draw-t (csak a szerver, service role).
select pg_temp.login(:'bela'); set role authenticated;
insert into draws (group_id, name, created_by) values (:'family', 'Szilveszter', :'bela') returning id as draw2 \gset
insert into draw_participants (draw_id, profile_id) values (:'draw2', :'anna'), (:'draw2', :'bela'), (:'draw2', :'eva');
insert into draw_exclusions (draw_id, giver_id, receiver_id) values (:'draw2', :'anna', :'bela');
do $$ begin
  begin
    perform commit_draw((select id from draws where name = 'Szilveszter'), '[]'::jsonb);
    raise exception 'FAIL: a kliens hívhatja a commit_draw-t';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role service_role;
-- Kizárást sértő eredmény elutasítva
do $$ begin
  begin
    perform commit_draw((select id from draws where name = 'Szilveszter'), jsonb_build_array(
      jsonb_build_object('giver', '00000000-0000-0000-0000-0000000000a1', 'receiver', '00000000-0000-0000-0000-0000000000b2'),
      jsonb_build_object('giver', '00000000-0000-0000-0000-0000000000b2', 'receiver', '00000000-0000-0000-0000-0000000000e5'),
      jsonb_build_object('giver', '00000000-0000-0000-0000-0000000000e5', 'receiver', '00000000-0000-0000-0000-0000000000a1')));
    raise exception 'FAIL: kizárást sértő sorsolás bekerült';
  exception when raise_exception then
    if sqlerrm <> 'invalid_assignment' then raise; end if;
  end;
end $$;
-- Hiányos eredmény elutasítva
do $$ begin
  begin
    perform commit_draw((select id from draws where name = 'Szilveszter'), jsonb_build_array(
      jsonb_build_object('giver', '00000000-0000-0000-0000-0000000000a1', 'receiver', '00000000-0000-0000-0000-0000000000e5')));
    raise exception 'FAIL: hiányos sorsolás bekerült';
  exception when raise_exception then
    if sqlerrm <> 'invalid_assignment' then raise; end if;
  end;
end $$;
select commit_draw(:'draw2', jsonb_build_array(
  jsonb_build_object('giver', :'anna', 'receiver', :'eva'),
  jsonb_build_object('giver', :'eva', 'receiver', :'bela'),
  jsonb_build_object('giver', :'bela', 'receiver', :'anna')));
reset role;
do $$ begin
  assert (select status from draws where name = 'Szilveszter') = 'drawn', 'FAIL: commit_draw nem zárta le';
end $$;

-- Csak a szervező állíthatja vissza
select pg_temp.login(:'anna'); set role authenticated;
do $$ begin
  assert not reset_draw((select id from draws where name = 'Szilveszter')), 'FAIL: nem szervező visszaállította';
end $$;
reset role;
select pg_temp.login(:'bela'); set role authenticated;
do $$ begin
  assert reset_draw((select id from draws where name = 'Szilveszter')), 'FAIL: a szervező nem tudta visszaállítani';
end $$;
reset role;
do $$ begin
  assert (select count(*) from draw_assignments a join draws d on d.id = a.draw_id where d.name = 'Szilveszter') = 0,
    'FAIL: visszaállítás után maradt eredmény';
end $$;

\echo 'OK: minden titkossági teszt sikeres'
