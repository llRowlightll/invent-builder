-- Slå ihop äldre kategorislugs med de nya kanoniska slugsen

-- hose → tubing
update public.products
set category_id = (select id from public.categories where slug='tubing')
where category_id = (select id from public.categories where slug='hose');

-- speed-controller → flow-control
update public.products
set category_id = (select id from public.categories where slug='flow-control')
where category_id = (select id from public.categories where slug='speed-controller');

-- air-preparation: AN-silencers → silencer, resten → frl
update public.products
set category_id = (select id from public.categories where slug='silencer')
where category_id = (select id from public.categories where slug='air-preparation')
  and (sku ilike '%AN5%' or sku ilike '%ANA%');

update public.products
set category_id = (select id from public.categories where slug='frl')
where category_id = (select id from public.categories where slug='air-preparation');

-- coupling → fitting
update public.products
set category_id = (select id from public.categories where slug='fitting')
where category_id = (select id from public.categories where slug='coupling');
