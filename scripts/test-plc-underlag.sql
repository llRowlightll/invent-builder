-- Prov av PLC-underlagets behörighet och kontroller (fas 1). Städar efter sig.
--
-- Körs mot databasen som administratör (t.ex. via MCP execute_sql). Ägaren är
-- testkontot; främlingen är ett slumpat användar-id utan roller, eftersom
-- inga konton skapas för prov. Varje rad i resultatet ska ha ok = true.

create temp table if not exists plc_prov (nr int, kontroll text, ok boolean, detalj text) on commit preserve rows;
truncate plc_prov;

do $$
declare
  a uuid := 'e00c90e0-8d15-43bc-b537-e37d68e253de';
  b uuid := gen_random_uuid();
  pid uuid; uid uuid; rev int; n int; fel text;
  bas jsonb := '{"schemaVersion":1,"importerat":{"kallrevision":1,"hamtat":"","krav":[],"komponenter":[]}}';
  som_agare text := json_build_object('sub', 'e00c90e0-8d15-43bc-b537-e37d68e253de', 'role', 'authenticated')::text;
  som_framling text;
begin
  som_framling := json_build_object('sub', b, 'role', 'authenticated')::text;

  -- 1. Ägaren skapar en befintlig maskin och läser underlaget.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', som_agare, true);
  pid := public.skapa_befintlig_maskin('[TEST] PLC-prov', 'prov', 'sv', bas);
  select id, revision into uid, rev from public.plc_underlag where project_id = pid;
  perform set_config('role', 'none', true);
  insert into plc_prov values (1, 'ägaren skapar och läser underlaget', uid is not null and rev = 1, coalesce(uid::text, '-'));

  -- 2. Ägaren sparar en ny revision.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', som_agare, true);
  rev := public.spara_plc_underlag(uid, 1, bas || '{"omfattning":{"leverans":"underlag"}}');
  perform set_config('role', 'none', true);
  select count(*) into n from public.plc_underlag_revisioner where underlag_id = uid;
  insert into plc_prov values (2, 'sparning ger revision 2 och bevarar revision 1', rev = 2 and n = 2, 'revision ' || rev || ', ' || n || ' i historiken');

  -- 3. Samma utgångsrevision igen blir en konflikt, inte en tyst överskrivning.
  fel := null;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', som_agare, true);
    perform public.spara_plc_underlag(uid, 1, bas);
  exception when others then fel := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role', 'none', true);
  insert into plc_prov values (3, 'revisionskonflikt vid gammal revision', fel like '40001 plc_revisionskonflikt:2%', coalesce(fel, 'inget fel'));

  -- 4. En klient kan inte sätta kompilering som utförd.
  fel := null;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', som_agare, true);
    perform public.spara_plc_underlag(uid, 2, bas || '{"statusar":{"kompilering":{"status":"utfort"}}}');
  exception when others then fel := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role', 'none', true);
  insert into plc_prov values (4, 'kompilering kan inte sättas av en klient', fel like '%kan bara sättas av ett verktyg%', coalesce(fel, 'inget fel'));

  -- 5. Okända fält stoppas.
  fel := null;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', som_agare, true);
    perform public.spara_plc_underlag(uid, 2, bas || '{"verifierad":true}');
  exception when others then fel := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role', 'none', true);
  insert into plc_prov values (5, 'okänt fält stoppas', fel like '%okänt fält verifierad%', coalesce(fel, 'inget fel'));

  -- 6. Direkt skrivning förbi funktionerna nekas.
  fel := null;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', som_agare, true);
    update public.plc_underlag set data = '{"schemaVersion":1,"verifierad":true}' where id = uid;
    get diagnostics n = row_count;
    if n > 0 then fel := 'uppdaterade ' || n || ' rad(er)'; end if;
  exception when others then fel := null;
  end;
  perform set_config('role', 'none', true);
  insert into plc_prov values (6, 'direkt uppdatering av underlaget påverkar inget', fel is null, coalesce(fel, 'ingen rad ändrad'));

  -- 7. En främling ser varken underlaget, historiken eller projektets revisioner.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', som_framling, true);
  select (select count(*) from public.plc_underlag where id = uid)
       + (select count(*) from public.plc_underlag_revisioner where underlag_id = uid)
       + (select count(*) from public.project_revisions where project_id = pid)
    into n;
  perform set_config('role', 'none', true);
  insert into plc_prov values (7, 'främlingen ser inget', n = 0, n || ' rader synliga');

  -- 8. En främling kan inte spara i någon annans underlag.
  fel := null;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', som_framling, true);
    perform public.spara_plc_underlag(uid, 2, bas);
  exception when others then fel := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role', 'none', true);
  insert into plc_prov values (8, 'främlingen kan inte spara', fel like '42501%', coalesce(fel, 'inget fel'));

  -- 9. En främling kan inte skapa ett underlag på någon annans projekt.
  fel := null;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', som_framling, true);
    perform public.skapa_plc_underlag(pid, bas);
  exception when others then fel := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role', 'none', true);
  insert into plc_prov values (9, 'främlingen kan inte skapa underlag', fel like '42501%', coalesce(fel, 'inget fel'));

  -- 10. Projektets revision följer innehållet, inte namnet.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', som_agare, true);
  update public.projects set answers = '{"slaglangd_mm":"200"}' where id = pid;
  update public.projects set name = '[TEST] PLC-prov, nytt namn' where id = pid;
  perform set_config('role', 'none', true);
  select revision into rev from public.projects where id = pid;
  select count(*) into n from public.project_revisions where project_id = pid;
  insert into plc_prov values (10, 'svar ger ny revision, namnbyte inte', rev = 2 and n = 2, 'revision ' || rev || ', ' || n || ' ögonblicksbilder');

  -- 11. Kraven hämtas igen ur revision 2: underlagets kallrevision följer med.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', som_agare, true);
  rev := public.spara_plc_underlag(uid, 2, jsonb_set(bas, '{importerat,kallrevision}', '2'));
  perform set_config('role', 'none', true);
  select kallrevision into n from public.plc_underlag where id = uid;
  insert into plc_prov values (11, 'nyhämtade krav flyttar kallrevisionen', rev = 3 and n = 2, 'revision ' || rev || ', kallrevision ' || n);

  -- 12. En kallrevision som projektet inte har stoppas.
  fel := null;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', som_agare, true);
    perform public.spara_plc_underlag(uid, 3, jsonb_set(bas, '{importerat,kallrevision}', '9'));
  exception when others then fel := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role', 'none', true);
  insert into plc_prov values (12, 'påhittad kallrevision stoppas', fel like '%ingen revision 9%', coalesce(fel, 'inget fel'));

  -- 13. Ett underlag utan importerade krav stoppas.
  fel := null;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', som_agare, true);
    perform public.spara_plc_underlag(uid, 3, '{"schemaVersion":1}');
  exception when others then fel := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role', 'none', true);
  insert into plc_prov values (13, 'underlag utan kallrevision stoppas', fel like '%kallrevision saknas%', coalesce(fel, 'inget fel'));

  -- 14. Kontrollfunktionen för kallrevision går inte att anropa direkt.
  fel := null;
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', som_framling, true);
    perform public.plc_kallrevision(pid, bas);
  exception when others then fel := sqlstate || ' ' || sqlerrm;
  end;
  perform set_config('role', 'none', true);
  insert into plc_prov values (14, 'plc_kallrevision är inte öppen för klienter', fel like '42501%', coalesce(fel, 'inget fel'));

  -- Städa: projektet tar med sig underlag, historik och revisioner.
  delete from public.projects where id = pid;
  select (select count(*) from public.plc_underlag where id = uid)
       + (select count(*) from public.project_revisions where project_id = pid)
    into n;
  insert into plc_prov values (15, 'provdatan är borta', n = 0, n || ' rader kvar');
end $$;

select * from plc_prov order by nr;
