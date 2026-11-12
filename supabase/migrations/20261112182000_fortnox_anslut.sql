-- Fortnox-anslutningen med OAuth (knappen "Anslut Fortnox" i admin).
--
-- Funktionen fortnox-anslut skapar ett slumpat state när admin trycker på
-- knappen, och Fortnox skickar tillbaka det tillsammans med koden. Ett state
-- gäller i 15 minuter och bara en gång. Tabellen läses och skrivs bara med
-- service-nyckeln: RLS är på och det finns inga policies.

create table if not exists public.oauth_states (
  state       text primary key,
  provider    text not null,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

alter table public.oauth_states enable row level security;

comment on table public.oauth_states is
  'Engångs-state för OAuth-anslutningar (Fortnox). Bara service-nyckeln läser och skriver.';
