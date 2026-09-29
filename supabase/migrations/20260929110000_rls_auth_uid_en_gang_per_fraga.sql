-- auth.uid() räknades om EN GÅNG PER RAD i 16 policyer.
--
-- Postgres behandlar ett bart funktionsanrop i ett RLS-uttryck som volatilt och
-- kör det för varje rad den prövar. Wrappat i (select ...) blir det i stället
-- en initplan som körs en gång per fråga. Semantiken är oförändrad -- auth.uid()
-- ger samma svar hela frågan igenom -- men på en tabell med många rader är
-- skillnaden stor.
--
-- De flesta policyer var redan wrappade; normalformen i pg_policies är
-- "( SELECT auth.uid() AS uid)". En första sökning missade det eftersom den var
-- skiftlägeskänslig, och gav 68 träffar i stället för 16. Den här migrationen
-- rör alltså bara de 16 som verkligen hade ett bart anrop kvar.
--
-- Omskrivningen görs av databasen på det EXISTERANDE uttrycket, inte av en
-- handskriven kopia: en felskriven policy är ett säkerhetshål, och ingen ska
-- behöva lita på att någon skrev av 16 villkor rätt. Redan wrappade former
-- maskas först så de inte dubbelwrappas.
--
-- Verifierat efteråt i tre roller: anon utestängd från alla tio berörda
-- tabeller, admin insläppt i alla tio, och en inloggad kund som inte äger något
-- får noll rader utan fel. knowledge_chunks är avsiktligt öppen via en egen
-- "public read knowledge" med qual=true och rörs inte här.

begin;

do $$
declare
  r        record;
  v_using  text;
  v_check  text;
  c_mask   constant text := '@@REDAN_WRAPPAD@@';
  v_antal  int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
            ( regexp_count(coalesce(qual,''),       'auth\.uid\(\)', 1, 'i')
            - regexp_count(coalesce(qual,''),       'select\s+auth\.uid\(\)', 1, 'i') ) > 0
         or ( regexp_count(coalesce(with_check,''), 'auth\.uid\(\)', 1, 'i')
            - regexp_count(coalesce(with_check,''), 'select\s+auth\.uid\(\)', 1, 'i') ) > 0
          )
  loop
    v_using := r.qual;
    v_check := r.with_check;

    if v_using is not null then
      v_using := replace(v_using, '( SELECT auth.uid() AS uid)', c_mask);
      v_using := replace(v_using, 'auth.uid()', '(select auth.uid())');
      v_using := replace(v_using, c_mask, '( SELECT auth.uid() AS uid)');
    end if;
    if v_check is not null then
      v_check := replace(v_check, '( SELECT auth.uid() AS uid)', c_mask);
      v_check := replace(v_check, 'auth.uid()', '(select auth.uid())');
      v_check := replace(v_check, c_mask, '( SELECT auth.uid() AS uid)');
    end if;

    if v_using is not null and v_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)',
                     r.policyname, r.schemaname, r.tablename, v_using, v_check);
    elsif v_using is not null then
      execute format('alter policy %I on %I.%I using (%s)',
                     r.policyname, r.schemaname, r.tablename, v_using);
    elsif v_check is not null then
      execute format('alter policy %I on %I.%I with check (%s)',
                     r.policyname, r.schemaname, r.tablename, v_check);
    end if;

    v_antal := v_antal + 1;
    raise notice 'skrev om %.% / %', r.schemaname, r.tablename, r.policyname;
  end loop;
  raise notice 'klart: % policyer omskrivna', v_antal;
end $$;

commit;
