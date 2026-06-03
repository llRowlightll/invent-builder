-- Intro discount on offers: a percent applied to the offer subtotal (before VAT).
-- Used by admin.offert to run a first-order acquisition offer (one-click −15% for
-- first-time customers). Defaults to 0 so existing/normal offers are unaffected.
alter table public.rfqs
  add column if not exists discount_pct numeric(5,2) not null default 0;
