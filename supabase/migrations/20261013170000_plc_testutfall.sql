-- PLC-underlagets testfall: ett utfall kräver ansvarig och datum.
--
-- Planen och manualen (steg 7): genererade testfall börjar som "Ej utfört",
-- och ett utfall är ett bevis först när en person fyllt i det på riktig
-- utrustning -- med namn och datum. Gränssnittet erbjuder inte "Godkänt" utan
-- dem, men kontrollen hör hemma här, där alla klienter passerar.
--
-- Funktionen är densamma som i 20261012180000_plc_underlag, med prövningen
-- av testfallen tillagd sist.
create or replace function public.plc_kontrollera_data(p_data jsonb)
returns void language plpgsql immutable set search_path = public as $$
declare
  k text;
  t jsonb;
  tillatna text[] := array['schemaVersion', 'importerat', 'omfattning', 'plattform', 'funktion',
    'driftlagen', 'signaler', 'parametrar', 'steg', 'larm', 'testfall', 'antaganden', 'oppnaFragor', 'statusar'];
  listor text[] := array['driftlagen', 'signaler', 'parametrar', 'steg', 'larm', 'testfall', 'antaganden', 'oppnaFragor'];
  objekt text[] := array['importerat', 'omfattning', 'plattform', 'funktion', 'statusar'];
  last text[] := array['kodGenererad', 'statiskKontroll', 'kompilering', 'simulering', 'dokumentGranskat', 'tekniskGranskning'];
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'plc_data: underlaget måste vara ett objekt';
  end if;
  if coalesce(p_data->>'schemaVersion', '') <> '1' then
    raise exception 'plc_data: okänd schemaversion %', coalesce(p_data->>'schemaVersion', 'saknas');
  end if;
  for k in select jsonb_object_keys(p_data) loop
    if not k = any(tillatna) then
      raise exception 'plc_data: okänt fält %', k;
    end if;
  end loop;
  foreach k in array listor loop
    if p_data ? k and jsonb_typeof(p_data->k) <> 'array' then
      raise exception 'plc_data: % måste vara en lista', k;
    end if;
  end loop;
  foreach k in array objekt loop
    if p_data ? k and jsonb_typeof(p_data->k) <> 'object' then
      raise exception 'plc_data: % måste vara ett objekt', k;
    end if;
  end loop;
  foreach k in array last loop
    if coalesce(p_data #>> array['statusar', k, 'status'], 'inte_utfort') <> 'inte_utfort' then
      raise exception 'plc_data: statusen % kan bara sättas av ett verktyg eller en granskning', k;
    end if;
  end loop;
  -- Ett testutfall utan ansvarig och datum är inget bevis.
  if p_data ? 'testfall' then
    for t in select * from jsonb_array_elements(p_data->'testfall') loop
      if coalesce(t->>'utfall', 'ej_utfort') not in ('ej_utfort', 'godkant', 'ej_godkant') then
        raise exception 'plc_data: okänt testutfall %', t->>'utfall';
      end if;
      if coalesce(t->>'utfall', 'ej_utfort') <> 'ej_utfort'
         and (coalesce(trim(t->>'ansvarig'), '') = '' or coalesce(trim(t->>'datum'), '') = '') then
        raise exception 'plc_data: testfallet % har ett utfall utan ansvarig och datum', coalesce(t->>'nummer', t->>'id', '?');
      end if;
    end loop;
  end if;
  if octet_length(p_data::text) > 1048576 then
    raise exception 'plc_data: underlaget är större än 1 MB';
  end if;
end $$;

revoke all on function public.plc_kontrollera_data(jsonb) from public, anon;
