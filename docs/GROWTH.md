# Maskinval — Tillväxtplan ("störst i världen")

_Mål: bli den självklara platsen för att hitta, dimensionera och köpa
industriautomation. Den här planen är ärlig om vägen dit — man blir inte störst
över en natt, man vinner en nisch och expanderar utåt._

---

## 1. Vad som gör oss annorlunda (kilen)

De flesta komponentdistributörer är **katalogdumpar** — du måste redan veta
exakt artikelnummer. Maskinvals försprång är att vi löser **jobbet före köpet**:

| Konkurrenten | Maskinval |
|---|---|
| Sök på artikelnummer | **AI-rådgivare**: beskriv maskinen → få komplett stycklista |
| "Kontakta säljare för specialmått" | **Konfigurator** (159 familjer): välj egen slaglängd/borr själv, som Festo S+ |
| Statisk PDF-katalog | 732 produkter × 4 språk, strukturerad & sökbar |
| Offert via telefon | RFQ-flöde direkt i maskinbyggaren |

Det här är inte bara features — det är **innehåll som rankar** och
**verktyg som konverterar**. Hela tillväxtplanen hänger på att förstärka de två.

---

## 2. Trappan (faser, inte ett språng)

- **Fas 0 — Vinn nischen (Sverige, pneumatik/automation).** Ranka på long-tail,
  bygg de första 100 kunderna, få offert→order-flödet att snurra. _Nu._
- **Fas 1 — Norden.** Samma motor, lägg till norskt/danskt/finskt innehåll +
  frakt. När fas 0 ger återkommande order.
- **Fas 2 — DACH/EU.** Sajten är redan på `de`/`en`/`es`. Tyskland är den största
  automationsmarknaden i Europa — gå dit när konverteringen är bevisad.
- **Fas 3 — Global long-tail.** Programmatisk SEO + konfigurator på fler språk.

Bli **mätbart bäst i fas 0 innan du betalar för fas 1.** Disciplin slår ambition.

---

## 3. SEO — vår största hävstång (vi har redan ytan)

Vi har en enorm indexerbar yta som lokala konkurrenter saknar:
**732 produkter × 4 språk + 159 konfiguratorsidor + kategori-/jämförelsesidor**
= tusentals sidor med köpintention.

**Redan byggt (teknisk grund):**
- ✅ Dynamisk `sitemap.xml` — nu inkl. alla produkter (endast aktiva),
  kategorier **och konfiguratorer** + `hreflang` för sv/en/de/es.
- ✅ `robots.txt` → pekar på sitemap.
- ✅ Strukturerad data (JSON-LD): Product, Breadcrumb, Organization, WebSite.
- ✅ OG-bild + favicons + canonical-URL:er.

**Att göra (operativt — du/teamet):**
1. **Google Search Console + Bing Webmaster** — verifiera `maskinval.se`,
   skicka in sitemap. (Dag 1 efter lansering.)
