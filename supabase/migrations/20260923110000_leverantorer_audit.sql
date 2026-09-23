-- Leverantörstabellerna saknade husets två standardtriggrar.
--
-- Efterkontroll av 20260923100000: rfqs, shipments och company_profiles har
-- alla fn_audit_log, och orders/projects har set_updated_at. De tre nya
-- leverantörstabellerna hade ingen av dem.
--
-- Det är inte en skönhetsfråga. Specen kräver att varje manuell ändring går
-- att härleda till vem, vad, före, efter och när -- och supplier_products är
-- den tabell i hela databasen som innehåller våra INKÖPSPRISER. Att ändra ett
-- inköpspris utan spår är precis det som inte får kunna hända.
--
-- updated_at sattes dessutom från klienten i adminsidan. Det håller inte: en
-- ändring gjord direkt i SQL-editorn eller av en kommande edge function hade
-- lämnat kolumnen stillastående. Triggern gör den tillförlitlig.

begin;

create trigger suppliers_updated_at before update on suppliers
  for each row execute function set_updated_at();
create trigger supplier_integrations_updated_at before update on supplier_integrations
  for each row execute function set_updated_at();
create trigger supplier_products_updated_at before update on supplier_products
  for each row execute function set_updated_at();

create trigger audit_suppliers after insert or update or delete on suppliers
  for each row execute function fn_audit_log();
create trigger audit_supplier_integrations after insert or update or delete on supplier_integrations
  for each row execute function fn_audit_log();
create trigger audit_supplier_products after insert or update or delete on supplier_products
  for each row execute function fn_audit_log();

commit;
