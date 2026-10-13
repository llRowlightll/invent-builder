-- PLC & programmering, fas 1: revisioner i projekten och lagring av
-- programmeringsunderlaget. Se planen "Plan för PLC-modulen" (2026-10-12).
--
-- Tre saker som planen kräver och som saknades:
--   1. Ett projekt hade ingen revision. Utan den går det inte att säga vilken
--      maskinrevision ett underlag bygger på, eller vad som blivit inaktuellt.
--   2. Underlaget behöver egna tabeller med samma ägarregler som projekten,
--      och tidigare revisioner ska bevaras.
--   3. Sparning ska kontrollera ägare, revision (två som sparar samtidigt får
--      en konflikt, inte en tyst överskrivning), storlek och struktur, och
--      ingen klient får sätta "kompilering utförd" eller "granskad" utan att
--      ett verktyg eller en person faktiskt gjort det.

-- ── 1. Projektens typ och revision ─────────────────────────────────────────
alter table public.projects
  add column if not exists revision int not null default 1,
  add column if not exists typ text not null default 'maskinbyggare';

do $$ begin
  alter table public.projects
    add constraint projects_typ_check check (typ in ('maskinbyggare', 'befintlig_maskin'));
exception when duplicate_object then null;
end $$;

create table if not exists public.project_revisions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  revision    int not null,
  description text,
  answers     jsonb not null default '{}',
  bom_lines   jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  unique (project_id, revision)
);

alter table public.project_revisions enable row level security;

drop policy if exists "project_revisions: owner read" on public.project_revisions;
create policy "project_revisions: owner read"
  on public.project_revisions for select
  to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id
      and (p.user_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'))
  ));
-- Inga skrivregler: raderna skrivs bara av triggern nedan.

-- Revisionen följer innehållet (beskrivning, svar, stycklista), inte namnet,
-- och kan inte sättas av klienten.
create or replace function public.projekt_revision()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.revision := 1;
  elsif new.answers is distinct from old.answers
     or new.bom_lines is distinct from old.bom_lines
     or new.description is distinct from old.description then
    new.revision := old.revision + 1;
  else
    new.revision := old.revision;
  end if;
  return new;
end $$;

drop trigger if exists projects_revision on public.projects;
create trigger projects_revision
  before insert or update on public.projects
  for each row execute function public.projekt_revision();

create or replace function public.spara_projektrevision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.revision <> old.revision then
    insert into public.project_revisions (project_id, revision, description, answers, bom_lines)
    values (new.id, new.revision, new.description, new.answers, new.bom_lines)
    on conflict (project_id, revision) do nothing;
  end if;
  return null;
end $$;

drop trigger if exists projects_revisionslogg on public.projects;
create trigger projects_revisionslogg
  after insert or update on public.projects
  for each row execute function public.spara_projektrevision();

-- Befintliga projekt får sin revision 1 i loggen.
insert into public.project_revisions (project_id, revision, description, answers, bom_lines)
select id, revision, description, answers, bom_lines from public.projects
on conflict (project_id, revision) do nothing;

-- ── 2. Underlaget och dess revisioner ───────────────────────────────────────
create table if not exists public.plc_underlag (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null unique references public.projects(id) on delete cascade,
  revision     int not null default 1,
  kallrevision int not null,
  data         jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null,
  constraint plc_underlag_storlek check (octet_length(data::text) <= 1048576)
);

create table if not exists public.plc_underlag_revisioner (
  id           uuid primary key default gen_random_uuid(),
  underlag_id  uuid not null references public.plc_underlag(id) on delete cascade,
  revision     int not null,
  kallrevision int not null,
  data         jsonb not null,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  unique (underlag_id, revision)
);

alter table public.plc_underlag enable row level security;
alter table public.plc_underlag_revisioner enable row level security;

drop policy if exists "plc_underlag: owner read" on public.plc_underlag;
create policy "plc_underlag: owner read"
  on public.plc_underlag for select
  to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id
      and (p.user_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'))
  ));

