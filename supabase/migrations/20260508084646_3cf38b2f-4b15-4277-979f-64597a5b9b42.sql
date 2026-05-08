
create table public.users_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en' check (locale in ('en','sv')),
  ai_mode text not null default 'auto' check (ai_mode in ('auto','fallback')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users_profile enable row level security;

create policy "users read own profile" on public.users_profile
  for select to authenticated using (auth.uid() = user_id);

create policy "users insert own profile" on public.users_profile
  for insert to authenticated with check (auth.uid() = user_id);

create policy "users update own profile" on public.users_profile
  for update to authenticated using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users_profile (user_id, display_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'locale', 'en')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
