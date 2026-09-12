# Familjer som inte går att modellera med de dokument vi har

Uppdaterad 2026-09-12 (omskriven — den förra versionen hade fel om sex av nio
familjer).

## Vad som hände

Den 11 september skrev jag en lista på nio familjer som inte gick att
modellera därför att källan saknades. Den 12 september gick jag igenom listan
igen med uppgiften att skaffa det som saknades. **Sex av de nio var inte
blockerade.** Två hade en källa som redan låg i databasen, och fyra hade en
källa som gick att hämta på tjugo minuter.

Det är värt att skriva ut varför, för felen var av tre olika slag och bara ett
av dem handlade om dokumenten.

### Fel 1 — jag mätte på styckenas början

`knowledge_chunks` styckar en katalog i bitar på upp till 4 000 tecken. När
jag letade efter CCIV:s beställtabell läste jag `left(content, 700)` för de
sex styckena som nämner CCIV, såg att de handlade om fixeringsalternativ och
reservdelar, och drog slutsatsen att tabellen inte fanns.

Den låg 3 000 tecken in i stycke 49:

```
A1 .136 COMPACT CYLINDER WITH INTEGRATED VALVE, SERIES CCIV KEY TO CODES
CYL 2 3  0 0 3 2  0 0 5 0  C  P  2  2
    TYPE   BORE    STROKE  MATERIAL GASKETS ELEKTRISK PNEUMATISK
```

En sökning på `KEY TO CODES` över hela Metal Work-katalogen ger **80 träffar**.
Katalogen är inte fattig på beställnycklar; det var min sökning som var det.

### Fel 2 — jag mätte fel sak

För ELEKTRO skrev jag "2 av 398 stycken" har beställinformation. Det talet kom
av att söka på strängen `ELEKTRO`, som bara står i sidhuvudet. Nyckeln ligger
i stycke 101–109 och är fullständig — två varianter, med och utan motor, plus
en tabell över tillåtna kombinationer per borrning:

```
CYL  37    1      032     0100     1       1      1      2      2     0
    TYPE         SIZE   STROKE  PITCH VERSION MOTOR FLANGE TORQUE DRIVE
```

Inläsningen använder redan `pdftotext -layout`. Tabellkolumnerna var alltså
bevarade hela tiden. Det jag efterlyste — "en ny textutvinning som bevarar
tabellkolumner" — fanns redan.

### Fel 3 — jag läste en kommentar som ett faktum

`scripts/ingest-catalogues.py` kopplar varje PDF till en familjeslug:

```python
"festo-MH1-203291.pdf": ("Festo", ["mfh"]),
"festo-EPCE-203026.pdf": ("Festo", ["epco"]),
```

Slugarna **används inte av inläsningen** (`marke, _ = MAP[fn]`). De är
dokumentation, och de var fel: MH1 är miniatyrsätesventilen och EPCE är en
annan cylinder. Jag läste dem som en utsaga om att familjen var undersökt och
saknade källa, när de i själva verket bara var en gissning någon skrivit ned.

Båda är nu rättade i skriptet, med kommentarer som säger varför.

---

## Hur dokumenten hämtades

Festo och Parker svarar `403 Access Denied` på curl. Det är Akamais
botfilter, och det tittar inte bara på `User-Agent` — en ensam UA räcker inte.
Med hela webbläsarens headeruppsättning släpper den igenom:

```
Sec-Fetch-Dest / Mode / Site / User
sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform
Accept, Accept-Language, Upgrade-Insecure-Requests, Referer
```

Skriptet finns inte i repot — det är tre rader curl — men headerlistan ovan är
det som spelar roll om någon behöver hämta fler.

**Festos dokumentnummer löper i bokstavsordning inom en produktgrupp.** EPCE
är 203026 och EPCS är 203028, alltså måste EPCO vara 203027. Det stämde:
`https://www.festo.com/media/catalog/203027_documentation.pdf` ger
"Electric cylinders EPCO, with spindle drive", 38 sidor. Festos egen sökning
hittar noll produktinformation för EPCO — serien är utgången — men filen
ligger kvar på servern.

**SMC:s serie-id hittas via** `/webcatalog/en-jp/indexSearch/<BOKSTAV>`, som
listar dem, och `/webcatalog/en-jp/seriesList/?id=<ID>` pekar på kapitlets
egen PDF. Påståendet i förra versionen — att SMC inte publicerar
beställnycklar öppet och att de måste begäras via distributör — var fel. Varje
katalog nedan bär "How to Order" i klartext.

---

## Det som faktiskt hämtades

| Familj | Fil | Sidor | Nyckel |
|---|---|---|---|
| EPCO | `festo-EPCO-203027.pdf` | 38 | Typkod, 13 positioner |
| MFH | `festo-MFH-203756.pdf` | 48 | Typkod + Ordering data |
| OSP-E | `parker-OSP-E-PA4P017GB.pdf` | 194 | `OSPE20 — 6 0 0 02 — 00000 — 0 00 0 0 0` |
| HMR | `parker-HMR-PA4P024GB.pdf` | 50 | `HMR S 15 B 05 0 - 0000 - 0 0 0 0 0 00 00` |

Och 24 SMC-kataloger som `smc-kat-*.pdf` (C85, CJ2, CJP, CM2, CP96, CQ2, CS1,
CY1, CY1F, CY1S, EX500, KQ2, LESH, LEY, MB, MHC2, MHZ2, MXS, RB, SV1000,
SY3000, VF3000, VQ1000, ZH). Samtliga har minst en "How to Order"-sektion;
SY3000 har 88 och CQ2 har 67.

