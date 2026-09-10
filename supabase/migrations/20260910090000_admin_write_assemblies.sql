-- Admin får skriva till aggregat och deras delar.
--
-- Steg 5 (exploded views). Båda tabellerna hade BARA select-policies, så ingen
-- kunde skapa innehållet: 29 delar finns inlagda men noll hotspots, noll
-- sprängskisser och noll kopplingar till katalogen -- för att det enda sättet
-- att sätta dem var att handskriva SQL som service role.
--
-- Vyn assembly.$slug.tsx är redan byggd och renderar hotspots ur hotspot_x/y
-- som procent av containern. Det som saknades var verktyget att placera dem,
-- och det kräver skrivrätt.
--
-- Samma ägaruttryck som orders: has_role(auth.uid(), 'admin'). Läsrätten är
-- oförändrad -- aggregaten ska fortsätta vara publika.

drop policy if exists "admin write assemblies" on public.assemblies;
create policy "admin write assemblies" on public.assemblies
  for all using (has_role((select auth.uid()), 'admin'))
          with check (has_role((select auth.uid()), 'admin'));

drop policy if exists "admin write assembly_parts" on public.assembly_parts;
create policy "admin write assembly_parts" on public.assembly_parts
  for all using (has_role((select auth.uid()), 'admin'))
          with check (has_role((select auth.uid()), 'admin'));

-- ROLLBACK:
--   drop policy if exists "admin write assemblies" on public.assemblies;
--   drop policy if exists "admin write assembly_parts" on public.assembly_parts;
