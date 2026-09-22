-- DSNU: fyra saknade borrningar och en dämpningskod som inte finns.
--
-- Familjen dsnu är en av de ~135 som aldrig kontrollerats mot sin katalog.
-- Underlaget ligger inläst (202923_documentation.pdf, 108 stycken) och
-- typkodstabellen i stycke 8 är entydig:
--
--   001 Series            DSNU  Round cylinder, double-acting, based on ISO 6432
--   002 Piston diameter   8 10 12 16 20 25 32 40 50 63
--   003 Stroke range      1 ... 500
--   004 Cushioning        P    Elastic cushioning rings/plates on both sides
--                         PPS  Pneumatic cushioning, self-adjusting at both ends
--                         PPV  Pneumatic cushioning, adjustable at both ends
--   005 Position sensing  A    For proximity sensor
--
-- TVÅ FEL:
--
-- 1. Borrningslistan slutade vid 25. Katalogen har 32, 40, 50 och 63 också --
--    med egna måttabeller (stycke 22–23) och egna kurvor (stycke 16–17). Vi
--    SÄLJER dem redan: FESTO-DSNU-32, -40, -50 och -63 ligger som aktiva
--    produkter. Kunden kunde alltså inte konfigurera fyra storlekar vi har i
--    sortimentet. (Motsatsen till SMC-CJ2B20, där produktraden var påhittad
--    och katalogen hade rätt.)
--
-- 2. Dämpningen listade "PPVA — Pneumatisk, självjusterande". Den koden finns
--    inte. PPVA är vad mallen SKRIVER när man väljer dämpning PPV och
--    lägesavkänning A: DSNU-25-100-PPV + A. Någon har läst en färdig
--    artikelkod baklänges och gjort sammanskrivningen till ett eget
--    dämpningsalternativ. Katalogens självjusterande dämpning heter PPS.
--
-- ETIKETTERNA SKRIVS PÅ ENGELSKA. Konventionen är engelsk text i databasen
-- som översätts av src/lib/catalog/labels-sv.ts vid rendering -- svensk text
-- i kolumnen hade visats rakt av för en tysk eller spansk kund. De 33 andra
-- familjer som har samma dämpningsval använder redan exakt "Elastic",
-- "Pneumatic adjustable" och "Pneumatic self-adjusting", som alla tre har
-- mappningar i labels-sv.ts. DSNU hade i stället "Pneumatic adjustable
-- (self-adj.)" -- ännu ett tecken på att raden är handskriven och inte
-- hämtad ur katalogen.
--
-- Värdena säkerhetskopieras före ändringen.

begin;

create schema if not exists backup;

create table if not exists backup.dsnu_varden_20260922 as
  select v.*, p.param_key
  from configurator_param_values v
  join configurator_params p on p.id = v.param_id
  join configurator_families f on f.id = p.family_id
  where f.slug = 'dsnu';

insert into configurator_param_values (param_id, code, label, sort_order)
select p.id, x.code, x.label, x.sort_order
from configurator_params p
join configurator_families f on f.id = p.family_id
cross join (values
  ('32', '32 mm', 7),
  ('40', '40 mm', 8),
  ('50', '50 mm', 9),
  ('63', '63 mm', 10)
) as x(code, label, sort_order)
where f.slug = 'dsnu' and p.param_key = 'bore_mm'
  and not exists (
    select 1 from configurator_param_values v
    where v.param_id = p.id and v.code = x.code);

-- PPVA fanns inte: koden är PPS (självjusterande), "Type codes DSNU-...".
update configurator_param_values v
set code = 'PPS'
from configurator_params p, configurator_families f
where v.param_id = p.id and p.family_id = f.id
  and f.slug = 'dsnu' and p.param_key = 'cushioning' and v.code = 'PPVA';

-- Samma tre etiketter som de 33 andra familjerna med samma val använder.
update configurator_param_values v
set label = case v.code
      when 'P'   then 'Elastic'
      when 'PPV' then 'Pneumatic adjustable'
      when 'PPS' then 'Pneumatic self-adjusting'
      else v.label end
from configurator_params p, configurator_families f
where v.param_id = p.id and p.family_id = f.id
  and f.slug = 'dsnu' and p.param_key = 'cushioning';

commit;
