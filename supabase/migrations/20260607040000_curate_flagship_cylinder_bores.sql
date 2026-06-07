-- Curate accurate, standard bore ranges (and sensible stroke maxima) for the
-- flagship Festo/SMC cylinder families, from product knowledge rather than just
-- the catalog's stocked sizes. Replaces the catalog-derived/generic bore sets so
-- e.g. DNC offers the full ISO 15552 range (32-125) instead of 8-100.
do $$
declare m record; pid uuid; b int; sortn int;
begin
  for m in
    select * from (values
      ('dnc',   array[32,40,50,63,80,100,125], 2000),
      ('dsbf',  array[32,40,50,63,80,100,125], 2000),
      ('dsbs',  array[32,40,50,63,80,100,125], 500),
      ('dsnu',  array[8,10,12,16,20,25], 500),
      ('esnu',  array[8,10,12,16,20,25], 500),
      ('advu',  array[12,16,20,25,32,40,50,63,80,100], 500),
      ('advc',  array[12,16,20,25,32,40], 50),
      ('aevc',  array[12,16,20,25,32,40], 50),
      ('dfm',   array[12,16,20,25,32,40,50,63,80,100], 400),
      ('dgsl',  array[6,8,10,12,16,20,25], 200),
      ('cq2',   array[12,16,20,25,32,40,50,63,80,100], 300),
      ('c85',   array[8,10,12,16,20,25], 300),
      ('cp96',  array[32,40,50,63,80,100], 1000),
      ('mb',    array[32,40,50,63,80,100,125], 1200),
      ('cm2',   array[20,25,32,40], 300),
      ('cj1',   array[4,6], 30),
      ('cj2',   array[6,10,16], 200),
      ('cjp',   array[6,10,16], 60),
      ('mgpl',  array[12,16,20,25,32,40,50,63,80,100], 400),
      ('mgpm',  array[12,16,20,25,32,40,50,63,80,100], 400),
      ('mxs',   array[6,8,12,16,20,25], 200)
    ) as t(slug, bores, smax)
  loop
    select p.id into pid from public.configurator_families cf
      join public.configurator_params p on p.family_id=cf.id and p.param_key='bore_mm'
      where cf.slug = m.slug;
    if pid is not null then
      delete from public.configurator_param_values where param_id = pid;
      sortn := 0;
      foreach b in array m.bores loop
        sortn := sortn + 1;
        insert into public.configurator_param_values (param_id,code,label,sort_order)
          values (pid, b::text, b::text||' mm', sortn);
      end loop;
      update public.configurator_families set stroke_max_mm = m.smax where slug = m.slug;
    end if;
  end loop;
end $$;
