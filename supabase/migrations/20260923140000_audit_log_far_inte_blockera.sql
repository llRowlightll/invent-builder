-- fn_audit_log kunde stoppa en legitim skrivning.
--
-- audit_log.user_id har en främmande nyckel mot auth.users, och triggern
-- skriver auth.uid() rakt in. Returnerar auth.uid() ett id som INTE finns i
-- auth.users -- en raderad användare vars token fortfarande gäller, eller en
-- token utrustad med ett främmande sub -- kastar insert:en, och eftersom
-- triggern kör i samma transaktion fallerar hela den ursprungliga skrivningen.
--
-- Det var en teoretisk risk så länge triggern satt på rfqs, shipments och
-- company_profiles. Sedan orders, order_items och leverantörstabellerna fick
-- den är den inte teoretisk längre: en kund hade kunnat hindras från att lägga
-- en order av sin egen revisionslogg. Upptäckt när provsviten körde som en
-- inloggad identitet utan konto och delete:n på supplier_products föll med
-- 23503.
--
-- En logg ska anteckna vad som hände, aldrig avgöra om det får hända. Är
-- användaren okänd skrivs raden med user_id null -- e-postadressen och
-- tidsstämpeln finns kvar, och spåret blir inte sämre än att det saknar ett
-- namn det ändå inte kunde slå upp.

begin;

create or replace function fn_audit_log()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_user_id    uuid;
  v_user_email text;
  v_record_id  text;
  v_old        jsonb;
  v_new        jsonb;
BEGIN
  BEGIN v_user_id := auth.uid(); EXCEPTION WHEN OTHERS THEN v_user_id := NULL; END;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Okänd användare loggas som null i stället för att fälla skrivningen.
  IF v_user_id IS NOT NULL AND v_user_email IS NULL
     AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    v_user_id := NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id::text;
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id::text;
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSE
    v_record_id := NEW.id::text;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_log(user_id, user_email, table_name, record_id, action, old_data, new_data)
  VALUES (v_user_id, v_user_email, TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

commit;
