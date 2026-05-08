
-- =========================================================
-- ROLES
-- =========================================================
create type public.app_role as enum ('admin','editor','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create policy "user_roles self read" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "user_roles admin write" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- CATALOG
-- =========================================================
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  country text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  brand_id uuid not null references public.brands(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  family text,
  name text not null,
  description text,
  image_url text,
  lead_time_days int default 14,
  availability text default 'stock',
  ip_rating text,
  fieldbus text,
  voltage text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products(category_id);
create index on public.products(brand_id);

create table public.product_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  key text not null,
  value text not null,
  unit text,
  unique(product_id, key)
);

create table public.product_relations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  related_product_id uuid not null references public.products(id) on delete cascade,
  relation_type text not null,
  notes text,
  unique(product_id, related_product_id, relation_type)
);

create table public.competitor_map (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  competitor_product_id uuid not null references public.products(id) on delete cascade,
  match_quality text not null default 'equivalent',
  notes text,
  unique(product_id, competitor_product_id)
);

create table public.config_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  mode text not null default 'best',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.pneumatic_mappings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  rule jsonb not null,
  created_at timestamptz not null default now()
);

create table public.dataset_versions (
  id uuid primary key default gen_random_uuid(),
  version text unique not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- =========================================================
-- USER DATA
-- =========================================================
create table public.config_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_slug text,
  mode text not null default 'best',
  inputs jsonb not null default '{}',
  status text not null default 'draft',
  order_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.boms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.config_sessions(id) on delete set null,
  mode text not null default 'best',
  order_code text,
  total_items int default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.bom_items (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.boms(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  role text,
  qty int not null default 1,
  notes text
);
create index on public.bom_items(bom_id);

create table public.rfqs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bom_id uuid references public.boms(id) on delete set null,
  contact_name text,
  contact_email text,
  company text,
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table public.rfq_items (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  qty int not null default 1,
  role text
);

-- =========================================================
-- RLS
-- =========================================================
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_specs enable row level security;
alter table public.product_relations enable row level security;
alter table public.competitor_map enable row level security;
alter table public.config_templates enable row level security;
alter table public.pneumatic_mappings enable row level security;
alter table public.dataset_versions enable row level security;
alter table public.config_sessions enable row level security;
alter table public.boms enable row level security;
alter table public.bom_items enable row level security;
alter table public.rfqs enable row level security;
alter table public.rfq_items enable row level security;

-- public read for catalog
do $$
declare t text;
begin
  for t in select unnest(array['brands','categories','products','product_specs','product_relations','competitor_map','config_templates','pneumatic_mappings'])
  loop
    execute format('create policy "%s public read" on public.%I for select using (true)', t, t);
    execute format('create policy "%s admin write" on public.%I for all to authenticated using (public.has_role(auth.uid(),''admin'')) with check (public.has_role(auth.uid(),''admin''))', t, t);
  end loop;
end $$;

create policy "dataset_versions admin read" on public.dataset_versions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "dataset_versions admin write" on public.dataset_versions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- owner-private
create policy "config_sessions owner all" on public.config_sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "boms owner all" on public.boms for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bom_items owner all" on public.bom_items for all to authenticated
  using (exists (select 1 from public.boms b where b.id = bom_items.bom_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.boms b where b.id = bom_items.bom_id and b.user_id = auth.uid()));
create policy "rfqs owner all" on public.rfqs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rfq_items owner all" on public.rfq_items for all to authenticated
  using (exists (select 1 from public.rfqs r where r.id = rfq_items.rfq_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.rfqs r where r.id = rfq_items.rfq_id and r.user_id = auth.uid()));

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger config_sessions_touch before update on public.config_sessions for each row execute function public.touch_updated_at();

-- =========================================================
-- SEED v1
-- =========================================================
insert into public.dataset_versions(version, notes) values ('seed_v1','Initial seed dataset for demo');

insert into public.brands(slug,name,country) values
 ('festo','Festo','DE'),
 ('smc','SMC','JP'),
 ('siemens','Siemens','DE'),
 ('phoenix','Phoenix Contact','DE'),
 ('lapp','LAPP','DE'),
 ('weidmuller','Weidmüller','DE');

insert into public.categories(slug,name,description) values
 ('actuator','Actuator','Linear / rotary actuators'),
 ('drive','Drive / Servo','Servo drives & controllers'),
 ('psu','Power supply','24V / DC bus power supplies'),
 ('plc','PLC','Programmable logic controllers'),
 ('io','I/O module','Distributed I/O'),
 ('feedback','Feedback','Encoders & sensors'),
 ('cable','Cable','Power, motor, encoder, fieldbus cables'),
 ('accessory','Accessory','Mounts, brakes, couplings'),
 ('spare','Spare','Recommended spare parts');

-- products
with b as (select slug,id from public.brands), c as (select slug,id from public.categories)
insert into public.products(sku,brand_id,category_id,family,name,description,lead_time_days,availability,ip_rating,fieldbus,voltage)
select * from (values
 -- Festo electric actuators
 ('FE-EGSA-50-300', (select id from b where slug='festo'),(select id from c where slug='actuator'),'EGSA','EGSA-50 ball-screw axis 300mm','Electric linear axis, 300mm stroke',10,'stock','IP54',null,null),
 ('FE-EGSA-50-500', (select id from b where slug='festo'),(select id from c where slug='actuator'),'EGSA','EGSA-50 ball-screw axis 500mm','Electric linear axis, 500mm stroke',14,'stock','IP54',null,null),
 ('FE-EGSA-80-800', (select id from b where slug='festo'),(select id from c where slug='actuator'),'EGSA','EGSA-80 ball-screw axis 800mm','Heavy-duty linear axis, 800mm stroke',21,'stock','IP54',null,null),
 ('FE-DSBC-50-200', (select id from b where slug='festo'),(select id from c where slug='actuator'),'DSBC','DSBC-50 pneumatic cylinder 200mm','ISO 15552 cylinder Ø50, 200mm',7,'stock','IP65',null,null),
 ('FE-DSBC-63-300', (select id from b where slug='festo'),(select id from c where slug='actuator'),'DSBC','DSBC-63 pneumatic cylinder 300mm','ISO 15552 cylinder Ø63, 300mm',7,'stock','IP65',null,null),
 -- SMC equivalents
 ('SMC-LEFB25-300',(select id from b where slug='smc'),(select id from c where slug='actuator'),'LEFB','LEFB25 belt axis 300mm','Belt-driven electric axis, 300mm',14,'stock','IP54',null,null),
 ('SMC-LEFB32-500',(select id from b where slug='smc'),(select id from c where slug='actuator'),'LEFB','LEFB32 belt axis 500mm','Belt-driven electric axis, 500mm',18,'stock','IP54',null,null),
 ('SMC-CP96-50-200',(select id from b where slug='smc'),(select id from c where slug='actuator'),'CP96','CP96 cylinder Ø50 200mm','ISO 15552 cylinder Ø50, 200mm',5,'stock','IP65',null,null),
 -- Siemens drives
 ('SIE-V90-0R75',  (select id from b where slug='siemens'),(select id from c where slug='drive'),'SINAMICS V90','V90 servo drive 0.75kW','PROFINET, 1AC 230V, 0.75kW',10,'stock','IP20','PROFINET','230VAC'),
 ('SIE-V90-1R5',   (select id from b where slug='siemens'),(select id from c where slug='drive'),'SINAMICS V90','V90 servo drive 1.5kW','PROFINET, 3AC 400V, 1.5kW',10,'stock','IP20','PROFINET','400VAC'),
 ('SIE-S210-2R0',  (select id from b where slug='siemens'),(select id from c where slug='drive'),'SINAMICS S210','S210 servo drive 2.0kW','PROFINET, safety integrated',14,'stock','IP20','PROFINET','400VAC'),
 ('SIE-S210-4R0',  (select id from b where slug='siemens'),(select id from c where slug='drive'),'SINAMICS S210','S210 servo drive 4.0kW','PROFINET, safety integrated',18,'stock','IP20','PROFINET','400VAC'),
 -- PSU
 ('SIE-SITOP-10A', (select id from b where slug='siemens'),(select id from c where slug='psu'),'SITOP PSU100S','SITOP PSU100S 24V/10A','Stabilised 24VDC 10A power supply',5,'stock','IP20',null,'24VDC'),
 ('SIE-SITOP-20A', (select id from b where slug='siemens'),(select id from c where slug='psu'),'SITOP PSU8200','SITOP PSU8200 24V/20A','Stabilised 24VDC 20A power supply',7,'stock','IP20',null,'24VDC'),
 ('PHX-QUINT-10A', (select id from b where slug='phoenix'),(select id from c where slug='psu'),'QUINT4','QUINT4 PSU 24V/10A','Premium 24VDC 10A PSU',7,'stock','IP20',null,'24VDC'),
 -- PLC
 ('SIE-S71214',    (select id from b where slug='siemens'),(select id from c where slug='plc'),'S7-1200','S7-1200 CPU 1214C','Compact PLC, DC/DC/DC',7,'stock','IP20','PROFINET','24VDC'),
 ('SIE-S71515',    (select id from b where slug='siemens'),(select id from c where slug='plc'),'S7-1500','S7-1500 CPU 1515-2 PN','Mid-range PLC, 2x PROFINET',14,'stock','IP20','PROFINET','24VDC'),
 -- IO
 ('SIE-ET200SP-DI',(select id from b where slug='siemens'),(select id from c where slug='io'),'ET 200SP','ET 200SP DI 16x24VDC','16-channel digital input module',7,'stock','IP20','PROFINET','24VDC'),
 ('SIE-ET200SP-DO',(select id from b where slug='siemens'),(select id from c where slug='io'),'ET 200SP','ET 200SP DQ 16x24VDC/0.5A','16-channel digital output module',7,'stock','IP20','PROFINET','24VDC'),
 -- Feedback
 ('SIE-ENC-ABS22', (select id from b where slug='siemens'),(select id from c where slug='feedback'),'Absolute','Absolute encoder 22-bit DRIVE-CLiQ','Singleturn 22-bit absolute encoder',14,'stock','IP65',null,null),
 ('SIE-ENC-INC',   (select id from b where slug='siemens'),(select id from c where slug='feedback'),'Incremental','Incremental encoder 2500ppr','Incremental encoder, TTL',7,'stock','IP65',null,null),
 -- Cables
 ('LAPP-MOT-5M',   (select id from b where slug='lapp'),(select id from c where slug='cable'),'OLFLEX','Servo motor cable 5m','Pre-assembled motor cable, 5m',5,'stock','IP67',null,null),
 ('LAPP-ENC-5M',   (select id from b where slug='lapp'),(select id from c where slug='cable'),'UNITRONIC','Encoder cable 5m','Pre-assembled encoder cable, 5m',5,'stock','IP67',null,null),
 ('LAPP-PN-3M',    (select id from b where slug='lapp'),(select id from c where slug='cable'),'ETHERLINE','PROFINET cable 3m','Cat.5e PROFINET patch cable, 3m',3,'stock','IP67','PROFINET',null),
 -- Accessories
 ('FE-MOUNT-EGSA', (select id from b where slug='festo'),(select id from c where slug='accessory'),'Mount','Mounting kit EGSA','Floor mounting kit for EGSA axes',5,'stock',null,null,null),
 ('FE-COUP-50',    (select id from b where slug='festo'),(select id from c where slug='accessory'),'Coupling','Coupling for EGSA-50','Servo motor coupling',7,'stock',null,null,null),
 ('SIE-BRAKE-V90', (select id from b where slug='siemens'),(select id from c where slug='accessory'),'Brake','Holding brake for V90','24VDC holding brake',10,'stock',null,null,'24VDC'),
 -- Spares
 ('FE-SP-SEAL-50', (select id from b where slug='festo'),(select id from c where slug='spare'),'Seal kit','Seal kit DSBC-50','Recommended seal kit, Ø50',5,'stock',null,null,null),
 ('FE-SP-FILTER',  (select id from b where slug='festo'),(select id from c where slug='spare'),'Filter','Air filter cartridge','Spare filter cartridge',3,'stock',null,null,null),
 ('SIE-SP-FAN-V90',(select id from b where slug='siemens'),(select id from c where slug='spare'),'Fan','Spare fan for V90','Replacement cooling fan',7,'stock',null,null,null),
 ('WMU-TERM-20',   (select id from b where slug='weidmuller'),(select id from c where slug='accessory'),'Terminals','Terminal block set 20pcs','DIN-rail terminal blocks, 20pcs',3,'stock',null,null,null)
) as t;

-- specs (sample, ≥80)
insert into public.product_specs(product_id,key,value,unit)
select p.id, s.key, s.value, s.unit
from public.products p
join (values
 ('FE-EGSA-50-300','stroke','300','mm'),
 ('FE-EGSA-50-300','max_force','800','N'),
 ('FE-EGSA-50-300','max_speed','0.5','m/s'),
 ('FE-EGSA-50-300','repeatability','0.02','mm'),
 ('FE-EGSA-50-500','stroke','500','mm'),
 ('FE-EGSA-50-500','max_force','800','N'),
 ('FE-EGSA-50-500','max_speed','0.5','m/s'),
 ('FE-EGSA-50-500','repeatability','0.02','mm'),
 ('FE-EGSA-80-800','stroke','800','mm'),
 ('FE-EGSA-80-800','max_force','3000','N'),
 ('FE-EGSA-80-800','max_speed','1.0','m/s'),
 ('FE-EGSA-80-800','repeatability','0.05','mm'),
 ('FE-DSBC-50-200','bore','50','mm'),
 ('FE-DSBC-50-200','stroke','200','mm'),
 ('FE-DSBC-50-200','max_pressure','10','bar'),
 ('FE-DSBC-63-300','bore','63','mm'),
 ('FE-DSBC-63-300','stroke','300','mm'),
 ('FE-DSBC-63-300','max_pressure','10','bar'),
 ('SMC-LEFB25-300','stroke','300','mm'),
 ('SMC-LEFB25-300','max_force','350','N'),
 ('SMC-LEFB25-300','max_speed','2.0','m/s'),
 ('SMC-LEFB32-500','stroke','500','mm'),
 ('SMC-LEFB32-500','max_force','600','N'),
 ('SMC-LEFB32-500','max_speed','2.0','m/s'),
 ('SMC-CP96-50-200','bore','50','mm'),
 ('SMC-CP96-50-200','stroke','200','mm'),
 ('SMC-CP96-50-200','max_pressure','10','bar'),
 ('SIE-V90-0R75','power','0.75','kW'),
 ('SIE-V90-0R75','rated_current','5.0','A'),
 ('SIE-V90-0R75','fieldbus','PROFINET',null),
 ('SIE-V90-1R5','power','1.5','kW'),
 ('SIE-V90-1R5','rated_current','5.7','A'),
 ('SIE-V90-1R5','fieldbus','PROFINET',null),
 ('SIE-S210-2R0','power','2.0','kW'),
 ('SIE-S210-2R0','rated_current','7.3','A'),
 ('SIE-S210-2R0','safety','STO/SS1',null),
 ('SIE-S210-4R0','power','4.0','kW'),
 ('SIE-S210-4R0','rated_current','13.2','A'),
 ('SIE-S210-4R0','safety','STO/SS1',null),
 ('SIE-SITOP-10A','output_voltage','24','VDC'),
 ('SIE-SITOP-10A','output_current','10','A'),
 ('SIE-SITOP-20A','output_voltage','24','VDC'),
 ('SIE-SITOP-20A','output_current','20','A'),
 ('PHX-QUINT-10A','output_voltage','24','VDC'),
 ('PHX-QUINT-10A','output_current','10','A'),
 ('SIE-S71214','di_count','14',null),
 ('SIE-S71214','do_count','10',null),
 ('SIE-S71214','program_memory','100','kB'),
 ('SIE-S71515','di_count','0',null),
 ('SIE-S71515','program_memory','1500','kB'),
 ('SIE-ET200SP-DI','channels','16',null),
 ('SIE-ET200SP-DI','signal','24VDC',null),
 ('SIE-ET200SP-DO','channels','16',null),
 ('SIE-ET200SP-DO','load_current','0.5','A'),
 ('SIE-ENC-ABS22','resolution','22','bit'),
 ('SIE-ENC-ABS22','interface','DRIVE-CLiQ',null),
 ('SIE-ENC-INC','ppr','2500',null),
 ('SIE-ENC-INC','interface','TTL',null),
 ('LAPP-MOT-5M','length','5','m'),
 ('LAPP-MOT-5M','conductors','4',null),
 ('LAPP-ENC-5M','length','5','m'),
 ('LAPP-PN-3M','length','3','m'),
 ('LAPP-PN-3M','category','Cat.5e',null),
 ('FE-MOUNT-EGSA','material','Aluminium',null),
 ('FE-COUP-50','torque','5','Nm'),
 ('SIE-BRAKE-V90','holding_torque','3.2','Nm'),
 ('FE-SP-SEAL-50','for_bore','50','mm'),
 ('FE-SP-FILTER','micron','5','µm'),
 ('SIE-SP-FAN-V90','for_drive','V90',null),
 ('WMU-TERM-20','count','20','pcs'),
 ('FE-EGSA-50-300','feedback','incremental',null),
 ('FE-EGSA-50-500','feedback','incremental',null),
 ('FE-EGSA-80-800','feedback','absolute',null),
 ('SMC-LEFB25-300','feedback','incremental',null),
 ('SMC-LEFB32-500','feedback','absolute',null),
 ('SIE-V90-0R75','supports_feedback','incremental',null),
 ('SIE-V90-1R5','supports_feedback','incremental',null),
 ('SIE-S210-2R0','supports_feedback','absolute',null),
 ('SIE-S210-4R0','supports_feedback','absolute',null),
 ('FE-EGSA-50-300','recommended_drive','SIE-V90-0R75',null),
 ('FE-EGSA-50-500','recommended_drive','SIE-V90-1R5',null),
 ('FE-EGSA-80-800','recommended_drive','SIE-S210-4R0',null)
) as s(sku,key,value,unit) on s.sku = p.sku;

-- relations: actuator -> drive (requires), drive -> psu, plc -> io, drive -> cables, actuator -> spare, accessory
insert into public.product_relations(product_id, related_product_id, relation_type, notes)
select p1.id, p2.id, rel.rel, rel.notes from (values
 ('FE-EGSA-50-300','SIE-V90-0R75','requires','Recommended drive'),
 ('FE-EGSA-50-300','FE-COUP-50','requires','Coupling'),
 ('FE-EGSA-50-300','FE-MOUNT-EGSA','compatible','Mounting kit'),
 ('FE-EGSA-50-300','SIE-ENC-INC','compatible','Incremental feedback'),
 ('FE-EGSA-50-500','SIE-V90-1R5','requires','Recommended drive'),
 ('FE-EGSA-50-500','FE-COUP-50','requires','Coupling'),
 ('FE-EGSA-50-500','SIE-ENC-INC','compatible','Incremental feedback'),
 ('FE-EGSA-80-800','SIE-S210-4R0','requires','Heavy-duty drive'),
 ('FE-EGSA-80-800','SIE-ENC-ABS22','requires','Absolute encoder'),
 ('FE-EGSA-80-800','FE-MOUNT-EGSA','compatible','Mounting'),
 ('SMC-LEFB25-300','SIE-V90-0R75','compatible','Compatible drive'),
 ('SMC-LEFB32-500','SIE-S210-2R0','compatible','Compatible drive'),
 ('SIE-V90-0R75','SIE-SITOP-10A','requires','24V control supply'),
 ('SIE-V90-1R5','SIE-SITOP-10A','requires','24V control supply'),
 ('SIE-S210-2R0','SIE-SITOP-20A','requires','24V control supply'),
 ('SIE-S210-4R0','SIE-SITOP-20A','requires','24V control supply'),
 ('SIE-V90-0R75','LAPP-MOT-5M','requires','Motor cable'),
 ('SIE-V90-0R75','LAPP-ENC-5M','requires','Encoder cable'),
 ('SIE-V90-1R5','LAPP-MOT-5M','requires','Motor cable'),
 ('SIE-V90-1R5','LAPP-ENC-5M','requires','Encoder cable'),
 ('SIE-S71214','SIE-ET200SP-DI','compatible','Distributed I/O'),
 ('SIE-S71214','SIE-ET200SP-DO','compatible','Distributed I/O'),
 ('SIE-S71214','LAPP-PN-3M','requires','PROFINET cable'),
 ('SIE-S71515','LAPP-PN-3M','requires','PROFINET cable'),
 ('FE-DSBC-50-200','FE-SP-SEAL-50','spare_of','Seal kit'),
 ('FE-DSBC-63-300','FE-SP-FILTER','spare_of','Filter'),
 ('SIE-V90-0R75','SIE-SP-FAN-V90','spare_of','Spare fan')
) as rel(a,b,rel,notes)
join public.products p1 on p1.sku = rel.a
join public.products p2 on p2.sku = rel.b;

-- competitor map
insert into public.competitor_map(product_id, competitor_product_id, match_quality, notes)
select p1.id, p2.id, m.q, m.n from (values
 ('FE-EGSA-50-300','SMC-LEFB25-300','equivalent','Similar stroke, lower force on SMC'),
 ('FE-EGSA-50-500','SMC-LEFB32-500','equivalent','Similar stroke'),
 ('FE-DSBC-50-200','SMC-CP96-50-200','equivalent','ISO 15552 cylinders'),
 ('SMC-LEFB25-300','FE-EGSA-50-300','equivalent','Reverse map'),
 ('SMC-LEFB32-500','FE-EGSA-50-500','equivalent','Reverse map'),
 ('SMC-CP96-50-200','FE-DSBC-50-200','equivalent','Reverse map')
) as m(a,b,q,n)
join public.products p1 on p1.sku=m.a
join public.products p2 on p2.sku=m.b;

-- templates
insert into public.config_templates(slug,name,mode,payload) values
 ('ea-linear-axis-bundle-best','EA Linear Axis Bundle (Best)','best',
  '{"steps":["basic","motion","control","accessories","overview"],"defaults":{"stroke_mm":500,"force_n":800,"voltage":"230VAC","fieldbus":"PROFINET","feedback":"incremental","ip":"IP54"}}'::jsonb),
 ('ea-linear-axis-bundle-cheapest','EA Linear Axis Bundle (Cheapest)','cheapest',
  '{"steps":["basic","motion","control","accessories","overview"],"defaults":{"stroke_mm":300,"force_n":350,"voltage":"230VAC","fieldbus":"PROFINET","feedback":"incremental","ip":"IP54"}}'::jsonb);

-- pneumatic mapping
insert into public.pneumatic_mappings(slug,name,rule) values
 ('cylinder-to-ea','ISO 15552 cylinder → EA bundle',
  '{"formula":"force_n = pressure_bar * 1e5 * pi * (bore_m/2)^2","margin":1.3,"select":{"actuator":"category=actuator","drive":"by force"}}'::jsonb);
