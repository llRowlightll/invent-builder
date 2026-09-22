-- Två fynd ur dubbelkollen 2026-09-21, nu åtgärdade.
--
-- 1. JSY-MANUALERNA LÅG PÅ FAMILJEN SY3000. Fyra driftmanualer heter
--    smc-SY3000-om_*.pdf men är enligt sin egen förstasida
--    "JSY1000/3000/5000 Series" och "25A-JSY1000/3000 Series" -- JSY är en
--    egen, nyare kompaktserie med egen beställnyckel, inte SY3000. Kopplingen
--    gjorde att sy3000-sidan listade fel tillverkarunderlag och att
--    rådgivaren kunde citera JSY-data för en SY-ventil. Samma sorts fel som
--    smc-kat-mhz2.pdf (som var JMHZ2) och SMC-MHC2 ("3-Finger Radial
--    Gripper", vilket är MHS3).
--
--    Dokumentkartan tas bort; STYCKENA ligger kvar i knowledge_chunks och är
--    fortfarande sökbara. Någon familj att peka på finns inte: JSY har varken
--    modellerad nyckel eller produktrader, och att skapa en familj utan
--    beställnyckel vore samma halvmodellering som ISV avvisades för.
--    sy3000 behåller sin riktiga katalog (smc-kat-sy3000.pdf, 1 645 stycken).
--
-- 2. SMC-CJ2B20 ÄR ETT PÅHITTAT ARTIKELNUMMER. CJ2 finns i ø6, ø10 och ø16
--    (katalogen, och cj2.test.ts slår fast att CJ2B20-60Z inte går att tolka);
--    strängen "CJ2B20" förekommer noll gånger i katalogens 586 stycken.
--    Raden stod redan som 'discontinued' sedan 2026-05-20 -- men av andra skäl
--    än att den är påhittad, och den bar fem tekniska specar som påstod en
--    borrning som aldrig funnits. max_pressure stod dessutom kvar på 10
--    (provtrycket) medan CJ2 rättades till 7 bar i #236.
--
--    Raden BEHÅLLS (policyn är discontinued, inte radering; inget pekar på
--    den: 0 bom_items, 0 competitor_map, 0 product_relations, 0 rfq_items)
--    men görs ärlig: namnet och beskrivningen säger vad den är, och de
--    påhittade specarna tas bort. Kvar blir en gravsten som ingen kan råka
--    återuppliva som en riktig produkt.

begin;

create schema if not exists backup;

create table if not exists backup.jsy_dokumentkarta_20260922 as
  select * from knowledge_doc_families
  where source_file like 'smc-SY3000-om%' and family_slug = 'sy3000';

delete from knowledge_doc_families
where source_file like 'smc-SY3000-om%' and family_slug = 'sy3000';

create table if not exists backup.cj2b20_specs_20260922 as
  select s.* from product_specs s join products p on p.id = s.product_id
  where p.sku = 'SMC-CJ2B20';

delete from product_specs s using products p
where s.product_id = p.id and p.sku = 'SMC-CJ2B20';

update products set
  name = 'SMC CJ2B20 – finns inte (påhittat artikelnummer)',
  description = 'Artikelnumret finns inte hos SMC. CJ2 tillverkas i ø6, ø10 och ø16 '
    || '(CAT.ES20-200, How to Order); "CJ2B20" förekommer inte i katalogen. Raden '
    || 'behålls som gravsten så att numret inte råkar återanvändas, och de fem '
    || 'tekniska specarna (bore_mm 20, max_pressure 10, stroke_mm 200 …) är '
    || 'borttagna eftersom de beskrev en produkt som aldrig funnits. '
    || 'Se SMC-CJ2B10 och SMC-CJ2B16 för de riktiga storlekarna.',
  status = 'discontinued'
where sku = 'SMC-CJ2B20';

commit;
