-- Catalog data-quality polish. Derive structured specs from product names where
-- UNAMBIGUOUS (not guessing), and merge synonym spec-keys into canonical ones.
-- NB: the "Ø<n>" on fittings/tubing/vacuum is the tube/cup diameter, NOT a
-- cylinder bore — so it must NOT become bore_mm (that would corrupt sizing).

-- 1. Tube outer diameter for tubing/fittings (Ø or <n>mm in name).
INSERT INTO product_specs (product_id, key, value, unit)
SELECT p.id, 'tube_od_mm',
  COALESCE(substring(p.name from 'Ø\s*([0-9]+)'), substring(p.name from '([0-9]+)\s*mm')), 'mm'
FROM products p JOIN categories c ON c.id = p.category_id
WHERE p.status='active' AND c.slug IN ('fitting','tubing')
  AND COALESCE(substring(p.name from 'Ø\s*([0-9]+)'), substring(p.name from '([0-9]+)\s*mm')) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM product_specs s WHERE s.product_id=p.id AND s.key='tube_od_mm')
ON CONFLICT (product_id, key) DO NOTHING;

-- 2. Cup diameter for vacuum cups/pads (Ø in name).
INSERT INTO product_specs (product_id, key, value, unit)
SELECT p.id, 'cup_diameter_mm', substring(p.name from 'Ø\s*([0-9]+)'), 'mm'
FROM products p JOIN categories c ON c.id = p.category_id
WHERE p.status='active' AND c.slug='vacuum'
  AND substring(p.name from 'Ø\s*([0-9]+)') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM product_specs s WHERE s.product_id=p.id AND s.key IN ('cup_diameter_mm','pad_diameter_mm'))
ON CONFLICT (product_id, key) DO NOTHING;

-- 3. Rotation angle for rotary actuators (<n>° in name).
INSERT INTO product_specs (product_id, key, value, unit)
SELECT p.id, 'rotation_angle', substring(p.name from '([0-9]+)\s*°'), '°'
FROM products p JOIN categories c ON c.id = p.category_id
WHERE p.status='active' AND c.slug='rotary-actuator'
  AND substring(p.name from '([0-9]+)\s*°') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM product_specs s WHERE s.product_id=p.id AND s.key='rotation_angle')
ON CONFLICT (product_id, key) DO NOTHING;

-- 4. Merge synonym spec-keys into canonical ones (drop the duplicate where the
-- canonical already exists for that product, then rename the rest).
DELETE FROM product_specs a WHERE a.key='temperature_range' AND EXISTS (SELECT 1 FROM product_specs b WHERE b.product_id=a.product_id AND b.key='temp_range');
UPDATE product_specs SET key='temp_range' WHERE key='temperature_range';

DELETE FROM product_specs a WHERE a.key='protection_class' AND EXISTS (SELECT 1 FROM product_specs b WHERE b.product_id=a.product_id AND b.key='ip_rating');
UPDATE product_specs SET key='ip_rating' WHERE key='protection_class';

DELETE FROM product_specs a WHERE a.key='guide_types' AND EXISTS (SELECT 1 FROM product_specs b WHERE b.product_id=a.product_id AND b.key='guide_type');
UPDATE product_specs SET key='guide_type' WHERE key='guide_types';

DELETE FROM product_specs a WHERE a.key='port_sizes' AND EXISTS (SELECT 1 FROM product_specs b WHERE b.product_id=a.product_id AND b.key='port_size');
UPDATE product_specs SET key='port_size' WHERE key='port_sizes';

DELETE FROM product_specs a WHERE a.key='applications' AND EXISTS (SELECT 1 FROM product_specs b WHERE b.product_id=a.product_id AND b.key='application');
UPDATE product_specs SET key='application' WHERE key='applications';