drop policy if exists "plc_underlag_revisioner: owner read" on public.plc_underlag_revisioner;
create policy "plc_underlag_revisioner: owner read"
  on public.plc_underlag_revisioner for select
  to authenticated
  using (exists (
    select 1 from public.plc_underlag u
    join public.projects p on p.id = u.project_id
    where u.id = underlag_id
      and (p.user_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'))
  ));
-- Inga skrivregler: allt skrivs genom funktionerna nedan.

create index if not exists idx_plc_underlag_revisioner_underlag on public.plc_underlag_revisioner (underlag_id);

-- ── 3. Kontroller ──────────────────────────────────────────────────────────
-- Strukturen på underlaget. Detaljerna (unika id, referenser) kontrolleras
-- av samma TypeScript-modul som gränssnittet använder; här stoppas det som
-- aldrig får sparas oavsett klient.
create or replace function public.plc_kontrollera_data(p_data jsonb)
returns void language plpgsql immutable set search_path = public as $$
declare
  k text;
  tillatna text[] := array['schemaVersion', 'importerat', 'omfattning', 'plattform', 'funktion',
    'driftlagen', 'signaler', 'parametrar', 'steg', 'larm', 'testfall', 'antaganden', 'oppnaFragor', 'statusar'];
  listor text[] := array['driftlagen', 'signaler', 'parametrar', 'steg', 'larm', 'testfall', 'antaganden', 'oppnaFragor'];
  objekt text[] := array['importerat', 'omfattning', 'plattform', 'funktion', 'statusar'];
  -- Statusar som bara ett verktyg eller en granskningspost får sätta. Inget
  -- verktyg är anslutet och granskningsposterna kommer i fas 3, så de står
  -- på "inte_utfort" tills dess -- oavsett vad en klient skickar.
  last text[] := array['kodGenererad', 'statiskKontroll', 'kompilering', 'simulering', 'dokumentGranskat', 'tekniskGranskning'];
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'plc_data: underlaget måste vara ett objekt';
  end if;
  if coalesce(p_data->>'schemaVersion', '') <> '1' then
    raise exception 'plc_data: okänd schemaversion %', coalesce(p_data->>'schemaVersion', 'saknas');
  end if;
  for k in select jsonb_object_keys(p_data) loop
    if not k = any(tillatna) then
      raise exception 'plc_data: okänt fält %', k;
    end if;
  end loop;
  foreach k in array listor loop
    if p_data ? k and jsonb_typeof(p_data->k) <> 'array' then
      raise exception 'plc_data: % måste vara en lista', k;
    end if;
  end loop;
  foreach k in array objekt loop
    if p_data ? k and jsonb_typeof(p_data->k) <> 'object' then
      raise exception 'plc_data: % måste vara ett objekt', k;
    end if;
  end loop;
  foreach k in array last loop
    if coalesce(p_data #>> array['statusar', k, 'status'], 'inte_utfort') <> 'inte_utfort' then
      raise exception 'plc_data: statusen % kan bara sättas av ett verktyg eller en granskning', k;
    end if;
  end loop;
  if octet_length(p_data::text) > 1048576 then
    raise exception 'plc_data: underlaget är större än 1 MB';
  end if;
end $$;

create or replace function public.plc_ar_agare(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and (p.user_id = auth.uid() or has_role(auth.uid(), 'admin'))
  );
$$;

-- ── 4. Skapa och spara ─────────────────────────────────────────────────────
-- Ingång A: ett befintligt maskinprojekt får sitt underlag. Finns det redan
-- returneras det; kraven importeras av klienten ur projektets revision.
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
  select revision into rev from public.projects where id = p_project;
  insert into public.plc_underlag (project_id, revision, kallrevision, data, updated_by)
  values (p_project, 1, rev, p_data, auth.uid())
  returning * into u;
  insert into public.plc_underlag_revisioner (underlag_id, revision, kallrevision, data, created_by)
  values (u.id, 1, rev, p_data, auth.uid());
  return u;
end $$;

-- Ingång B: en befintlig maskin, utan maskinbyggarens komponenter. Samma
-- projektmodell, typ befintlig_maskin.
create or replace function public.skapa_befintlig_maskin(p_namn text, p_beskrivning text, p_locale text, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
begin
  if auth.uid() is null then
    raise exception 'plc: inloggning krävs' using errcode = '42501';
  end if;
  if coalesce(trim(p_namn), '') = '' then
    raise exception 'plc: projektet behöver ett namn';
  end if;
  perform public.plc_kontrollera_data(p_data);
  insert into public.projects (user_id, name, description, locale, typ)
  values (auth.uid(), left(trim(p_namn), 200), nullif(trim(coalesce(p_beskrivning, '')), ''), coalesce(nullif(p_locale, ''), 'sv'), 'befintlig_maskin')
  returning id into pid;
  perform public.skapa_plc_underlag(pid, p_data);
  return pid;
end $$;

-- Sparar en ny revision av underlaget. p_forvantad_revision är revisionen
-- klienten byggde på; har någon annan sparat sedan dess blir det en konflikt
-- (felkod 40001, meddelandet bär nuvarande revision) i stället för att den
-- sista vinner.
create or replace function public.spara_plc_underlag(p_id uuid, p_forvantad_revision int, p_data jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  u public.plc_underlag;
begin
  select * into u from public.plc_underlag where id = p_id for update;
  if not found or auth.uid() is null or not public.plc_ar_agare(u.project_id) then
    raise exception 'plc: underlaget finns inte eller tillhör någon annan' using errcode = '42501';
  end if;
  if u.revision <> p_forvantad_revision then
    raise exception 'plc_revisionskonflikt:%', u.revision using errcode = '40001';
  end if;
  perform public.plc_kontrollera_data(p_data);
  update public.plc_underlag
     set data = p_data, revision = u.revision + 1, updated_at = now(), updated_by = auth.uid()
   where id = p_id;
  insert into public.plc_underlag_revisioner (underlag_id, revision, kallrevision, data, created_by)
  values (p_id, u.revision + 1, u.kallrevision, p_data, auth.uid());
  return u.revision + 1;
end $$;

revoke all on function public.plc_kontrollera_data(jsonb) from public, anon;
revoke all on function public.plc_ar_agare(uuid) from public, anon;
revoke all on function public.skapa_plc_underlag(uuid, jsonb) from public, anon;
revoke all on function public.skapa_befintlig_maskin(text, text, text, jsonb) from public, anon;
revoke all on function public.spara_plc_underlag(uuid, int, jsonb) from public, anon;
grant execute on function public.skapa_plc_underlag(uuid, jsonb) to authenticated;
grant execute on function public.skapa_befintlig_maskin(text, text, text, jsonb) to authenticated;
grant execute on function public.spara_plc_underlag(uuid, int, jsonb) to authenticated;

grant select on public.project_revisions to authenticated;
grant select on public.plc_underlag to authenticated;
grant select on public.plc_underlag_revisioner to authenticated;
