-- products har läsrätt per kolumn för anon/authenticated. description_de och
-- description_es (20261117160000) fick ingen, så sajtens produktfrågor nekades
-- ("permission denied for table products") och produktsidorna föll i ca 20
-- minuter 2026-11-17. VARJE ny kolumn som sajten läser behöver en egen grant.
grant select (description_de, description_es) on public.products to anon, authenticated;
