-- rfq_status_counts() leaked business metrics (RFQ counts per status) to anon
-- via /rest/v1/rpc/rfq_status_counts — it had no auth gate, so anyone could
-- learn how many quotes/orders existed per status. Its only caller is the admin
-- dashboard. Add the same admin gate used by admin_list_product_pricing.
CREATE OR REPLACE FUNCTION public.rfq_status_counts()
 RETURNS TABLE(status text, n bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized' USING errcode = '42501';
  END IF;
  RETURN QUERY
    SELECT COALESCE(r.status, 'new') AS status, COUNT(*) AS n
    FROM rfqs r
    GROUP BY r.status
    ORDER BY n DESC;
END;
$function$;
