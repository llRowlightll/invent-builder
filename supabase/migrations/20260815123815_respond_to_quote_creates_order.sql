-- Return type is changing (boolean -> table), so the old signature must be
-- dropped before recreating. No other function overloads this name/arity.
DROP FUNCTION IF EXISTS public.respond_to_quote(uuid, text, text);

-- Closes the gap where an accepted quote never became a real, trackable order:
-- the customer clicked "Acceptera offert" and only ever got "we'll follow up
-- manually" — nothing in the product ever inserted into public.orders.
-- Extends respond_to_quote() to create the order atomically with the status
-- flip when decision = 'accepted', and returns the new order_id so the public
-- offert page can send the customer straight to their order confirmation.
CREATE FUNCTION public.respond_to_quote(p_id uuid, p_decision text, p_po text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, order_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_updated int;
  v_rfq public.rfqs;
  v_order_id uuid;
  v_items jsonb;
  v_total_ex numeric;
BEGIN
  IF p_decision NOT IN ('accepted','rejected') THEN
    RAISE EXCEPTION 'invalid decision: %', p_decision;
  END IF;

  UPDATE public.rfqs
     SET status = p_decision,
         po_number = COALESCE(NULLIF(btrim(p_po), ''), po_number)
   WHERE id = p_id AND status = 'quoted'
   RETURNING * INTO v_rfq;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 AND p_decision = 'accepted' THEN
    -- Per-line price after the quote's discount, matching exactly what the
    -- customer saw and accepted on the offert page (offert.$rfqId.tsx).
    SELECT
      jsonb_agg(jsonb_build_object(
        'sku', p.sku,
        'name', p.name,
        'qty', ri.qty,
        'unit_price_ex_vat', round(coalesce(ri.unit_price, 0) * (1 - v_rfq.discount_pct / 100), 2),
        'total_price_ex_vat', round(ri.qty * coalesce(ri.unit_price, 0) * (1 - v_rfq.discount_pct / 100), 2),
        'brand', b.name,
        'note', ri.note
      )),
      coalesce(sum(ri.qty * coalesce(ri.unit_price, 0) * (1 - v_rfq.discount_pct / 100)), 0)
    INTO v_items, v_total_ex
    FROM public.rfq_items ri
    LEFT JOIN public.products p ON p.id = ri.product_id
    LEFT JOIN public.brands b ON b.id = p.brand_id
    WHERE ri.rfq_id = p_id;

    INSERT INTO public.orders (
      user_id, rfq_id, customer_name, customer_company, customer_email,
      customer_org_nr, po_number, status, items, total_ex_vat, total_inc_vat,
      currency
    ) VALUES (
      v_rfq.user_id, v_rfq.id,
      coalesce(v_rfq.contact_name, v_rfq.company, 'Okänd kund'),
      v_rfq.company,
      coalesce(v_rfq.contact_email, ''),
      v_rfq.org_number,
      v_rfq.po_number,
      'new',
      coalesce(v_items, '[]'::jsonb),
      round(v_total_ex, 2),
      round(v_total_ex * 1.25, 2),
      coalesce(v_rfq.quote_currency, 'SEK')
    )
    RETURNING id INTO v_order_id;
  END IF;

  RETURN QUERY SELECT (v_updated > 0), v_order_id;
END;
$function$;
