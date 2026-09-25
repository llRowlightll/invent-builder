-- Mätaren räknade seed-värden som svar.
--
-- HITTAT genom att titta på /admin/leverantorer i webbläsaren: alla åtta
-- leverantörer visade 2/12 trots att ingen svarat på någonting. Två frågor
-- bockades av gratis:
--
--   4. Integrationsväg      räknas som klar när status inte är 'simulerad',
--                           och seeden satte 'manuell'
--   7. Bekräftelse och      räknas som klar när ack_method och
--      tracking            tracking_method är satta, och seeden satte 'email'
--
-- Seeden i #272 är min egen. Den beskrev inte vad vi VET om leverantören utan
-- vad som var rimligt att gissa -- och mätaren kan inte skilja de två sakerna
-- åt. Resultatet är falsk framgång: sidan påstod att två uppgifter var
-- insamlade innan någon ringt ett samtal.
--
-- RÄTTNINGEN ÄR I DATAN, inte i mätarens villkor. Villkoren är rätt: en
-- integrationsväg ÄR besvarad när den inte längre är simulerad, och
-- bekräftelsevägen ÄR besvarad när man vet hur svaret kommer. Det som var fel
-- var att seeden låtsades att någon redan bestämt det.
--
-- 'simulerad' är dessutom den ärliga startpunkten enligt §4: en integration som
-- varken är verifierad, avtalad eller manuellt överenskommen är simulerad.

begin;

-- Bara rader som fortfarande ser ut EXAKT som seeden rörs. Har någon hunnit
-- fylla i något riktigt lämnas raden i fred.
update supplier_integrations
   set status = 'simulerad',
       ack_method = null,
       tracking_method = null
 where status = 'manuell'
   and method = 'email_pdf'
   and order_format = 'pdf_email'
   and ack_method = 'email'
   and tracking_method = 'email'
   and last_verified_at is null
   and endpoint_url is null
   and auth_secret_name is null
   and notes is null;

commit;
