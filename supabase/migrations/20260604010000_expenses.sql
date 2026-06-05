-- Expenses ledger for the admin Ekonomi page (sales − expenses = result).
-- Admin-only via has_role; manual entry (supplier invoices, costs).
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  expense_date  date not null default current_date,
  description   text not null,
  supplier      text,
  category      text,
  amount_ex_vat numeric not null default 0,
  vat_amount    numeric not null default 0,
  currency      text not null default 'SEK',
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy "admin all expenses" on public.expenses
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
