-- PLC-underlagets kallrevision följer kraven det bygger på.
--
-- 20261012180000_plc_underlag satte kallrevision till projektets revision när
-- underlaget skapades och rörde den aldrig mer. Två fel följde av det:
--  * hämtar kunden kraven igen efter en ändring i maskinbyggaren står
--    kolumnen kvar på den gamla revisionen, så underlaget ser inaktuellt ut
--    för alltid;
--  * ändras projektet mellan klientens läsning och skapandet får underlaget
--    den nya revisionen fast kraven kom ur den gamla -- och ser aktuellt ut
--    när det inte är det.
-- Revisionen kraven faktiskt hämtades ur står i underlaget
-- (importerat.kallrevision). Den kontrolleras här mot projektet och blir
-- kolumnens värde, både när underlaget skapas och när det sparas.

create or replace function public.plc_kallrevision(p_project uuid, p_data jsonb)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  projrev int;
  angiven text := p_data #>> '{importerat,kallrevision}';
begin
  select revision into projrev from public.projects where id = p_project;
  if angiven is null or angiven !~ '^[0-9]{1,9}$' then
    raise exception 'plc_data: importerat.kallrevision saknas';
  end if;
  if angiven::int < 1 or angiven::int > projrev then
    raise exception 'plc_data: projektet har ingen revision % (senaste är %)', angiven, projrev;
  end if;
  return angiven::int;
end $$;

create or replace function public.skapa_plc_underlag(p_project uuid, p_data jsonb)
returns public.plc_underlag
language plpgsql security definer set search_path = public as $$
declare
  u public.plc_underlag;
  rev int;
begin
  if auth.uid() is null or not public.plc_ar_agare(p_project) then
    raise exception 'plc: projektet finns inte eller tillhör någon annan' using errcode = '42501';
  end if;
  select * into u from public.plc_underlag where project_id = p_project;
  if found then return u; end if;
  perform public.plc_kontrollera_data(p_data);
  rev := public.plc_kallrevision(p_project, p_data);
  insert into public.plc_underlag (project_id, revision, kallrevision, data, updated_by)
  values (p_project, 1, rev, p_data, auth.uid())
  returning * into u;
  insert into public.plc_underlag_revisioner (underlag_id, revision, kallrevision, data, created_by)
  values (u.id, 1, rev, p_data, auth.uid());
  return u;
end $$;

create or replace function public.spara_plc_underlag(p_id uuid, p_forvantad_revision int, p_data jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  u public.plc_underlag;
  rev int;
begin
  select * into u from public.plc_underlag where id = p_id for update;
  if not found or auth.uid() is null or not public.plc_ar_agare(u.project_id) then
    raise exception 'plc: underlaget finns inte eller tillhör någon annan' using errcode = '42501';
  end if;
  if u.revision <> p_forvantad_revision then
    raise exception 'plc_revisionskonflikt:%', u.revision using errcode = '40001';
  end if;
  perform public.plc_kontrollera_data(p_data);
  rev := public.plc_kallrevision(u.project_id, p_data);
  update public.plc_underlag
     set data = p_data, revision = u.revision + 1, kallrevision = rev, updated_at = now(), updated_by = auth.uid()
   where id = p_id;
  insert into public.plc_underlag_revisioner (underlag_id, revision, kallrevision, data, created_by)
  values (p_id, u.revision + 1, rev, p_data, auth.uid());
  return u.revision + 1;
end $$;

revoke all on function public.plc_kallrevision(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.skapa_plc_underlag(uuid, jsonb) from public, anon;
revoke all on function public.spara_plc_underlag(uuid, int, jsonb) from public, anon;
grant execute on function public.skapa_plc_underlag(uuid, jsonb) to authenticated;
grant execute on function public.spara_plc_underlag(uuid, int, jsonb) to authenticated;