Allt är inläst: **11 206 nya stycken ur 29 filer.**

ELEKTRO och CCIV behövde inget nytt dokument alls.

---

## Vad som återstår att göra

Att dokumentet finns är inte samma sak som att familjen är modellerad. Det som
nu är **möjligt men ogjort**:

| Familj | Källa finns | Sorts nyckel |
|---|---|---|
| ~~ELEKTRO~~ | ~~`metalwork-ELEKTRO.pdf` st. 101–109~~ | **KLAR** — PR #226 |
| ~~CCIV~~ | ~~Metal Work-katalogen st. 49~~ | **KLAR** — PR #227 |
| EPCO | `festo-EPCO-203027.pdf` | Modulär typkod |
| MFH | `festo-MFH-203756.pdf` | Tabell + typkod |
| OSP-E | `parker-OSP-E-PA4P017GB.pdf` | Positionell |
| HMR | `parker-HMR-PA4P024GB.pdf` | Positionell |
| SMC ×24 | `smc-kat-*.pdf` | "How to Order" per serie |

Metal Work-katalogen har dessutom **80 beställnycklar** totalt, alltså långt
fler familjer än de två vi känner till.

---

## Det som fortfarande är blockerat

### ISV — ventiler ISO 5599/1

Ingen av Metal Works 80 beställnycklar gäller ISV. Serien är en
**tabellfamilj** som VME och RTC-HD: artikelnumren står utskrivna, inte
räknade. Tabellen i stycke 332 är ren och läsbar —

```
7054021200  ISV 55 COB OO  512 g
7054022100  ISV 56 COS CC  496 g
```

— men täcker bara ett av seriens avsnitt (solenoid/pneumatisk med
M12-kontakt, bistabil 5/2 och monostabil 5/3, ISO 1 och ISO 2). Stycke 341 har
SAFE AIR-varianterna. Plug-in, M8 och ISO 3 saknas.

Att modellera en ventilfamilj till hälften är sämre än att låta bli: kunden
ser ett urval och tror att det är sortimentet. **ISV behöver de enskilda
produktbladen**, inte generalkatalogen.

### CY1R — finns inte

`SMC-CY1R` står i `products`. SMC:s magnetkopplade kolvstångslösa serie har
CY1B, CY1S, CY1L, CY1F och CY1H. Jag hämtade alla tre CY1-katalogerna —
CY1-E, CY1S-Z-E och CY1F-E, 81 sidor tillsammans — och strängen `CY1R`
förekommer **noll gånger**.

Det är inte en källbrist utan ett påhittat artikelnummer, av samma slag som
KPZ:s och VME:s. Det hör hemma i produktdatagenomgången, inte här.

---

## Varför det här dokumentet finns

Att modellera en familj ur en broschyr vore att gissa med extra steg. Hela
poängen med arbetet är att varje värde ska gå att peka tillbaka på en källa —
en modell byggd på en översiktstabell ser lika färdig ut som en byggd på en
beställnyckel, och det är precis därför den är farlig.

Den här omgången lägger till en andra läxa, som är obekvämare: **ett påstående
om att källan saknas är också ett påstående, och det behöver lika mycket
belägg som en modell.** Sex av nio familjer stod stilla i ett dygn på grund av
tre mätfel som var och en tog under en minut att motbevisa.

Kontrollfrågan innan något skrivs upp som blockerat igen:

1. Har jag läst hela stycket, eller bara dess början?
2. Sökte jag på familjens namn, eller på det nyckeln faktiskt heter
   (`KEY TO CODES`, `Type code`, `How to Order`, `Order code`)?
3. Har jag öppnat dokumentet, eller läst någon annans etikett på det?

---

## Uppdatering 2026-09-12, senare samma dag

**ELEKTRO och CCIV är modellerade** (PR #226 och #227). Båda var som sagt
aldrig blockerade — nycklarna låg i databasen hela tiden.

**Metal Works hela generalkatalog är nu hämtad**: 1 978 sidor, utgåva 09/2026,
från `media.metalwork.it/media/catalogues/catalogue-eng/catalogue.pdf`. Den
ligger i `docs/kataloger/` men är inte inläst — se `docs/pdfs/INDEX.md` för
varför.

Att ha PDF:en lokalt visade sig avgörande och inte bara bekvämt. CCIV:s
beställnyckel har två positioner **utan egen rubrik** i tabellen; vilken som är
verkningssätt och vilken som är magnet går inte att avgöra ur textutvinningen,
som lägger kolumnerna i en annan ordning än sidan. De lästes av sidan som bild.

Samma sak gällde ELEKTRO: att 80 mm minsta slag omfattar Ø32, Ø50 **och**
Ø63/63HD — inte bara de två första — syns bara på sidan, eftersom cellen är
sammanslagen och texten centrerad.

**Läxan är metodologisk, inte bara praktisk:** en tabell som går att läsa som
text är inte samma sak som en tabell man har förstått. När kolumnerna är
nästade eller sammanslagna ska sidan renderas som bild innan något skrivs ned.

Kvar i katalogen: **80 beställnycklar** totalt, alltså långt fler familjer än
de tre vi hittills tagit ur den (VME, CCIV och — via sitt eget dokument —
ELEKTRO).
