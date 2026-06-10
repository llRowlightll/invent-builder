-- Add is_family to the admin pricing list: a product is a family/series
-- placeholder (configure-to-order, not a single orderable article number) when
-- its SKU has no digit OR it has no specs. Used by the "Ladda ner mall" export to
-- mark which rows VLOOKUP directly vs. need a nominal price.
-- Changing the return type requires DROP first; re-grant after.
DROP FUNCTION IF EXISTS public.admin_list_product_pricing();

CREATE FUNCTION public.admin_list_product_pricing()
 RETURNS TABLE(id uuid, sku text, name text, purchase_price numeric, margin numeric, brand_id uuid, category_id uuid, brand_name text, category_name text, is_family boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select p.id, p.sku, p.name, p.purchase_price, p.margin,
           p.brand_id, p.category_id, b.name, c.name,
           (p.sku !~ '[0-9]' OR NOT EXISTS (SELECT 1 FROM public.product_specs s WHERE s.product_id = p.id)) AS is_family
    from public.products p
    left join public.brands b     on b.id = p.brand_id
    left join public.categories c on c.id = p.category_id
    order by p.name;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_list_product_pricing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_product_pricing() TO authenticated;
