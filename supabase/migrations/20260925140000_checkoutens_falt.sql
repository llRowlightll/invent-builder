-- Checkoutens fält (§2), på både förfrågan och order.
--
-- Kunden kunde beställa utan att någonsin ange VART varan skulle. Formuläret
-- frågade efter namn, e-post, telefon, företag, orgnummer och ett PO-nummer --
-- inte efter leveransadress, fakturaadress, önskat datum eller om delleverans
-- är okej. orders hade dessutom inga adressfält alls: bara delivered_at och
-- estimated_delivery.
--
-- rfqs.address_* fanns redan men fylldes aldrig av någon. Den används nu som
-- LEVERANSADRESS, vilket är den naturliga läsningen och samma roll som
-- company_profiles.address_* har i book-shipment.
--
-- ALLT SPEGLAS PÅ orders. En order som inte bär sin egen leveransadress är
-- beroende av att förfrågan finns kvar och är oförändrad -- och §3 säger att
-- ordern ska spara en FRYST kopia av det som gällde vid köpet. Adressen är en
-- del av det: flyttar kunden efter att ordern lagts ska den gamla ordern
-- fortfarande visa vart den skickades.
--
-- DELLEVERANS ÄR ETT VAL KUNDEN GÖR, inte något vi antar. §2: "möjlighet att
-- välja mellan delleverans och samlad leverans". Utan fältet hade vi gissat,
-- och gissningen hade blivit synlig först när halva ordern kom.

begin;

-- ── Förfrågan ─────────────────────────────────────────────────────────────
alter table public.rfqs add column if not exists delivery_name        text;
alter table public.rfqs add column if not exists invoice_street       text;
alter table public.rfqs add column if not exists invoice_postal       text;
alter table public.rfqs add column if not exists invoice_city         text;
alter table public.rfqs add column if not exists invoice_country      text;
alter table public.rfqs add column if not exists invoice_email        text;
alter table public.rfqs add column if not exists desired_delivery_date date;
alter table public.rfqs add column if not exists delivery_instructions text;
alter table public.rfqs add column if not exists delivery_mode        text;
alter table public.rfqs add column if not exists customer_reference   text;

alter table public.rfqs drop constraint if exists rfqs_delivery_mode_check;
alter table public.rfqs add constraint rfqs_delivery_mode_check
  check (delivery_mode is null or delivery_mode in ('partial', 'consolidated'));

comment on column public.rfqs.delivery_mode is
  'partial = skicka det som finns, consolidated = vänta tills allt är komplett. Null = kunden har inte valt (gammal rad eller offertförfrågan).';
comment on column public.rfqs.customer_reference is
  'Kundens interna referens -- projekt, kostnadsställe, beställarens namn. Följer med på leverantörens följesedel när vi dropshippar.';

-- ── Ordern bär sin egen kopia ─────────────────────────────────────────────
alter table public.orders add column if not exists delivery_name        text;
alter table public.orders add column if not exists delivery_street      text;
alter table public.orders add column if not exists delivery_postal      text;
alter table public.orders add column if not exists delivery_city        text;
alter table public.orders add column if not exists delivery_country     text;
alter table public.orders add column if not exists invoice_street       text;
alter table public.orders add column if not exists invoice_postal       text;
alter table public.orders add column if not exists invoice_city         text;
alter table public.orders add column if not exists invoice_country      text;
alter table public.orders add column if not exists invoice_email        text;
alter table public.orders add column if not exists contact_phone        text;
alter table public.orders add column if not exists desired_delivery_date date;
alter table public.orders add column if not exists delivery_instructions text;
alter table public.orders add column if not exists delivery_mode        text;
alter table public.orders add column if not exists customer_reference   text;

alter table public.orders drop constraint if exists orders_delivery_mode_check;
alter table public.orders add constraint orders_delivery_mode_check
  check (delivery_mode is null or delivery_mode in ('partial', 'consolidated'));

comment on column public.orders.delivery_street is
  'Fryst kopia av leveransadressen som gällde när ordern lades. Flyttar kunden ska den gamla ordern fortfarande visa vart den skickades.';

commit;
