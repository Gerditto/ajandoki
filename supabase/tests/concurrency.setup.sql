-- 1 címzett + 50 ajándékozó egy csoportban, egy tétellel. Az utolsó sor a tétel id-je.
insert into auth.users (id) select gen_random_uuid() from generate_series(1, 51);
insert into profiles (id, display_name)
  select id, case when rn = 1 then 'recipient' else 'giver' || (rn - 1) end
  from (select id, row_number() over (order by id) rn from auth.users) u;
insert into groups (name, created_by) select 'Teszt', id from profiles where display_name = 'recipient';
insert into group_members (group_id, profile_id) select g.id, p.id from groups g, profiles p;
insert into items (recipient_id, created_by, title)
  select id, id, 'Közös kedvenc' from profiles where display_name = 'recipient';
select id from items;
