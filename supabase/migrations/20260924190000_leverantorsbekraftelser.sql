-- Leverantörens orderbekräftelse (§5).
--
-- Leverantören svarar sällan "ja". De svarar "ja, men tre av fem, och den
-- fjärde kommer den 22:a, och priset är 4 % högre". Systemet ska JÄMFÖRA
-- svaret med vad vi beställde och klassa varje avvikelse:
--
--   GRÖN  ingen relevant avvikelse           -> uppdatera automatiskt
--   GUL   mindre avvikelse inom tillåtna     -> uppdatera och notifiera
--         regler
--   RÖD   prisändring, produktbyte, fel      -> STOPPA raden, kräv ett
--         antal, stor försening, teknisk        mänskligt godkännande
--         fråga
--
-- VAD SOM ÄR "MINDRE" ÄR PER LEVERANTÖR, inte en gissning i koden:
-- supplier_integrations bär price_tolerance_pct och delay_tolerance_days. De
-- kolumnerna har funnits sedan #272 utan att någon läst dem. Nu läses de, och
-- utan värde är toleransen NOLL -- varje avvikelse blir röd tills någon
-- medvetet säger att en viss leverantörs småjusteringar är okej. Tyst
-- acceptans ska kosta ett beslut, inte vara förvalt.
--
-- KUNDEN SER ALDRIG DET HÄR. Tabellen bär leverantörens egna ord
-- ("PO ACK line 20 rescheduled due ATP constraint") och våra inköpspriser.
-- Kundens text byggs senare ur de strukturerade fälten, inte ur noteringen.

begin;

create table if not exists supplier_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  spo_id uuid not null references supplier_purchase_orders(id) on delete cascade,
  -- Hur svaret kom in. 'email' och 'api' finns för FAS 2; i dag registreras
  -- bekräftelser för hand, och då ska det synas att en människa tolkat dem.
  source text not null default 'manual',
  received_at timestamptz not null default now(),
  registered_by uuid,
  /** Leverantörens eget ordernummer, det vi ska hänvisa till vid frågor. */
  supplier_reference text,
  /** Det som faktiskt kom in, obearbetat. Sparas så en feltolkning går att
      granska i efterhand -- svaret får aldrig bara vara det vi trodde. */
  raw_payload jsonb,
  /** Värsta nivån bland raderna: en röd rad gör hela bekräftelsen röd. */
  worst_level text,
  line_count int not null default 0,
  note text,
  created_at timestamptz not null default now()
);

comment on table supplier_acknowledgements is
  'Ett svar från en leverantör på en inköpsorder. Internt: bär leverantörens egna formuleringar och våra inköpspriser. Kundens text byggs ur de strukturerade fälten, aldrig ur note.';

create index if not exists sack_spo_idx on supplier_acknowledgements (spo_id);

-- Radens utfall. ack_qty/ack_unit_price/ack_delivery_date fanns redan tomma
-- sedan #279; nu fylls de, och de tre nya säger VARFÖR raden blev som den blev.
alter table supplier_purchase_order_items add column if not exists ack_id uuid references supplier_acknowledgements(id) on delete set null;
alter table supplier_purchase_order_items add column if not exists ack_reason text;
alter table supplier_purchase_order_items add column if not exists ack_substitute_sku text;
alter table supplier_purchase_order_items add column if not exists approved_by uuid;
alter table supplier_purchase_order_items add column if not exists approved_at timestamptz;

comment on column supplier_purchase_order_items.ack_status is
  'Avvikelsens nivå: gron, gul eller rod. Null tills leverantören svarat.';
comment on column supplier_purchase_order_items.ack_reason is
  'Varför raden fick sin nivå, i klartext. Intern -- kundens text byggs ur fälten.';
comment on column supplier_purchase_order_items.status is
  'pending -> confirmed (grön/gul) eller blocked (röd, väntar på godkännande) -> approved/cancelled.';

alter table supplier_acknowledgements enable row level security;

drop policy if exists "admins manage acks" on supplier_acknowledgements;
create policy "admins manage acks" on supplier_acknowledgements
  for all using (has_role(auth.uid(), 'admin')) with check (has_role(auth.uid(), 'admin'));

drop trigger if exists audit_sack on supplier_acknowledgements;
create trigger audit_sack after insert or update or delete on supplier_acknowledgements
  for each row execute function fn_audit_log();

commit;
