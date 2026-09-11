/**
 * Genererar produktraderna för KPZ ur beställtabellen.
 *
 * Kör:  deno run --allow-read --no-lock --node-modules-dir=none \
 *         scripts/gen-kpz-products.ts > supabase/migrations/<tidsstämpel>_kpz_products.sql
 *
 * VARFÖR. products hade sexton KPZ-rader på formen "KPZ-016-0025-A-0-PPV".
 * AVENTICS katalog innehåller inte den strängen — inte en enda gång. Åtta av
 * raderna var dessutom märkta Camozzi, som inte tillverkar någon KPZ-serie,
 * med slaglängderna 250 och 400 mm när beställtabellen slutar vid 100.
 *
 * Ett tredje spår: specarna. Ø40 stod med piston_force_6bar_N = 754, vilket är
 * DSBC:s värde för Ø40. AVENTICS egen tabell säger 792 N utskjutande och 720 N
 * indragande. Kraftvärdena var alltså kopierade från en annan familj.
 *
 * De gamla raderna TAS INTE BORT utan sätts till status 'discontinued'. Inget
 * i databasen pekar på dem (kontrollerat: bom_items, rfq_items,
 * product_relations, competitor_map, assembly_parts, claims, use_case_map --
 * noll träffar i samtliga), men att behålla dem gör steget reversibelt och
 * lämnar spåret synligt för den som undrar vart de tog vägen.
 *
 * Allt nedan kommer ur src/lib/catalog/kpz.ts, som i sin tur kommer ur
 * katalogen. Inga värden skrivs för hand.
 */
import { KPZ_BORES, KPZ_SERIE, KPZ_SOURCE, KPZ_STROKES, kpzCatalogue, kpzPartNo } from "../src/lib/catalog/kpz.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

// Borrningarna och slaglängderna som VALUES-listor, och uteslutningsregeln som
// ett villkor. 93 rader faller ut ur korsprodukten -- att skriva ut dem alla
// vore 67 kB SQL som säger samma sak sämre, och en avskrift kan glida från
// modellen medan en regel inte kan.
const borrLista = KPZ_BORES.map((b) =>
  `(${b.index}, ${b.bore_mm}, ${q(b.rod_thread)}, ${q(b.port)}, ` +
  `${b.force_extend_n}, ${b.force_retract_n}, ${b.bore_mm <= 25 ? "1" : "0.6"})`
).join(",\n    ");

const slagLista = KPZ_STROKES.map((mm, i) => `(${i}, ${mm})`).join(", ");

/** De tre minsta borrningarna saknar de två längsta slagen (tabellens "-"). */
const uteslutna = KPZ_BORES
  .filter((b) => kpzPartNo(b.bore_mm, 100) === null)
  .map((b) => b.index);
const utesluttnaSlag = KPZ_STROKES
  .map((mm, i) => [mm, i] as const)
  .filter(([mm]) => KPZ_BORES.some((b) => kpzPartNo(b.bore_mm, mm) === null))
  .map(([, i]) => i);

const out: string[] = [];

out.push(`-- KPZ: produktraderna ur AVENTICS beställtabell.
-- GENERERAD ur src/lib/catalog/kpz.ts -- redigera inte för hand.
--
-- ${kpzCatalogue().length} riktiga artiklar in, 16 obelagda ut (satta till
-- 'discontinued', inte raderade -- inget pekar på dem men steget ska gå att ångra).
--
-- Källa: ${KPZ_SOURCE.title}, ${KPZ_SOURCE.edition},
-- knowledge_chunks source_file = ${KPZ_SOURCE.file}, beställtabellen i chunk 9-10.

begin;

-- Tillverkaren. Katalogen är märkt (c)AVENTICS S.a r.l.; serien såldes tidigare
-- som Rexroth Pneumatics och ägs i dag av Emerson. Raderna låg under
-- "Bosch Rexroth" och "Camozzi" -- den senare tillverkar ingen KPZ-serie.
insert into brands (slug, name) values ('aventics', 'AVENTICS')
on conflict (slug) do nothing;

-- Ut med de obelagda.
update products set status = 'discontinued', updated_at = now()
where lower(family) = 'kpz' and sku like 'KPZ-%';

-- Beställtabellen som den är: en borrningsaxel, en slagaxel, och sex tomma rutor.
create temporary table kpz_tabell on commit drop as
with borr(idx, bore_mm, rod_thread, port, f_ext, f_ret, p_min) as (values
    ${borrLista}
), slag(idx, stroke_mm) as (values ${slagLista})
select
  '${KPZ_SERIE}' || borr.idx || lpad(slag.idx::text, 3, '0') as sku,
  borr.bore_mm, slag.stroke_mm, borr.rod_thread, borr.port,
  borr.f_ext, borr.f_ret, borr.p_min
from borr cross join slag
where not (borr.idx in (${uteslutna.join(", ")}) and slag.idx in (${utesluttnaSlag.join(", ")}));

insert into products (sku, name, description, family, brand_id, category_id,
                      availability, lead_time_days, status)
select t.sku,
       'AVENTICS KPZ Ø' || t.bore_mm || ' kompaktcylinder, ' || t.stroke_mm || ' mm slag',
       'Kompaktcylinder ur AVENTICS serie KPZ. Dubbelverkande, magnetkolv, '
         || 'elastisk dämpning, invändig kolvstångsgänga ' || t.rod_thread
         || ', anslutning ' || t.port || '.',
       'KPZ',
       (select id from brands where slug = 'aventics'),
       (select id from categories where slug = 'cylinder'),
       'order', 21, 'active'
from kpz_tabell t
on conflict (sku) do update set
  name = excluded.name, description = excluded.description,
  family = excluded.family, brand_id = excluded.brand_id,
  status = 'active', updated_at = now();

-- Specarna. Bara det katalogen faktiskt säger -- kraftvärdena är AVENTICS egna
-- per borrning, inte en formel och inte en annan familjs tabell.
delete from product_specs where product_id in (
  select id from products where lower(family) = 'kpz' and sku ~ '^${KPZ_SERIE}'
);

insert into product_specs (product_id, key, value)
select p.id, s.key, s.value
from kpz_tabell t
join products p on p.sku = t.sku
cross join lateral (values
  ('bore_mm', t.bore_mm::text),
  ('stroke_mm', t.stroke_mm::text),
  ('rod_thread', t.rod_thread),
  ('port', t.port),
  ('piston_force_6bar_N', t.f_ext::text),
  ('piston_force_retract_6bar_N', t.f_ret::text),
  ('min_pressure', t.p_min::text || ' bar'),
  ('max_pressure', '10 bar'),
  ('mode_of_operation', 'Double-acting'),
  ('cylinder_type', 'Compact cylinder'),
  ('magnetic_piston', 'Yes'),
  ('cushioning', 'Elastic')
) as s(key, value);

commit;
`);

console.log(out.join("\n"));
