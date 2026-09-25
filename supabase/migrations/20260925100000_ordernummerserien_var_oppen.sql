-- Vem som helst kunde bränna ordernummer.
--
-- HITTAT i en säkerhetsgenomgång med Supabase-linten, och bekräftat utifrån med
-- bara den publika anon-nyckeln:
--
--   POST /rest/v1/rpc/next_order_number   →  200  "MV-2026-00019"
--
-- Funktionerna är SECURITY DEFINER och fick aldrig sina grants återkallade.
-- Varje anrop räknar upp document_number_counters. En utomstående kunde alltså
-- dra serien till MV-2026-99999, eller strö luckor i den -- och luckor är
-- precis vad numreringen byggdes för att undvika. Min egen kommentar i
-- 20260924150000 säger det: "luckor är svåra att förklara för en revisor".
--
-- Ingen roll behöver EXECUTE på dem. Triggerfunktioner anropas av triggern,
-- inte av en klient, och Postgres kontrollerar inte EXECUTE när en trigger
-- fyrar. next_order_number anropas i sin tur av set_order_number, som är
-- SECURITY DEFINER och kör som ägaren.
--
-- Samma sak gäller de andra interna: refresh_order_items_json bygger om
-- orders.items, och order_items_sync_* är triggerkroppar.

begin;

revoke all on function next_document_number(text)        from public, anon, authenticated;
revoke all on function next_order_number()               from public, anon, authenticated;
revoke all on function refresh_order_items_json(uuid[])  from public, anon, authenticated;
revoke all on function set_order_number()                from public, anon, authenticated;
revoke all on function set_supplier_po_number()          from public, anon, authenticated;
revoke all on function log_order_status_event()          from public, anon, authenticated;
revoke all on function order_items_sync_ins()            from public, anon, authenticated;
revoke all on function order_items_sync_upd()            from public, anon, authenticated;
revoke all on function order_items_sync_del()            from public, anon, authenticated;
revoke all on function set_updated_at()                  from public, anon, authenticated;
revoke all on function fn_audit_log()                    from public, anon, authenticated;

-- klassificera_avvikelse saknade search_path. Den är ren och inte SECURITY
-- DEFINER, så risken är liten, men en funktion utan fast search_path kan
-- luras att läsa fel schema om någon lägger till ett eget i sin sökväg.
alter function klassificera_avvikelse(numeric, numeric, date, numeric, numeric, date, text, text, numeric, int)
  set search_path = public;

-- Serien nollställs: noll ordrar har lagts, och de nummer som brändes kom
-- från prov och från den här genomgången. Första riktiga kundordern ska heta
-- MV-2026-00001, inte MV-2026-00020.
delete from document_number_counters
 where not exists (select 1 from orders)
   and not exists (select 1 from supplier_purchase_orders);

commit;
