-- OAuth-tokens som överlever sin egen förnyelse.
--
-- Fortnox access token lever EN TIMME. Det i sig är hanterbart -- man förnyar.
-- Problemet är att Fortnox ROTERAR refresh-token: varje förnyelse returnerar
-- ett NYTT refresh-token och ogiltigförklarar det gamla.
--
-- Det gör en miljövariabel omöjlig som lagring. En edge-funktion kan läsa
-- Deno.env men inte skriva till den, så det nya refresh-token skulle tappas
-- vid varje förnyelse och kedjan bryts permanent efter första gången. Då måste
-- någon logga in i Fortnox utvecklarportal och börja om.
--
-- Därför en tabell. Miljövariabeln FORTNOX_REFRESH_TOKEN används bara för att
-- SÅ raden första gången; efter det äger tabellen sanningen.
--
-- Raden innehåller giltiga API-nycklar till ett ekonomisystem. Ingen roll utom
-- service_role kommer åt den -- varken anon, authenticated eller admin. Det
-- finns ingen RLS-policy alls, vilket med RLS påslaget betyder att allt utom
-- service_role nekas.

begin;

create table if not exists integration_tokens (
  provider       text primary key,
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,
  last_error     text,
  updated_at     timestamptz not null default now()
);

comment on table integration_tokens is
  'OAuth-tokens per integration. Enbart service_role. Fortnox roterar sitt refresh-token vid varje förnyelse, så det MÅSTE sparas här och inte i en miljövariabel.';

alter table integration_tokens enable row level security;
-- Medvetet ingen policy: med RLS påslaget och noll policyer når bara
-- service_role raden, vilket är precis avsikten.

revoke all on integration_tokens from anon, authenticated;

commit;
