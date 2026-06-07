-- Expand the product configurator from ~15 to ~94 configurable families.
-- Generates a configurator for every genuine cylinder + valve family that lacks
-- one, cloning the proven DSBC (cylinder) and VUVG (valve) schemas. Cylinder bore
-- options are derived from each family's real catalog data (standard ladder
-- filtered to the family's min/max bore), falling back to a sensible default when
-- a family has no parseable bore spec. Order-code templates use the family name.
do $$
declare
  fam record; newid uuid; pbore uuid; pcush uuid; psens uuid;
  minb numeric; maxb numeric; maxs int;
  ladder int[] := array[4,6,8,10,12,16,20,25,32,40,50,63,80,100,125,160,200,250,320];
  b int; sortn int;
begin
  -- CYLINDERS
  for fam in
    select distinct p.family as name, lower(p.family) as slug
    from public.products p join public.categories c on c.id=p.category_id
    where p.status='active' and c.slug='cylinder' and p.family is not null
      and lower(p.family) not in (select slug from public.configurator_families)
      and p.family !~ 'ISO|RODLESS|roundline' and p.family !~* '^(sr|ra|rm)$'
  loop
    select min(v), max(v) into minb, maxb from (
      select (regexp_match(s.value,'(\d+)'))[1]::numeric as v
      from public.products p join public.categories c on c.id=p.category_id and c.slug='cylinder'
      join public.product_specs s on s.product_id=p.id and s.key in ('bore_mm','bore_diameter_mm','bore_diameter')
      where p.status='active' and lower(p.family)=fam.slug and s.value ~ '\d'
    ) q where v between 1 and 400;
    select max((regexp_match(s.value,'(\d{2,})'))[1]::int) into maxs
      from public.products p join public.categories c on c.id=p.category_id and c.slug='cylinder'
      join public.product_specs s on s.product_id=p.id and s.key in ('stroke_mm','stroke_max','max_stroke')
      where p.status='active' and lower(p.family)=fam.slug and s.value ~ '\d';
    if minb is null then minb := 8; maxb := 100; end if;
    if maxs is null or maxs < 50 then maxs := 1000; end if;
    if maxs > 5000 then maxs := 5000; end if;

    insert into public.configurator_families (slug,name,title,category_slug,order_code_template,stroke_min_mm,stroke_max_mm)
      values (fam.slug, fam.name, fam.name||' Cylinder','cylinder', fam.name||'-{bore_mm}-{stroke_mm}-{cushioning}{sensing}',1,maxs)
      returning id into newid;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required)
      values (newid,'bore_mm','Bore diameter (mm)','select',1,true) returning id into pbore;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required)
      values (newid,'stroke_mm','Stroke (mm)','number',2,true);
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required)
      values (newid,'cushioning','Cushioning','select',3,true) returning id into pcush;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required)
      values (newid,'sensing','Sensing','select',4,false) returning id into psens;
    sortn := 0;
    foreach b in array ladder loop
      if b >= minb and b <= maxb then
        sortn := sortn+1;
        insert into public.configurator_param_values (param_id,code,label,sort_order) values (pbore,b::text,b::text||' mm',sortn);
      end if;
    end loop;
    if sortn = 0 then
      insert into public.configurator_param_values (param_id,code,label,sort_order) values (pbore,round(minb)::text,round(minb)::text||' mm',1);
    end if;
    insert into public.configurator_param_values (param_id,code,label,sort_order) values
      (pcush,'P','Elastic',1),(pcush,'PPV','Pneumatic adjustable',2),(pcush,'PPSA','Pneumatic self-adjusting',3);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values
      (psens,'A','With proximity sensor slot',1),(psens,'none','Without sensing',2);
  end loop;

  -- VALVES
  for fam in
    select distinct p.family as name, lower(p.family) as slug
    from public.products p join public.categories c on c.id=p.category_id
    where p.status='active' and c.slug='valve' and p.family is not null
      and lower(p.family) not in (select slug from public.configurator_families)
      and p.family !~ '/' and length(p.family) <= 18
  loop
    insert into public.configurator_families (slug,name,title,category_slug,order_code_template)
      values (fam.slug, fam.name, fam.name||' Valve','valve', fam.name||'-{size}-{function}-{voltage}-{connection}')
      returning id into newid;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required)
      values (newid,'size','Port size','select',1,true) returning id into pbore;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required)
      values (newid,'function','Valve function','select',2,true) returning id into pcush;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required)
      values (newid,'voltage','Voltage','select',3,true) returning id into psens;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required)
      values (newid,'connection','Electrical connection','select',4,true) returning id into newid;
    insert into public.configurator_param_values (param_id,code,label,sort_order) values
      (pbore,'M5','M5 thread',1),(pbore,'G18','G 1/8',2),(pbore,'G14','G 1/4',3),(pbore,'G38','G 3/8',4),(pbore,'G12','G 1/2',5);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values
      (pcush,'52','5/2 monostable',1),(pcush,'52B','5/2 bistable',2),(pcush,'53C','5/3 closed centre',3),(pcush,'32NC','3/2 NC',4);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values
      (psens,'24DC','24 V DC',1),(psens,'12DC','12 V DC',2),(psens,'230AC','230 V AC',3);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values
      (newid,'C12','Connector M12',1),(newid,'C8','Connector M8',2),(newid,'plug','Plug socket',3);
  end loop;
end $$;
