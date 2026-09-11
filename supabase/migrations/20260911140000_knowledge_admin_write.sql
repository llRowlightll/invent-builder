-- Admin-skrivning på knowledge_chunks.
--
-- Tabellen hade BARA en select-policy. Admin-sidan (admin.knowledge.tsx) gör
-- `supabase.from("knowledge_chunks").insert(...)` och `.delete()`, vilket
-- alltså aldrig kan ha fungerat: RLS avvisade skrivningen tyst och sidan såg
-- ut att spara. Samma mönster som React Flow-canvasen, sprängskisserna och
-- bom_items -- något som ser färdigt ut men saknar sin skrivväg.
--
-- De 8 724 chunks som finns måste ha lagts in med servicenyckel utanför
-- kodbasen, vilket är varför ingen märkte att policyn saknades.

drop policy if exists "admins write knowledge" on knowledge_chunks;

create policy "admins write knowledge" on knowledge_chunks
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
