-- Offert i euro med Riksbankens kurs och valutapåslag.
--
-- Ägaren 2026-11-13: utländska kunder ska få offerten i euro, med ett
-- valutapåslag "som alla brukar ha". Påslaget täcker bankens växlingsavgift
-- och kursrörelsen fram till betalning (30 dagar netto); 2 % är vanligt i
-- B2B och är standard, ändras under admin → Inställningar.
--
-- Kursen kommer från Riksbanken (SWEA, serie SEK<valuta>PMI: kronor per
-- enhet, fastställd dagligen). Kursen, datumet och påslaget som användes
-- sparas på offerten, så att den går att räkna efter i efterhand.

begin;

alter table public.rfqs
  add column if not exists valutakurs numeric,
  add column if not exists valutakurs_datum date,
  add column if not exists valutapaslag numeric;

comment on column public.rfqs.valutakurs is 'Kronor per enhet av quote_currency (Riksbanken) när offerten räknades om från SEK.';
comment on column public.rfqs.valutapaslag is 'Valutapåslag i procent som användes vid omräkningen.';

insert into public.site_content (key, locale, value)
values ('valuta.paslag', 'all', '2')
on conflict (key, locale) do nothing;

-- Kundens offertsida: vilken kurs offerten räknades om med. Inga andra
-- uppgifter om offerten.
create or replace function public.offertens_valuta(p_rfq_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'valuta', coalesce(r.quote_currency, 'SEK'),
    'kurs', r.valutakurs,
    'datum', r.valutakurs_datum,
    'paslag', r.valutapaslag)
  from rfqs r where r.id = p_rfq_id
$$;

revoke all on function public.offertens_valuta(uuid) from public;
grant execute on function public.offertens_valuta(uuid) to anon, authenticated;

commit;
