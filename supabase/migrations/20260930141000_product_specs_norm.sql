-- En normaliserad, frågbar vy av produktspecarna.
--
-- product_specs är källan och rörs aldrig. Den innehåller samma storhet under
-- olika nycklar, i olika enheter och ibland som intervall -- och ett intervall
-- på en enskild artikel är familjedata, inte den varianten. Den röran går inte
-- att fråga på, vilket är en huvudorsak till att rådgivaren hittar på
-- kompatibilitet och värden.
--
-- Den här tabellen är HÄRLEDD och byggs om med bygg_specs_norm(). Varje rad
-- bär var den kom ifrån och hur säker den är.

begin;

create table if not exists product_specs_norm (
  product_id  uuid not null references products(id) on delete cascade,
  key         text not null,
  num         numeric,
  txt         text,
  unit        text,
  kalla       text not null check (kalla in ('katalog','beraknad')),
  ar_spann    boolean not null default false,
  fran_nyckel text,
  primary key (product_id, key)
);

comment on table product_specs_norm is
  'Härledd, frågbar form av product_specs. Byggs om med bygg_specs_norm(). Källan rörs aldrig.';
comment on column product_specs_norm.ar_spann is
  'Källvärdet var ett intervall, t.ex. "17–4712". Det är familjedata på en produktrad och får inte visas som artikelns eget värde.';

create index if not exists specs_norm_key on product_specs_norm (key, num);

alter table product_specs_norm enable row level security;
drop policy if exists specs_norm_las on product_specs_norm;
create policy specs_norm_las on product_specs_norm for select to anon, authenticated using (true);
grant select on product_specs_norm to anon, authenticated;

commit;
