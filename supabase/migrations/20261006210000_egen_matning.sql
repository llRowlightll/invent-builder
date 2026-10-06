-- Egen, anonym mätning av hur sajten används.
--
-- Google Analytics laddas aldrig i drift: VITE_GA_ID är tomt. Och även med ett
-- id mäter GA bara dem som klickar "Acceptera alla". Inför LinkedIn-lanseringen
-- behövs svar på enkla frågor -- kom någon från LinkedIn, sökte de, frågade de
-- AI:n, gjorde de en stycklista, begärde de offert? -- för ALLA besök.
--
-- Därför: inga cookies, ingen IP-adress, inget användar-id, inget som pekar ut
-- en person. Bara händelsetyp, sida, språk och ett litet faktaobjekt. Skrivning
-- sker enbart via logga_handelse(), som avvisar okända typer och för stora
-- objekt och har ett totaltak mot skräp. Bara administratörer kan läsa.

create table if not exists public.handelser (
  id bigint generated always as identity primary key,
  typ text not null check (typ in ('besok', 'sok', 'ai_fraga', 'stycklista', 'offert', 'ersatt')),
  sida text,
  sprak text,
  data jsonb not null default '{}'::jsonb,
  skapad timestamptz not null default now()
);

create index if not exists handelser_typ_skapad on public.handelser (typ, skapad desc);

alter table public.handelser enable row level security;

drop policy if exists "Administratörer läser händelser" on public.handelser;
create policy "Administratörer läser händelser" on public.handelser
  for select to authenticated
  using (public.has_role((select auth.uid()), 'admin'));

create or replace function public.logga_handelse(p_typ text, p_sida text, p_sprak text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_typ not in ('besok', 'sok', 'ai_fraga', 'stycklista', 'offert', 'ersatt') then return; end if;
  if p_data is not null and pg_column_size(p_data) > 2000 then return; end if;
  -- Totaltak mot skräp: 600 händelser i minuten räcker långt för en lansering.
  if not public.check_rate_limit('handelser', 600, 60) then return; end if;
  insert into public.handelser (typ, sida, sprak, data)
  values (p_typ, left(p_sida, 200), left(p_sprak, 5), coalesce(p_data, '{}'::jsonb));
  -- Integritetspolicyn lovar radering efter 13 månader. Ingen schemaläggare
  -- behövs: ungefär var femhundrade skrivning städar.
  if random() < 0.002 then
    delete from public.handelser where skapad < now() - interval '13 months';
  end if;
end;
$function$;

revoke all on function public.logga_handelse(text, text, text, jsonb) from public;
grant execute on function public.logga_handelse(text, text, text, jsonb) to anon, authenticated;
