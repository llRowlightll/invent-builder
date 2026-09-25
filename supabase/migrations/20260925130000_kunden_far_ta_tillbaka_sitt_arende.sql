-- Kunden får ta tillbaka ett ärende den själv skickat -- och provet städar.
--
-- TVÅ SAKER SOM HÖRDE IHOP:
--
-- 1. claims hade policyer för INSERT, SELECT och UPDATE ("Users update own
--    open claims") men ingen för DELETE. En kund som råkat skicka in fel sak,
--    eller löst problemet själv fem minuter senare, kunde alltså inte ta bort
--    sitt eget ärende -- bara ändra det. Det är en inkonsekvens: får man
--    skriva om ett öppet ärende får man rimligen också ångra det.
--
-- 2. Nattprovet test-customer-flows.py skapade ett ärende per körning och
--    raderade det aldrig. 39 påhittade rader låg i /admin/claims, noll
--    riktiga, och listan var oläslig. Provet kunde inte städa ens om det
--    ville, eftersom policyn saknades.
--
-- Villkoret är detsamma som för UPDATE: bara ett ÖPPET ärende. Så fort vi
-- börjat granska det är det en del av ärendehistoriken, och då ska det inte gå
-- att radera bort spåren.

begin;

drop policy if exists "Users delete own open claims" on public.claims;
create policy "Users delete own open claims" on public.claims
  for delete
  using (auth.uid() = user_id and status = 'open');

-- De 39 provraderna. Alla bär provets egen titel, alla är öppna, och det finns
-- noll riktiga ärenden -- kontrollerat innan raderingen.
delete from public.claims
 where title = '[TEST] automated flow check'
   and status = 'open';

commit;
