-- Steg 0 av maskinmodellen: gör bom_items till den lagrade sanningen för en
-- stycklista, och ge den de fält en canvas behöver för att hänga kopplingar på.
--
-- BAKGRUND
-- boms + bom_items modellerades en gång med rätt nycklar (bom_items.bom_id ->
-- boms.id ON DELETE CASCADE, projects.bom_id -> boms.id ON DELETE SET NULL) men
-- skrivvägen kopplades aldrig in: 0 rader i båda, ingen INSERT någonstans i
-- kodbasen, och /bom/:bomId läser dem utan att något länkar dit.
-- Migrationen 20260819170000 dokumenterar redan samma sak. Maskinbyggaren
-- sparar istället en JSON-snapshot i projects.bom_lines.
--
-- JSON-blobben duger inte för nästa steg: byter användaren en komponent får den
-- nya raden inget stabilt id, och varje koppling som pekade på den gamla blir
-- föräldralös. bom_items.id är redan en uuid med FK till produkten -- det är
-- den identiteten canvasen behöver.
--
-- VARFÖR NYA KOLUMNER BEHÖVS
-- bom_items har idag { bom_id, product_id, qty, role, notes } och product_id är
-- nullable. Men rådgivaren producerar rader som INTE är katalogprodukter:
--   • "SPECIFY"          -- rätt komponent finns men ingen matchande SKU i katalogen
--   • "CUSTOM-SOLUTION"  -- kräver offert
--   • rena varningsrader (⚠️/⛔), t.ex. obligatorisk stångbroms vid vertikal last
-- För dessa är product_id NULL, och utan en egen sku-kolumn förlorar raden all
-- identitet. Därför sku text: SKU:n exakt som rådgivaren skrev den, oavsett om
-- den motsvarar en katalograd.
--
-- reason är den tekniska motiveringen ("krävs enligt ISO 13849 PLd"). Den finns
-- i rådgivarens utdata men tappas redan idag av JSON-snapshotten, som bara
-- sparar { sku, role, qty, name }. Den är det mest värdefulla innehållet i en
-- stycklista och ska inte gå förlorad en gång till. Egen kolumn, inte notes --
-- notes är avsedd för användarens egna anteckningar, och att blanda ihop
-- AI-genererad motivering med användartext biter tillbaka så fort man kan
-- annotera i canvasen.
--
-- FALLBACK
-- Allt här är additivt. Ingen befintlig kolumn ändras, ingen data flyttas,
-- projects.bom_lines lämnas orörd och fortsätter fungera exakt som förut. Går
-- något snett är återställningen att köra rollback-blocket längst ned; appen
-- faller då tillbaka på JSON-vägen utan att någon användare märker något.

-- ── 1. Fält på bom_items ────────────────────────────────────────────────────
alter table public.bom_items
  add column if not exists sku        text,
  add column if not exists reason     text,
  add column if not exists subsystem  text,
  add column if not exists sort_order integer;

comment on column public.bom_items.sku is
  'SKU exakt som rådgivaren angav den, även när den inte motsvarar en katalogprodukt (SPECIFY, CUSTOM-SOLUTION, varningsrader). Sätts alltid; product_id sätts bara när SKU:n finns i products.';
comment on column public.bom_items.reason is
  'Rådgivarens tekniska motivering till raden. Skilt från notes, som är användarens egna anteckningar.';
comment on column public.bom_items.subsystem is
  'Fritt grupperingsfält (t.ex. "lyftstation"). Bär hierarkin maskin -> delsystem -> komponent. NULL = ogrupperad.';
comment on column public.bom_items.sort_order is
  'Radordning som rådgivaren gav den -- primär aktuator först, varningsrader sist. Utan denna tappas ordningen vid inläsning.';

-- Radordning är bara meningsfull inom en stycklista.
create index if not exists bom_items_bom_id_sort_idx
  on public.bom_items (bom_id, sort_order);

-- ── 2. Kopplingar mellan komponenter ────────────────────────────────────────
-- Relationstyperna är medvetet SAMMA vokabulär som public.product_relations
-- redan använder (controlled_by 12 rader, air_supply 6, requires 2, accessory
-- 53). Katalogregler och maskininstanser talar då samma språk, vilket är hela
-- poängen med steg 1: AI:n ska härleda topologin ur relationer som redan finns,
-- inte gissa fritt.
--
-- Ingen FK-riktning implicerar dataflöde: "A controlled_by B" betyder att A
-- styrs av B (cylinder styrs av ventil), "A air_supply B" att A matas från B.
create table if not exists public.bom_connections (
  id            uuid primary key default gen_random_uuid(),
  bom_id        uuid not null references public.boms(id)      on delete cascade,
  from_item_id  uuid not null references public.bom_items(id) on delete cascade,
  to_item_id    uuid not null references public.bom_items(id) on delete cascade,
  relation_type text not null,
  notes         text,
  created_at    timestamptz not null default now(),

  -- En komponent kan inte kopplas till sig själv.
  constraint bom_connections_no_self_link check (from_item_id <> to_item_id),
  -- Samma relation mellan samma två komponenter ska bara finnas en gång.
  constraint bom_connections_unique unique (from_item_id, to_item_id, relation_type),
  -- Håller vokabulären stängd. Utökas medvetet via migration, inte av en
  -- LLM som hittar på en ny relationstyp mitt i ett svar.
  constraint bom_connections_known_type check (
    relation_type in ('controlled_by','air_supply','requires','accessory','mounted_on','senses')
  )
);

