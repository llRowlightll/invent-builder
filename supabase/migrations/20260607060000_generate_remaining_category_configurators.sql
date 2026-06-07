-- Generate configurators for the remaining configurable categories with
-- category-specific schemas: valve terminals (stations/fieldbus/voltage), linear
-- modules + electric actuators (size/stroke/drive), grippers (size/grip-type),
-- rotary actuators (size/angle). One per genuine family that lacks one.
do $$
declare fam record; fid uuid; p1 uuid; p2 uuid; p3 uuid; p4 uuid;
begin
  for fam in select distinct p.family as name, lower(p.family) as slug from public.products p join public.categories c on c.id=p.category_id
    where p.status='active' and c.slug='valve-terminal' and p.family is not null
      and lower(p.family) not in (select slug from public.configurator_families) and length(p.family)<=20 and p.family !~ '/'
  loop
    insert into public.configurator_families (slug,name,title,category_slug,order_code_template)
      values (fam.slug, fam.name, fam.name||' Valve Terminal','valve-terminal', fam.name||'-{stations}-{fieldbus}-{voltage}') returning id into fid;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'stations','Number of valve stations','number',1,true);
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'fieldbus','Fieldbus / control','select',2,true) returning id into p2;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'voltage','Voltage','select',3,true) returning id into p3;
    insert into public.configurator_param_values (param_id,code,label,sort_order) values
      (p2,'multipin','Multi-pin (no bus)',1),(p2,'profinet','PROFINET',2),(p2,'ethercat','EtherCAT',3),(p2,'ethernetip','EtherNet/IP',4),(p2,'iolink','IO-Link',5),(p2,'profibus','PROFIBUS',6);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p3,'24DC','24 V DC',1),(p3,'230AC','230 V AC',2);
  end loop;

  for fam in select distinct p.family as name, lower(p.family) as slug from public.products p join public.categories c on c.id=p.category_id
    where p.status='active' and c.slug='linear-module' and p.family is not null
      and lower(p.family) not in (select slug from public.configurator_families) and length(p.family)<=20 and p.family !~ '/'
  loop
    insert into public.configurator_families (slug,name,title,category_slug,order_code_template,stroke_min_mm,stroke_max_mm)
      values (fam.slug, fam.name, fam.name||' Linear Axis','linear-module', fam.name||'-{size}-{stroke_mm}-{drive}',1,3000) returning id into fid;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'size','Size','select',1,true) returning id into p1;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'stroke_mm','Stroke (mm)','number',2,true);
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'drive','Drive type','select',3,true) returning id into p3;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'guide','Guide','select',4,false) returning id into p4;
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p1,'40','40',1),(p1,'50','50',2),(p1,'63','63',3),(p1,'80','80',4),(p1,'100','100',5),(p1,'125','125',6);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p3,'belt','Toothed belt (fast)',1),(p3,'ballscrew','Ball screw (precise)',2),(p3,'leadscrew','Lead screw',3);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p4,'ball','Recirculating ball guide',1),(p4,'plain','Plain bearing',2),(p4,'roller','Roller guide',3);
  end loop;

  for fam in select distinct p.family as name, lower(p.family) as slug from public.products p join public.categories c on c.id=p.category_id
    where p.status='active' and c.slug='electric-actuator' and p.family is not null
      and lower(p.family) not in (select slug from public.configurator_families) and length(p.family)<=20 and p.family !~ '/'
  loop
    insert into public.configurator_families (slug,name,title,category_slug,order_code_template,stroke_min_mm,stroke_max_mm)
      values (fam.slug, fam.name, fam.name||' Electric Cylinder','electric-actuator', fam.name||'-{size}-{stroke_mm}-{motor_mount}',1,1500) returning id into fid;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'size','Size','select',1,true) returning id into p1;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'stroke_mm','Stroke (mm)','number',2,true);
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'motor_mount','Motor mounting','select',3,true) returning id into p3;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'lead','Spindle lead','select',4,false) returning id into p4;
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p1,'32','32',1),(p1,'40','40',2),(p1,'50','50',3),(p1,'63','63',4),(p1,'80','80',5),(p1,'100','100',6);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p3,'inline','In-line (direct)',1),(p3,'parallel','Parallel (belt)',2);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p4,'low','Low (high force)',1),(p4,'standard','Standard',2),(p4,'high','High (fast)',3);
  end loop;

  for fam in select distinct p.family as name, lower(p.family) as slug from public.products p join public.categories c on c.id=p.category_id
    where p.status='active' and c.slug='gripper' and p.family is not null
      and lower(p.family) not in (select slug from public.configurator_families) and length(p.family)<=20 and p.family !~ '/'
  loop
    insert into public.configurator_families (slug,name,title,category_slug,order_code_template)
      values (fam.slug, fam.name, fam.name||' Gripper','gripper', fam.name||'-{size}-{grip_type}{options}') returning id into fid;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'size','Size','select',1,true) returning id into p1;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'grip_type','Gripping type','select',2,true) returning id into p2;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'stroke_per_jaw','Stroke per jaw (mm)','number',3,false);
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'options','Options','multiselect',4,false) returning id into p4;
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p1,'10','Size 10',1),(p1,'16','Size 16',2),(p1,'20','Size 20',3),(p1,'25','Size 25',4),(p1,'32','Size 32',5),(p1,'40','Size 40',6),(p1,'50','Size 50',7),(p1,'63','Size 63',8),(p1,'80','Size 80',9);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p2,'parallel','Parallel',1),(p2,'angular','Angular',2),(p2,'centric','Centric (3-point)',3),(p2,'radial','Radial',4);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p4,'sensor','Position sensor',1),(p4,'ip67','IP67 sealed',2),(p4,'highforce','High force',3);
  end loop;

  for fam in select distinct p.family as name, lower(p.family) as slug from public.products p join public.categories c on c.id=p.category_id
    where p.status='active' and c.slug='rotary-actuator' and p.family is not null
      and lower(p.family) not in (select slug from public.configurator_families) and length(p.family)<=20 and p.family !~ '/'
  loop
    insert into public.configurator_families (slug,name,title,category_slug,order_code_template)
      values (fam.slug, fam.name, fam.name||' Rotary Actuator','rotary-actuator', fam.name||'-{size}-{rotation}{options}') returning id into fid;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'size','Size','select',1,true) returning id into p1;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'rotation','Rotation angle','select',2,true) returning id into p2;
    insert into public.configurator_params (family_id,param_key,label,param_type,sort_order,required) values (fid,'options','Options','multiselect',3,false) returning id into p4;
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p1,'10','Size 10',1),(p1,'16','Size 16',2),(p1,'20','Size 20',3),(p1,'25','Size 25',4),(p1,'32','Size 32',5),(p1,'40','Size 40',6),(p1,'50','Size 50',7),(p1,'63','Size 63',8);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p2,'90','90°',1),(p2,'180','180°',2),(p2,'270','270°',3),(p2,'360','360° (continuous)',4);
    insert into public.configurator_param_values (param_id,code,label,sort_order) values (p4,'sensor','Position sensor',1),(p4,'shock','Shock absorber',2),(p4,'flange','Flange mount',3);
  end loop;
end $$;
