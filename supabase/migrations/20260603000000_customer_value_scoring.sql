-- ─────────────────────────────────────────────────────────────────────────────
-- Customer value scoring v2 — "what they do", not just "who they are".
--
-- The previous calculate_customer_score() was 100% firmographic (industry, size,
-- role, country, email-domain, profile-complete) and only recomputed when the
-- profile row changed. It never looked at actual engagement, so an inactive big
-- firm outscored a small, actively-quoting customer — the opposite of valuing
-- customers by value. It also lived only in the database (migration drift).
--
-- v2 splits the 0–100 score into:
--   • FIT (max 60)        — who they are (firmographic, compressed from v1)
--   • ENGAGEMENT (max 40) — what they do: RFQ count, pipeline value (Σ quote
--                            amounts), and recency of last activity.
--
-- Engagement is read live from public.rfqs (joined by user_id, or contact_email
-- for accountless RFQs). A trigger on rfqs re-touches the matching customer so
-- the stored score refreshes whenever a deal is created/updated/deleted.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Scoring formula ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so it can aggregate the customer's RFQs regardless of the
-- writer's RLS (it returns only the aggregate score, never row data).
create or replace function public.calculate_customer_score(profile public.company_profiles)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pts_domain int := 0; pts_size int := 0; pts_industry int := 0;
  pts_role int := 0; pts_country int := 0; pts_complete int := 0;
  pts_rfqs int := 0; pts_pipeline int := 0; pts_recency int := 0;
  rfq_count int := 0; pipeline numeric := 0; last_days int := null;
  total int; tier text; email_domain text;
begin
  -- ── FIT (who they are) · max 60 ────────────────────────────────────────────
  email_domain := lower(split_part(coalesce(profile.email,''),'@',2));
  if email_domain not in ('gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','live.com','msn.com','') then
    pts_domain := 8;
  end if;
  pts_size := case profile.employees
                when '201+' then 12 when '51-200' then 9 when '11-50' then 6 when '2-10' then 3 else 1 end;
  pts_industry := case
    when profile.industry in ('automation','manufacturing','robotics') then 14
    when profile.industry in ('automotive','aerospace')                then 10
    when profile.industry in ('food','pharma','medtech')               then 8
    when profile.industry in ('energy','marine','mining')              then 6
    else 2 end;
  pts_role := case
    when profile.role in ('engineer','buyer','purchasing')   then 10
    when profile.role in ('manager','director','cto','ceo')  then 7
    when profile.role in ('designer','technician')           then 5
    when profile.role = 'student'                            then 1
    else 3 end;
  pts_country := case
    when profile.address_country in ('SE','DE','AT','CH','NL','DK','NO','FI') then 10
    when profile.address_country in ('GB','FR','BE','PL','CZ','ES','IT')      then 6
    else 2 end;
  if profile.profile_complete then pts_complete := 6; end if;

  -- ── ENGAGEMENT (what they do) · max 40 ─────────────────────────────────────
  select count(*),
         coalesce(sum(coalesce(r.quote_amount,0)),0),
         min(extract(epoch from (now() - r.created_at))/86400)::int
    into rfq_count, pipeline, last_days
  from public.rfqs r
  where (profile.id is not null and r.user_id = profile.id)
     or (coalesce(profile.email,'') <> '' and lower(r.contact_email) = lower(profile.email));

  pts_rfqs := case when rfq_count >= 4 then 16 when rfq_count >= 2 then 11 when rfq_count = 1 then 6 else 0 end;
  pts_pipeline := case
    when pipeline >= 100000 then 18
    when pipeline >=  25000 then 12
    when pipeline >=   5000 then 6
    when pipeline >       0 then 3
    else 0 end;
  pts_recency := case
    when last_days is null then 0
    when last_days <= 30   then 6
    when last_days <= 90   then 3
    else 0 end;

  -- ── Total + tier ───────────────────────────────────────────────────────────
  total := pts_domain + pts_size + pts_industry + pts_role + pts_country + pts_complete
         + pts_rfqs + pts_pipeline + pts_recency;
  tier := case
    when total >= 65 then 'enterprise'   -- strong fit AND active
    when total >= 42 then 'hot'
    when total >= 20 then 'warm'
    else 'cold' end;

  return jsonb_build_object(
    'total', total, 'tier', tier,
    'domain', pts_domain, 'size', pts_size, 'industry', pts_industry,
    'role', pts_role, 'country', pts_country, 'complete', pts_complete,
    'rfqs', pts_rfqs, 'pipeline', pts_pipeline, 'recency', pts_recency
  );
end;
$$;

revoke execute on function public.calculate_customer_score(public.company_profiles) from public, anon;
grant  execute on function public.calculate_customer_score(public.company_profiles) to authenticated;

-- 2) Refresh a customer's score when their RFQ activity changes ───────────────
-- SECURITY DEFINER: RFQs can be submitted by anon, and the score lives on a
-- profile row anon cannot update — the definer bumps it past RLS, which re-fires
-- trg_score (BEFORE UPDATE) and recomputes the score from current RFQ data.
create or replace function public.refresh_score_on_rfq()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid  := coalesce(new.user_id, old.user_id);
  eml text  := lower(coalesce(new.contact_email, old.contact_email, ''));
begin
  update public.company_profiles cp
     set updated_at = now()
   where (uid is not null and cp.id = uid)
      or (eml <> '' and lower(cp.email) = eml);
  return null;
end;
$$;

drop trigger if exists trg_rfq_score on public.rfqs;
create trigger trg_rfq_score
  after insert or update or delete on public.rfqs
  for each row execute function public.refresh_score_on_rfq();

-- 3) Backfill existing profiles under the v2 model ────────────────────────────
update public.company_profiles set updated_at = updated_at;