2. **Innehåll på kategori- & konfiguratorsidor** — varje kategori behöver
   2–3 stycken redaktionell text ("Så väljer du rätt cylinder", "ISO 15552 vs
   kompakt"). Det är skillnaden mellan att ranka och inte.
3. **Köpguider/blogg** (long-tail som folk googlar):
   - "Hur dimensionerar jag en pneumatikcylinder?" → CTA till AI-rådgivaren.
   - "Beräkna luftförbrukning" / "Välja ventilstorlek (Cv/Kv)".
   - "Festo vs Parker vs Camozzi — så skiljer de sig."
   Varje guide pekar in i ett verktyg (rådgivare/konfigurator) = leads.
4. **Jämförelsesidor** (`/compare`) — programmatiska "X vs Y"-sidor rankar bra
   och fångar jämförande sökningar.

> SEO-regeln här: **verktygen är magneterna, innehållet är vägskyltarna.**
> Skriv aldrig en guide utan en knapp till rådgivaren/konfiguratorn.

---

## 4. Leadgen & konvertering — verktygen ÄR magneten

- **AI-rådgivaren = lead magnet.** Låt vem som helst köra den gratis; fånga
  e-post när de vill **spara/exportera stycklistan** eller begära offert.
- **Konfiguratorn** → "Begär offert på din konfiguration" (RFQ). Varje sparad
  konfiguration är en het lead.
- **Intro-rabatt −15 % på första ordern** (redan byggd) — sänker tröskeln.
- **Återkommande**: e-post när offert skickats, statusmail på order (Resend-flödet
  finns — kräver bara API-nyckel, se `LAUNCH.md`).
- **Fri "verktygslåda"** som egen leadgen-kanal: luftförbruknings-kalkylator,
  cylinderkrafts-kalkylator, enhetsomvandlare (`/convert` finns redan). Gratis
  verktyg → backlinks + återkommande besök.

---

## 5. Betalda kanaler (när organiskt börjar bita)

| Kanal | Varför | Not |
|---|---|---|
| **Google Ads (Search)** | Högintention: folk söker exakta artikelnummer & "köp pneumatikcylinder" | Bjud på konkurrenters artnr + "automation distributör" |
| **Google Shopping/PMax** | När priser finns (se `LAUNCH.md`) | Kräver produktfeed |
| **LinkedIn** | Underhålls-/automationsingenjörer, inköp | Innehållsdrivet, inte hårdsälj |
| **Retargeting** | RFQ-övergivare, konfigurator-besökare | Billigast ROI tidigt |

Börja inte med betalt förrän **offert→order-flödet konverterar organiskt** —
annars betalar du för att fylla en hink med hål.

---

## 6. Partnerskap & vallgrav

- **Varumärkesrelationer** (Festo, Parker, Bosch Rexroth, Camozzi, Metal Work):
  auktoriserad återförsäljarstatus = trovärdighet + ev. co-marketing.
- **Integratörer/OEM:er & maskinbyggare**: de köper i volym och återkommer.
  Maskinbyggaren + stycklistor är gjorda för dem — sälj B2B-relationen.
- **Marknadsplatser** (t.ex. Alibaba/Europages för fas 2) som extra kanal.
- **Vallgrav = data + verktyg.** Ju fler som dimensionerar via rådgivaren, desto
  bättre blir den. Det kan ingen katalogkonkurrent kopiera snabbt.

---

## 7. Mätning (utan mätning ingen tillväxt)

- **GA4 eller Plausible** (Plausible = GDPR-snällt, enkelt) — installera dag 1.
- **Search Console** — vilka sökningar ger visningar/klick.
- **Tratt att följa varje vecka:**
  `besök → rådgivare/konfigurator-körning → RFQ → offert → order`.
- **Nordstjärne-KPI för fas 0:** antal **RFQ/vecka** och **offert→order-%**.
  Allt annat (trafik, ranking) är input till de två.

---

## 8. Första 90 dagarna (prioriterat)

**Vecka 1–2 — Lansera & mät**
- Klart: lägg in priser, sätt e-post (Resend), läckt-lösenord-skydd
  (allt i `LAUNCH.md`).
- Search Console + Bing + Plausible/GA4. Skicka in sitemap.

**Vecka 3–6 — Innehåll på ytan vi redan har**
- Redaktionell text på topp-10 kategorierna + topp-20 konfiguratorerna.
- 4–6 köpguider som pekar in i rådgivaren/konfiguratorn.

**Vecka 7–10 — Konvertering**
- E-postfångst vid stycklist-export. Återkopplings-/uppföljningsmail.
- Mät tratten; optimera det svagaste steget.

**Vecka 11–13 — Skala det som funkar**
- Starta Google Ads på högintentionsord när tratten konverterar.
- Dubbla ner på de guider/konfiguratorer som rankar.

---

## 9. Sammanfattning

Vi behöver inte bli störst genom att skrika högst — utan genom att vara den
**enda platsen där du både kan dimensionera, konfigurera och köpa** automation.
Den tekniska SEO-grunden är byggd. Nu handlar det om **innehåll på ytan vi redan
har**, **e-postfångst i verktygen**, och **disciplin att vinna fas 0 innan fas 1**.

> Nästa konkreta steg: följ `LAUNCH.md` (priser + e-post + säkerhet), koppla
> Search Console, och skriv de första 5 köpguiderna med knapp till rådgivaren.
