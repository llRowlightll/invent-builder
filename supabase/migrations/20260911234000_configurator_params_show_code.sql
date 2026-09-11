-- Ska kodens tecken visas ovanför etiketten i konfiguratorn?
--
-- För DSBC och P1D är koden det kunden ska ANGE vid beställning ("PPV", "D3",
-- "S"), och etiketten ensam räcker inte -- "mm" betyder ingenting utan sin
-- siffra. För KPZ är koden ett INDEX i AVENTICS beställtabell: kunden skulle se
-- "009" ovanför "80 mm".
--
-- En flagga, inte en gissningsregel. Varje innehållsbaserad heuristik föll på
-- någon av de tre familjerna: "dölj numeriska koder" bryter DSBC:s borrning,
-- "dölj när etiketten har en siffra" bryter P1D:s materialpositioner.
alter table configurator_params
  add column if not exists show_code boolean not null default true;

update configurator_params p
set show_code = false
from configurator_families f
where f.id = p.family_id
  and f.slug = 'kpz'
  and p.param_key in ('bore_mm', 'stroke_mm');
