-- Tio Festo-kopplingar: specifikationerna sa emot beskrivningen.
--
-- Kundgranskningen 2026-11-13 (inköpare, senior ingenjör, spansk kund):
-- FESTO-153305 "QSM, G1/8 × Ø4 mm slang" hade spec "Slangens ytterdiameter
-- 6 mm" och "Material PA". Kontrollerat mot Festos datablad (festo.com och
-- distributörernas kopior hos RS, Rubix, Landefeld m.fl.) 2026-11-13:
--
--   153305  QSM-1/8-4          R1/8 utv.   Ø4   förnicklad mässing
--   190646  QS-1/2-10          R1/2 utv.   Ø10  förnicklad mässing
--   153160  QSS-10             M20x1 (skott)  Ø10  mässing
--   153355  QSMT-1/8-4         R1/8 utv.   Ø4
--   153428  QSK-1/2-12         R1/2 utv.   Ø12  mässing, självtätande
--   190653  QSF-1/2-12-B       G1/2 inv.   Ø12  förnicklad mässing
--   190661  QSL-1/2-10         R1/2 utv.   Ø10  PBT-hus, gänga förnicklad mässing
--   190672  QST-1/2-10         R1/2 utv.   Ø10  PBT-hus, gänga förnicklad mässing
--   133196  QSY-1/2-10         R1/2 utv.   Ø10  PBT-hus
--   558671  NPQM-D-G12-Q10-P10 G1/2 utv.   Ø10  -0,95–16 bar
--
-- Beskrivningarnas slangmått stämde; gängan var fel typ (R är konisk, G
-- cylindrisk) på sju. Spec-raderna tube_od_mm och material var påhittade.
-- Material som inte gick att bekräfta tas bort hellre än att stå kvar fel.
-- Festos typbeteckning läggs som type_code, så att sökning på den hittar
-- artikeln (hittaArtikel jämför type_code).

begin;

create temp table rattelse (sku text, typ text, gänga text, slang int, material text, tryck text) on commit drop;
insert into rattelse values
  ('FESTO-153305', 'QSM-1/8-4',          'R1/8',            4,  'Förnicklad mässing', null),
  ('FESTO-190646', 'QS-1/2-10',          'R1/2',            10, 'Förnicklad mässing', null),
  ('FESTO-153160', 'QSS-10',             'M20x1 (skott)',   10, 'Mässing', null),
  ('FESTO-153355', 'QSMT-1/8-4',         'R1/8',            4,  null, null),
  ('FESTO-153428', 'QSK-1/2-12',         'R1/2',            12, 'Mässing', null),
  ('FESTO-190653', 'QSF-1/2-12-B',       'G1/2 invändig',   12, 'Förnicklad mässing', null),
  ('FESTO-190661', 'QSL-1/2-10',         'R1/2',            10, 'PBT (hus), förnicklad mässing (gänga)', null),
  ('FESTO-190672', 'QST-1/2-10',         'R1/2',            10, 'PBT (hus), förnicklad mässing (gänga)', null),
  ('FESTO-133196', 'QSY-1/2-10',         'R1/2',            10, 'PBT (hus)', null),
  ('FESTO-558671', 'NPQM-D-G12-Q10-P10', 'G1/2',            10, null, '16');

-- Slangdimension, gänga och typbeteckning.
insert into product_specs (product_id, key, value, unit)
select p.id, k.key, k.value, k.unit
from rattelse r join products p on p.sku = r.sku
cross join lateral (values
  ('tube_od_mm', r.slang::text, 'mm'),
  ('thread', r.gänga, null),
  ('type_code', r.typ, null),
  ('tube_od_mm_kalla', 'Festo datablad ' || replace(r.sku, 'FESTO-', '') || ' (' || r.typ || '), kontrollerat 2026-11-13', null)
) as k(key, value, unit)
on conflict (product_id, key) do update set value = excluded.value, unit = excluded.unit;

-- Material: bekräftat där det finns, annars bort.
insert into product_specs (product_id, key, value, unit)
select p.id, 'material', r.material, null
from rattelse r join products p on p.sku = r.sku
where r.material is not null
on conflict (product_id, key) do update set value = excluded.value;

delete from product_specs ps
using rattelse r join products p on p.sku = r.sku
where ps.product_id = p.id and ps.key = 'material' and r.material is null;

-- NPQM: -0,95–16 bar enligt databladet.
update product_specs ps set value = r.tryck
from rattelse r join products p on p.sku = r.sku
where ps.product_id = p.id and ps.key = 'max_pressure' and r.tryck is not null;

-- Beskrivningen: R-gänga där den är utvändig konisk.
update products p set
  description = replace(replace(p.description, 'G1/8', 'R1/8'), 'G1/2', 'R1/2'),
  description_en = case when p.description_en is null then null
                   else replace(replace(p.description_en, 'G1/8', 'R1/8'), 'G1/2', 'R1/2') end
from rattelse r
where p.sku = r.sku and r.gänga like 'R%';

-- Namnet: typbeteckningen först, så att sex likadana "Push-in fitting" skiljs åt.
update products p set name = r.typ || ' ' || p.name
from rattelse r
where p.sku = r.sku and p.name not like r.typ || '%';

commit;

-- FESTO-DSBC (samma granskning): kolvkraften slutade vid Ø100 (4712 N) fast
-- serien går till Ø125 (0,6 MPa × π × 62,5² ≈ 7363 N). Dämpningen "P, PPV-A,
-- YSR" blandade in en stötdämpare (YSR); Festos kod har P, PPV och PPS, och
-- A betyder lägesavkänning. Slaget är ett spann, inte 2800 mm.
update product_specs ps set value = '483–7363'
from products p where ps.product_id = p.id and p.sku = 'FESTO-DSBC' and ps.key = 'piston_force_6bar_N' and ps.value = '483–4712';
update product_specs ps set value = 'P, PPV, PPS (tillägg A = med lägesavkänning)'
from products p where ps.product_id = p.id and p.sku = 'FESTO-DSBC' and ps.key = 'cushioning_types' and ps.value = 'P, PPV-A, YSR';
update product_specs ps set value = '1–2800'
from products p where ps.product_id = p.id and p.sku = 'FESTO-DSBC' and ps.key = 'stroke_mm' and ps.value = '2800 mm';
