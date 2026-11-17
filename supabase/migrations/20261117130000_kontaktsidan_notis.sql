-- Kontaktsidan (/talk): mejl till ägaren när någon skriver (2026-11-17).
-- Meddelandena sparades i inquiries utan att någon fick veta det. Samma
-- mönster som orderns mejl: pg_net anropar en funktion med radens id, och
-- funktionen läser om raden. Ett mejl får aldrig stoppa att meddelandet sparas.

create or replace function public.trg_inquiry_notis()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  begin
    perform net.http_post(
      url := 'https://buqfbcztspswezwyafxo.supabase.co/functions/v1/kontakt-notis',
      body := jsonb_build_object('inquiry_id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000);
  exception when others then
    raise warning 'kontakt-notis för % köades inte: %', new.id, sqlerrm;
  end;
  return null;
end $function$;

revoke all on function public.trg_inquiry_notis() from public, anon, authenticated;

drop trigger if exists inquiry_notis on public.inquiries;
create trigger inquiry_notis
  after insert on public.inquiries
  for each row execute function public.trg_inquiry_notis();
