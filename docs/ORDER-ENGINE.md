# Order Engine — vad som är byggt och vad som återstår

Följer specens egen indelning. Uppdateras vid varje steg; ett steg räknas som
klart först när det är provat, inte när koden är skriven.

Senast uppdaterad: 2026-09-24.

## Grundprincipen

Kundens order och Maskinvals inköpsordrar är **inte** samma sak.

```
MV-2026-00124            kundordern — den enda kunden ser
  MPO-2026-00431         inköpsorder till Parker
  MPO-2026-00432         inköpsorder till SMC
```

En kundorderrad kan delas mellan flera inköpsordrar och flera försändelser.
Priser och namn är **snapshots**: en gammal order ändrar sig inte när
katalogen gör det.

## FAS 1 (§17)

| Steg | Läge | Var |
|---|---|---|
| B2B-checkout | ❌ | blockerad, se nedan |
| Ordernummer | ✅ | `next_document_number('MV')`, trigger på `orders` |
| Kundens PO-nummer | ✅ | `orders.po_number` |
| Kundens PO som uppladdad fil | ❌ | `document-ai` finns och läser PO-PDF:er, men inget lagras |
| Orderbekräftelse | ⚠️ | `/admin/orderbekraftelse/:id` finns, skickas manuellt |
| Kundportal | ⚠️ | `/sv/orders` visar offerter och ordrar, inte §9:s innehåll |
| Interna leverantörsordrar | ✅ | `create_supplier_pos()`, en per leverantör, idempotent |
| Leverantörs-PO som PDF och e-post | ❌ | nästa steg |
| Manuell leverantörsbekräftelse | ❌ | kolumnerna finns på `supplier_purchase_order_items` |
| Status per orderrad | ✅ | `order_items.status`, `order_status_events` |
| Manuell tracking | ⚠️ | `orders.tracking_number` finns; ingen modell per försändelse |
| Faktura och dokument | ❌ | `orders.invoice_*` + `fortnox-order` finns, ingen dokumentmodell |
| Automatiska kundmejl | ⚠️ | `order-status-email` finns men triggas från webbläsaren |
| Audit log | ✅ | `audit_log` + `fn_audit_log`-triggers på alla nya tabeller |

## Två kända svagheter, medvetet inte lösta än

**E-posten skickas från klienten.** `admin.orders.tsx` m.fl. `fetch`:ar
`order-status-email` efter en lyckad skrivning. Stänger användaren fliken
skickas inget, och en statusändring gjord av en trigger eller av SQL skickar
ingenting alls. §3 vill ha idempotensnyckel på utskick och §15 vill ha retry +
dead-letter. Det hör ihop med `notifications`-tabellen, som inte finns.

**Inköpsordern skapas för hand.** §3 vill att den skapas när ordern läggs.
Den skapas i dag av en knapp i adminvyn, för att §2:s grind — validerad
checkout, giltigt pris, godkänd betalning — inte finns. Att skapa inköpsordrar
automatiskt före den grinden vore att bygga fel sak.

## Det som blockerar checkouten

**Inget av de 846 aktiva produkterna har ett inköpspris.** `products` har
`purchase_price` och `margin` men ingen är ifylld, och `supplier_products` är
tom. En checkout som ska visa styckpris, radsumma, moms och frakt kan inte
byggas mot en katalog utan priser.

Offertvägen är prismekanismen så länge: administratören sätter radpriser i
`/admin/offert/:id`, kunden accepterar, och `respond_to_quote()` skapar
ordern. Den vägen fungerar hela vägen i dag.

Priserna kommer in via leverantörsmötena — se `/sv/admin/leverantorer`, som
samlar de tolv uppgifterna per leverantör (avtal, kundnummer, prislista,
direktleverans, integrationsmetod, orderformat, lagerdata, tracking, retur,
frakt, betalningsvillkor, produktdatarättigheter).

## Provet

`scripts/test-order-engine.sql` — 72 kontroller, självstädande, körs mot
databasen:

| Del | Kontroller | Vad den vaktar |
|---|---|---|
| 1 | 1–34 | orders/order_items/leverantörer, RLS på tre nivåer, snapshots, audit |
| 2 | 35–47 | kundens egen väg via `respond_to_quote`, idempotens, radordning |
| 3 | 48–59 | konfiguratorns orderkod hela vägen till orderraden |
| 4 | 60–72 | grupperingen till inköpsordrar, okänd leverantör, inköpsprisets sekretess |

## §18: acceptanskriterierna

| # | Kriterium | Läge |
|---|---|---|
| 1 | Order med tre produkter från två leverantörer | ✅ |
| 2 | Kundens PO-nummer och uppladdad PO | ⚠️ numret ja, filen nej |
| 3 | Kundordernummer | ✅ |
| 4 | Korrekt orderbekräftelse | ⚠️ manuell |
| 5 | Två separata leverantörsordrar | ✅ |
| 6 | Leverantörsorder som PDF och e-post | ❌ |
| 7–8 | Leverantören bekräftar helt / delvis | ❌ |
| 9 | Kundportalen visar det begripligt | ❌ |
| 10–11 | Delleverans och tracking per rad | ❌ |
| 12–13 | Leveransmejl, andra försändelsen | ❌ |
| 14 | "Levererad" först när alla rader är det | ❌ |
| 15 | Faktura och dokument i portalen | ❌ |
| 16 | Allt i audit log | ✅ |
| 17 | Samma knapptryckning skapar aldrig en dubblett | ✅ |

**4 av 17 klara, 2 halva.**
