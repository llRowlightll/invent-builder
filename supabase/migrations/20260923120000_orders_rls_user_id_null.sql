-- orders: en order utan user_id var läsbar för ALLA inloggade.
--
-- Hittat när Order Engine skulle byggas ovanpå tabellen. Policyn löd
--
--   orders: owner read   using ((user_id IS NULL) OR (auth.uid() = user_id))
--
-- och admin.rfq.tsx skapar ordern med `user_id: selected.user_id ?? null` när
-- RFQ:n saknar konto. Varje sådan order kunde alltså läsas av vilken inloggad
-- användare som helst: kundens namn, e-post, organisationsnummer, PO-nummer,
-- belopp, fakturalänk och interna anteckningar. Provat före ändringen: en
-- inloggad användare som INTE äger ordern fick 1 rad.
--
-- Ingen skada har skett -- tabellen innehöll noll riktiga ordrar när det
-- upptäcktes. Men checkouten som ska byggas skapar precis sådana rader.
--
-- KLAUSULEN BEHÖVS INTE. Den publika orderbekräftelsen /oc/:id läser inte
-- tabellen direkt utan via get_order_by_id(uuid) -- security definer, körbar
-- av anon, och den returnerar en BEGRÄNSAD kolumnuppsättning utan
-- fakturalänk och interna anteckningar. Där är den ogissbara länken själva
-- behörigheten, precis som kommentaren i oc.$orderId.tsx säger.
--
-- Samma sak i insert-policyn: "OR user_id IS NULL" lät en inloggad användare
-- skapa ordrar som inte hör till någon. Admin skapar via "orders: admin all"
-- och påverkas inte.

begin;

drop policy "orders: owner read" on orders;
create policy "orders: owner read" on orders for select
  using ((select auth.uid()) = user_id);

drop policy "orders: owner insert" on orders;
create policy "orders: owner insert" on orders for insert
  with check ((select auth.uid()) = user_id);

commit;
