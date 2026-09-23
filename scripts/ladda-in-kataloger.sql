-- Tillfälliga laddfunktioner för scripts/ingest-catalogues.py.
--
-- VARFÖR DE BEHÖVS. knowledge_chunks har bara en select-policy: det finns
-- ingen skrivväg med den publika nyckeln, och det ska det inte finnas.
-- Inläsningen är däremot ett engångsjobb per katalogfil som körs från en
-- laptop med pdftotext. Lösningen är två security definer-funktioner som
-- öppnar en smal, hemlighetsskyddad skrivväg under körningen -- och som
-- SLÄPPS direkt efteråt.
--
-- Funktionsdefinitionerna låg tidigare ingenstans i repot (bara i en
-- assistents minne), vilket gjorde inläsningen omöjlig att köra själv.
-- Därför den här filen.
--
-- KÖR SÅ HÄR
--
--   1. psql/SQL-editorn: kör AVSNITT 1 nedan (skapar funktionerna OCH laddar
--      om PostgREST:s schemacache -- utan omladdningen svarar REST-API:et 404
--      på funktionerna trots att de finns).
--   2. skalet:  INGEST_SECRET='<samma sträng>' python3 scripts/ingest-catalogues.py
--   3. psql/SQL-editorn: kör AVSNITT 2 nedan (släpper funktionerna).
--   4. kontrollera att inget ligger kvar:
--        select count(*) from pg_proc where proname like 'tmp\_ingest\_%';
--      Ska vara 0.
--
-- HEMLIGHETEN är inte ett lösenord till något annat -- den finns bara för att
-- den här skrivvägen står öppen för anon under körningen. GENERERA EN NY VARJE
-- GÅNG och checka aldrig in den: repot är publikt, och medan funktionerna
-- finns är hemligheten det enda som skiljer dem från en öppen skrivväg till
-- knowledge_chunks -- tabellen vars innehåll går rakt in i rådgivarens prompt.
-- Den tidigare inbyggda standardhemligheten i ingest-catalogues.py är därför
-- borttagen; skriptet vägrar nu starta utan INGEST_SECRET.
--
--   export INGEST_SECRET=$(uuidgen)
--   echo $INGEST_SECRET      # klistra in på de två HEMLIGHET-raderna nedan
--
-- Det viktigaste är ändå inte vilken sträng det är, utan att AVSNITT 2 körs
-- direkt efteråt. Funktionerna ska inte ligga kvar mellan körningarna.


-- ── AVSNITT 1: skapa ────────────────────────────────────────────────────────

create or replace function tmp_ingest_known_files(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_secret <> 'SÄTT-EN-NY-HEMLIGHET-HÄR' then  -- HEMLIGHET
    raise exception 'fel hemlighet';
  end if;
  return coalesce(
    (select jsonb_agg(distinct source_file) from knowledge_chunks), '[]'::jsonb);
end;
$$;

create or replace function tmp_ingest_chunks(p_secret text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  if p_secret <> 'SÄTT-EN-NY-HEMLIGHET-HÄR' then  -- HEMLIGHET
    raise exception 'fel hemlighet';
  end if;
  -- content_tsv är GENERATED och får inte skrivas.
  -- on conflict: knowledge_chunks har sedan 20260922080000 en unik nyckel på
  -- (source_file, chunk_index). Utan den kunde en fil läsas in två gånger
  -- utan att något sa ifrån -- 54 filer låg dubblerade när det upptäcktes.
  insert into knowledge_chunks (source_file, brand, chunk_index, content)
  select r.source_file, r.brand, r.chunk_index, r.content
  from jsonb_to_recordset(p_rows)
    as r(source_file text, brand text, chunk_index int, content text)
  on conflict (source_file, chunk_index) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function tmp_ingest_known_files(text) to anon;
grant execute on function tmp_ingest_chunks(text, jsonb) to anon;

-- LADDA OM POSTGRESTS SCHEMACACHE. Utan den här raden svarar REST-API:et
-- 404 på /rest/v1/rpc/tmp_ingest_known_files trots att funktionen finns i
-- public med rätt rättigheter -- PostgREST känner bara till det den hade i
-- cachen när den startade. Triggern pgrst_ddl_watch skickar normalt notisen
-- automatiskt vid ddl_command_end, men den kan komma efter att du hunnit
-- starta skriptet. Skicka den uttryckligen och ge den några sekunder.
--
-- Felsökning om 404 ändå kommer: kontrollera att funktionerna ligger i
-- schemat public (inte i ett annat schema från din session) och att anon får
-- köra dem:
--   select n.nspname, p.proname, has_function_privilege('anon', p.oid, 'execute')
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where p.proname like 'tmp\_ingest\_%';
notify pgrst, 'reload schema';


-- ── AVSNITT 2: släpp (kör direkt efter inläsningen) ─────────────────────────
--
-- drop function if exists tmp_ingest_known_files(text);
-- drop function if exists tmp_ingest_chunks(text, jsonb);
-- notify pgrst, 'reload schema';