comment on table public.bom_connections is
  'Kanter mellan komponenter i EN stycklista (maskininstans). Katalognivåns motsvarighet är product_relations; relation_type delar vokabulär med den med flit.';

create index if not exists bom_connections_bom_id_idx on public.bom_connections (bom_id);
create index if not exists bom_connections_from_idx   on public.bom_connections (from_item_id);
create index if not exists bom_connections_to_idx     on public.bom_connections (to_item_id);

-- bom_id är redundant givet from_item_id -> bom_items.bom_id, men gör "hämta
-- hela maskinen" till en enda indexerad läsning istället för en join, och låter
-- RLS-policyn nedan matcha boms direkt. Trigger håller den ärlig.
create or replace function public.bom_connections_check_same_bom()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if (select bom_id from public.bom_items where id = new.from_item_id) is distinct from new.bom_id
     or (select bom_id from public.bom_items where id = new.to_item_id) is distinct from new.bom_id then
    raise exception 'bom_connections: from_item_id och to_item_id måste tillhöra bom_id %', new.bom_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bom_connections_same_bom on public.bom_connections;
create trigger bom_connections_same_bom
  before insert or update on public.bom_connections
  for each row execute function public.bom_connections_check_same_bom();

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
alter table public.bom_connections enable row level security;

-- Samma ägarkedja som bom_items redan använder: via boms.user_id.
drop policy if exists "users read own bom_connections"   on public.bom_connections;
drop policy if exists "users insert own bom_connections" on public.bom_connections;
drop policy if exists "users update own bom_connections" on public.bom_connections;
drop policy if exists "users delete own bom_connections" on public.bom_connections;

create policy "users read own bom_connections" on public.bom_connections
  for select using (bom_id in (select id from public.boms where user_id = (select auth.uid())));
create policy "users insert own bom_connections" on public.bom_connections
  for insert with check (bom_id in (select id from public.boms where user_id = (select auth.uid())));
create policy "users update own bom_connections" on public.bom_connections
  for update using (bom_id in (select id from public.boms where user_id = (select auth.uid())))
          with check (bom_id in (select id from public.boms where user_id = (select auth.uid())));
create policy "users delete own bom_connections" on public.bom_connections
  for delete using (bom_id in (select id from public.boms where user_id = (select auth.uid())));

-- boms och bom_items har idag BARA select- och insert-policies. En användare
-- kan alltså skapa en stycklista men aldrig ändra eller ta bort den -- vilket
-- gör en redigerbar canvas omöjlig, och avviker från projects som har alla
-- fyra. Rättas här, med exakt samma ägaruttryck som befintliga policies.
drop policy if exists "users update own boms" on public.boms;
drop policy if exists "users delete own boms" on public.boms;
create policy "users update own boms" on public.boms
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete own boms" on public.boms
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "users update own bom_items" on public.bom_items;
drop policy if exists "users delete own bom_items" on public.bom_items;
create policy "users update own bom_items" on public.bom_items
  for update using (bom_id in (select id from public.boms where user_id = (select auth.uid())))
          with check (bom_id in (select id from public.boms where user_id = (select auth.uid())));
create policy "users delete own bom_items" on public.bom_items
  for delete using (bom_id in (select id from public.boms where user_id = (select auth.uid())));

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- Kör detta block för att återställa helt. Appen faller då tillbaka på
-- projects.bom_lines, som aldrig rörts.
--
--   drop trigger if exists bom_connections_same_bom on public.bom_connections;
--   drop function if exists public.bom_connections_check_same_bom();
--   drop table if exists public.bom_connections;
--   drop policy if exists "users update own boms"      on public.boms;
--   drop policy if exists "users delete own boms"      on public.boms;
--   drop policy if exists "users update own bom_items" on public.bom_items;
--   drop policy if exists "users delete own bom_items" on public.bom_items;
--   drop index if exists public.bom_items_bom_id_sort_idx;
--   alter table public.bom_items
--     drop column if exists sku,
--     drop column if exists reason,
--     drop column if exists subsystem,
--     drop column if exists sort_order;
