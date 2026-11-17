-- Företagsinställningarna sparades aldrig (2026-11-17): site_content_admin_write
-- krävde company_profiles.role = 'admin', men admin avgörs av user_roles
-- (has_role) -- som i alla andra tabeller -- och ingen profil har rollen admin.
-- Varje upsert nekades, och sidan visade "Sparat" ändå (rättat i koden).
-- Samma fel slog ut priser.visa, valutapåslaget och redigeringsläget.
drop policy if exists site_content_admin_write on public.site_content;
create policy site_content_admin_write on public.site_content
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

-- Importens versionsrad: adminens skrivrätt fanns i den första migrationen
-- men saknas i drift, så admin.import kunde aldrig logga en version.
drop policy if exists "dataset_versions admin write" on public.dataset_versions;
create policy "dataset_versions admin write" on public.dataset_versions
  for all to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));
