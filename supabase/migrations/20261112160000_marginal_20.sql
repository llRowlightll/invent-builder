-- Ägarens beslut 2026-11-12: alla artiklar 20 % marginal till att börja med.
--
-- "Köper vi för 100 kr säljer vi för 125 kr och tjänar 25." Det är
-- bruttomarginal 20 % i den definition Prissättning och publika_priser
-- använder: säljpris = inköp ÷ (1 − 20/100) = inköp × 1,25.
--
-- Ersätter de differentierade standardmarginalerna från 20260603000300
-- (22/30/40 %) och de 155 raderna med bråktalet 0,35 (se 20261112140000).
-- Ingen artikel har ännu ett inköpspris, så inget pris ändras i dag.

begin;

update public.products set margin = 20 where margin is distinct from 20;

alter table public.products alter column margin set default 20;

commit;
