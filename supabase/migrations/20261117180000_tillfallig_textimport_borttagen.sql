-- Tyska och spanska produkttexter (#434) fylldes i drift 2026-11-17 via en
-- tillfällig funktion, public.tmp_import_produkttext, som bara fanns under
-- importen (nyckelskyddad, aldrig i repot). Importen är klar: 800 av 800
-- aktiva artiklar har description_de och description_es.
-- Funktionen togs bort i drift samma dag; den här filen gör samma sak i
-- andra miljöer så att ingen skrivväg för anon blir kvar.
drop function if exists public.tmp_import_produkttext(text, jsonb);
