# Maskinval — Lanseringschecklista

_Senast verifierad: 2026-06-08 (full smoketest av live-sajten)._

Sajten är byggd, deployad på `maskinval.se` och tekniskt redo. Det finns **3 saker
du måste göra själv** innan du släpper den publikt — de kräver konton/inställningar
som bara du kan röra. Allt annat är klart.

---

## ✅ Vad smoketesten verifierade (allt grönt)

| Område | Status |
|---|---|
| Alla 10 nyckelsidor (hem, produkter, produktsida, konfigurator, maskinbyggare, rådgivare, login, villkor, integritet) | Svarar **200** |
| Katalog | **732** aktiva produkter, **0** utan kategori/märke, 708 med specar |
| Konfiguratorer | **159** familjer, alla med parametrar (625 param, 1997 värden) |
| AI-rådgivaren | Svarar korrekt (frågor + BOM-generering) |
| Produktbilder | Kategori-illustrationer (medvetet val — ingen produkt saknar bild) |

**Fixat under smoketesten:**
- Produkt-räknaren på startsidan flashade `91+` och hoppade sen till rätt siffra
  (SSR-runtime läste inte count-headern). Räknar nu via radmängd → visar **732** direkt.
- `rfq_status_counts()` läckte affärsstatistik (antal offerter per status) till
  vem som helst utan inloggning → nu admin-gated (anon får 401).

---

## ⚠️ Du måste göra detta (3 steg)

### 1. Lägg in riktiga inköpspriser  — _blockerar offerter_
Just nu har **0 av 732** produkter ett inköpspris, så offertmotorn kan inte räkna
fram något pris. (Kundpris visas aldrig publikt — inköpspriset är intern kostnad
som driver offerterna.)

1. Logga in → **/sv/admin/pricing** → fliken **Prisintag**.
2. Snabbaste vägen: exportera leverantörens prislista till **CSV** (en kolumn för
   artikelnummer/SKU, en för inköpspris, ev. en för marginal), klicka
   **"Ladda upp CSV"**, granska tabellen, **Bekräfta**.
3. Alternativ: klistra in text/PDF (AI extraherar priserna) eller redigera per rad.

Marginal: alla produkter har redan **30 %** som standard — ändra per rad eller via
bulk-marginalen om du vill.

### 2. Företagsmejl + notifieringar (Resend)
Utgående mejl (offertbekräftelser, orderstatus, admin-notiser) skickas från
`noreply@maskinval.se` via **Resend**.

1. Skapa konto på resend.com och **verifiera domänen `maskinval.se`** (lägg in
   SPF/DKIM-DNS-posterna Resend ger dig).
2. Supabase → **Edge Functions → Secrets** → sätt **`RESEND_API_KEY`**.
3. Sätt **`ADMIN_NOTIFY_EMAIL`** till företagets inkorg (annars går alla
   admin-notiser till `alexandrooden@gmail.com`).
4. Test: skicka en RFQ från maskinbyggaren → du ska få admin-notis och kunden en
   bekräftelse.

### 3. Slå på skydd mot läckta lösenord (säkerhet)
Supabase → **Authentication → Password** → aktivera **"Leaked password protection"**
(kollar mot HaveIBeenPwned).
Doc: <https://supabase.com/docs/guides/auth/password-security>

---

## 🔍 Granskat och OK — ingen åtgärd

- **`admin_list_product_pricing`, `save_my_profile`** — `SECURITY DEFINER` men
  gatade internt (admin- resp. inloggningskontroll). Inget läckage.
- **Publika INSERT-policys** (`inquiries`, `advisor_contacts`, logg-tabeller) —
  avsiktliga för kontaktformulär och service-loggar. Vill du minska spam kan du
  lägga till captcha/rate-limit senare; inte en lansingsblockerare.
- **`pg_net` / `vector` i `public`-schemat** — Supabase-standard, ofarligt.
- **`rfq_items`, `user_roles` (RLS på, ingen policy)** — deny-all, dvs. nås bara
  via betrodda RPC:er. Säkert.

---

## Efter lansering — snabbverifiering
1. Öppna `https://maskinval.se/sv` → räknaren ska visa **732+** direkt utan flash.
2. Skicka en testförfrågan → kontrollera att mejlen kommer fram.
3. Logga in som admin → **/sv/admin/dashboard** ska visa offertstatistik.
