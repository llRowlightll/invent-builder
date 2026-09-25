-- Tre främmande nycklar utan täckande index, alla på Order Engine-tabellerna.
--
-- Utan dem blir en radering eller uppdatering av moderraden en full scan, och
-- de växer med ordervolymen. Billigt nu, dyrt att upptäcka senare.
--
-- Hittat av Supabase prestandalint i lanseringsgenomgången.

begin;

create index if not exists order_items_product_idx
  on order_items (product_id);

create index if not exists order_status_events_actor_idx
  on order_status_events (actor_user_id);

create index if not exists spoi_ack_idx
  on supplier_purchase_order_items (ack_id);

commit;
