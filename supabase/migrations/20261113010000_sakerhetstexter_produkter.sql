-- Säkerhetstexter på sex produkter (kundgranskningen 2026-11-13).
--
-- SMC AKH är en vanlig backventil med instickskoppling: öppningstryck ca
-- 0,005 MPa, inte pilotstyrd (SMC AKH/AKB-katalogen, static.smc.eu). På en
-- cylinderport stänger den frånluften; den håller ingen last. AKH08A
-- beskrevs ändå som "Förhindrar att lasten faller vid luftbortfall i
-- vertikala pneumatiska lyftsystem", vilket motsäger guiden om vertikal last.
--
-- Avluftningsventilerna (VHS20, SAFEMAX) tar bort trycket som håller en
-- lodrät last, och HGL är ingen säkerhetsfunktion i sig (den kan läcka).
-- Samma budskap som guiden om vertikal last.

begin;

update products set
  description = 'Backventil (SMC AKH) med instickskoppling för 6 mm slang, gänga 1/4: fritt flöde i en riktning, spärr i den andra, öppningstryck ca 0,005 MPa. Inte pilotstyrd och ingen lasthållning: för att hålla en lodrät cylinder krävs en pilotstyrd backventil på cylinderporten (t.ex. Festo HGL) och mekanisk låsning där någon kan komma under lasten.',
  description_en = 'Check valve (SMC AKH) with one-touch fitting for 6 mm tube, 1/4 thread: free flow in one direction, blocked in the other, cracking pressure approx. 0.005 MPa. Not pilot-operated and not a load-holding valve: holding a vertical cylinder needs a pilot-operated check valve on the cylinder port (e.g. Festo HGL) and a mechanical lock wherever someone can get under the load.'
where sku = 'SMC-AKH06A-02S';

update products set
  description = 'Backventil (SMC AKH) med instickskoppling för 8 mm slang, gänga 1/4: fritt flöde i en riktning, spärr i den andra, öppningstryck ca 0,005 MPa. Inte pilotstyrd och ingen lasthållning: för att hålla en lodrät cylinder krävs en pilotstyrd backventil på cylinderporten (t.ex. Festo HGL) och mekanisk låsning där någon kan komma under lasten.',
  description_en = 'Check valve (SMC AKH) with one-touch fitting for 8 mm tube, 1/4 thread: free flow in one direction, blocked in the other, cracking pressure approx. 0.005 MPa. Not pilot-operated and not a load-holding valve: holding a vertical cylinder needs a pilot-operated check valve on the cylinder port (e.g. Festo HGL) and a mechanical lock wherever someone can get under the load.'
where sku = 'SMC-AKH08A-02S';

update products set
  description = 'Pilotstyrd backventil G1/4. Stänger cylinderporten när styrluften försvinner, så att cylindern stannar i läge vid luftbortfall. Pilotöppning vid 3,5 bar. Monteras direkt på cylinderporten. Ingen säkerhetsfunktion i sig: den kan läcka, och vid slangbrott mellan ventil och cylinder håller den inte. Där någon kan komma under lasten krävs dessutom mekanisk stånglåsning enligt riskbedömningen (ISO 13849).',
  description_en = 'Pilot-operated check valve G1/4. Closes the cylinder port when the pilot air is lost, so the cylinder stays in position on air failure. Pilot release at 3.5 bar. Mounted directly on the cylinder port. Not a safety function on its own: it can leak, and it does not hold if the tube between valve and cylinder breaks. Wherever someone can get under the load, a mechanical rod lock is also required according to the risk assessment (ISO 13849).'
where sku = 'FE-HGL-1-4-B';

update products set
  description = 'Avluftningsventil VHS20 (3-vägs, handmanövrerad) som stänger tillförseln och släpper ut restrycket vid service. Låsbar med hänglås. Rc1/4, 0,1–1,0 MPa. Obs: avluftningen tar bort trycket som håller en lodrät last. Säkra lasten mekaniskt innan du avluftar.',
  description_en = 'Pressure relief 3-port valve VHS20 (hand-operated) that shuts off the supply and exhausts residual pressure during maintenance. Lockable with a padlock. Rc1/4, 0.1–1.0 MPa. Note: exhausting removes the pressure that holds a vertical load. Secure the load mechanically before exhausting.'
where sku = 'SMC-VHS20-02A';

update products set
  description = description || ' Obs: snabbavluftningen tar bort trycket som håller en lodrät last. Där en last hänger ska den säkras mekaniskt innan avluftning.',
  description_en = description_en || ' Note: quick exhaust removes the pressure that holds a vertical load. Where a load hangs, secure it mechanically before exhausting.'
where sku in ('MX-SAFEMAX-1/2', 'MX-SAFEMAX-3/4')
  and description not like '%lodrät last%';

commit;
