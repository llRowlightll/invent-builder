-- Curate accurate size sets (and grip type) for the flagship gripper and
-- electric-actuator families, replacing the generic generated options.
do $$
declare m record; pid uuid; v text; sortn int;
begin
  for m in select * from (values
    ('hgpp', array['10','16','20','25','40','50','63','80'], array['parallel']),
    ('hgpl', array['14','25','40','63'], array['parallel']),
    ('hgpd', array['16','25','35','50','63','80'], array['centric']),
    ('hgpt', array['16','25','35','50','63','80'], array['centric']),
    ('dhps', array['6','8','10','16','20','25','35','40'], array['parallel']),
    ('mhz2', array['6','10','16','20','25','32','40'], array['parallel']),
    ('mhc2', array['10','16','20','25'], array['angular'])
  ) as t(slug, sizes, grips)
  loop
    select p.id into pid from public.configurator_families cf join public.configurator_params p on p.family_id=cf.id and p.param_key='size' where cf.slug=m.slug;
    if pid is not null then
      delete from public.configurator_param_values where param_id=pid; sortn:=0;
      foreach v in array m.sizes loop sortn:=sortn+1; insert into public.configurator_param_values (param_id,code,label,sort_order) values (pid,v,'Size '||v,sortn); end loop;
    end if;
    select p.id into pid from public.configurator_families cf join public.configurator_params p on p.family_id=cf.id and p.param_key='grip_type' where cf.slug=m.slug;
    if pid is not null then
      delete from public.configurator_param_values where param_id=pid; sortn:=0;
      foreach v in array m.grips loop sortn:=sortn+1; insert into public.configurator_param_values (param_id,code,label,sort_order) values (pid,v,initcap(v),sortn); end loop;
    end if;
  end loop;

  for m in select * from (values
    ('dnce', array['32','40','63','100']),
    ('emc',  array['32','40','50','63','80']),
    ('epco', array['16','25','40']),
    ('eth',  array['32','50','80','100']),
    ('lesh', array['8','16','25']),
    ('ley',  array['16','25','32','40','63'])
  ) as t(slug, sizes)
  loop
    select p.id into pid from public.configurator_families cf join public.configurator_params p on p.family_id=cf.id and p.param_key='size' where cf.slug=m.slug;
    if pid is not null then
      delete from public.configurator_param_values where param_id=pid; sortn:=0;
      foreach v in array m.sizes loop sortn:=sortn+1; insert into public.configurator_param_values (param_id,code,label,sort_order) values (pid,v,'Size '||v,sortn); end loop;
    end if;
  end loop;
end $$;
