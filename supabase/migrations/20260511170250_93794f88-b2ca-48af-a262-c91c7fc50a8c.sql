
create table if not exists public.use_case_map (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null,
  use_case_slug text not null,
  title_en text not null,
  title_sv text not null,
  description_en text,
  description_sv text,
  recommended_skus text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_slug, use_case_slug)
);
alter table public.use_case_map enable row level security;
create policy "use_case_map public read" on public.use_case_map for select using (true);
create policy "use_case_map admin write" on public.use_case_map for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

create table if not exists public.config_schemas (
  id uuid primary key default gen_random_uuid(),
  schema_id text not null unique,
  title_en text not null,
  title_sv text not null,
  category_slug text,
  schema_json jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.config_schemas enable row level security;
create policy "config_schemas public read" on public.config_schemas for select using (true);
create policy "config_schemas admin write" on public.config_schemas for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

create table if not exists public.config_rules (
  id uuid primary key default gen_random_uuid(),
  schema_id text not null references public.config_schemas(schema_id) on delete cascade,
  severity text not null default 'warn',
  if_json jsonb not null,
  message_en text not null,
  message_sv text not null,
  goto_step text,
  created_at timestamptz not null default now()
);
alter table public.config_rules enable row level security;
create policy "config_rules public read" on public.config_rules for select using (true);
create policy "config_rules admin write" on public.config_rules for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

create table if not exists public.config_bom_mapping (
  id uuid primary key default gen_random_uuid(),
  schema_id text not null unique references public.config_schemas(schema_id) on delete cascade,
  bom_mapping_json jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.config_bom_mapping enable row level security;
create policy "config_bom_mapping public read" on public.config_bom_mapping for select using (true);
create policy "config_bom_mapping admin write" on public.config_bom_mapping for all to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  locale text not null default 'en',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
create policy "inquiries public insert" on public.inquiries for insert to anon, authenticated with check (true);
create policy "inquiries admin read" on public.inquiries for select to authenticated using (has_role(auth.uid(),'admin'));
create policy "inquiries admin write" on public.inquiries for update to authenticated using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
