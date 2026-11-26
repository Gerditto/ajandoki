-- =============================================================================
-- Titkos Mikulás: a sorsolás eredményének beírása és a sorsolás visszaállítása.
-- =============================================================================

-- Az eredményt KIZÁRÓLAG a szerver írhatja be (service role). Így a szervező sem
-- tud saját maga által kitalált párokat beküldeni, és nem ismerheti meg az eredményt.
-- Egy tranzakcióban: ellenőrzés, beírás, állapotváltás.
create or replace function public.commit_draw(p_draw uuid, p_pairs jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_participants int;
  v_inserted int;
begin
  perform 1 from draws where id = p_draw and status = 'draft' for update;
  if not found then raise exception 'draw_not_draft'; end if;

  insert into draw_assignments (draw_id, giver_id, receiver_id)
  select p_draw, (e->>'giver')::uuid, (e->>'receiver')::uuid
  from jsonb_array_elements(p_pairs) e;
  get diagnostics v_inserted = row_count;

  select count(*) into v_participants from draw_participants where draw_id = p_draw;
  if v_inserted <> v_participants
     or exists (select 1 from draw_assignments a
                where a.draw_id = p_draw
                  and (not exists (select 1 from draw_participants p where p.draw_id = p_draw and p.profile_id = a.giver_id)
                    or not exists (select 1 from draw_participants p where p.draw_id = p_draw and p.profile_id = a.receiver_id)
                    or exists (select 1 from draw_exclusions x where x.draw_id = p_draw
                               and x.giver_id = a.giver_id and x.receiver_id = a.receiver_id)))
  then
    raise exception 'invalid_assignment';
  end if;

  update draws set status = 'drawn', drawn_at = now() where id = p_draw;
end;
$$;

-- A szervező visszaállíthatja a sorsolást vázlatra (pl. ha valaki kimarad).
-- Az eredményt törli, így ő sem tud meg belőle semmit.
create or replace function public.reset_draw(p_draw uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform 1 from draws where id = p_draw and created_by = auth.uid() and status = 'drawn' for update;
  if not found then return false; end if;
  delete from draw_assignments where draw_id = p_draw;
  update draws set status = 'draft', drawn_at = null where id = p_draw;
  return true;
end;
$$;

revoke all on function public.commit_draw(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.commit_draw(uuid, jsonb) to service_role;
revoke all on function public.reset_draw(uuid) from public, anon;
grant execute on function public.reset_draw(uuid) to authenticated;
