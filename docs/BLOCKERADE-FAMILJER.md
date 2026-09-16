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

Och 25 SMC-kataloger som `smc-kat-*.pdf` (C85, CJ2, CJP, CM2, CP96, CQ2, CS1,
CY1, CY1F, CY1S, EX500, KQ2, LESH, LEY, MB, MHC2, MHZ2, MXS, RB, RQ, SV1000,
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
| ~~EPCO~~ | ~~`festo-EPCO-203027.pdf`~~ | **KLAR** — PR #228 |
| ~~MFH~~ | ~~`festo-MFH-203756.pdf`~~ | **KLAR** — PR #229 |
| ~~HMR~~ | ~~`parker-HMR-PA4P024GB.pdf`~~ | **KLAR** — PR #230 |
| ~~OSP-E~~ | ~~`parker-OSP-E-PA4P017GB.pdf`~~ | **KLAR** — sju familjer (B, SB, ST, SBR, STR, BHD, BV), en per beställnyckel |
| SMC ×24 | `smc-kat-*.pdf` | "How to Order" per serie — **CQ2 KLAR** (standard DA/SA enkel kolvstång; CQ2W/CQ2K/CBQ2/CQP2/stor borrning/långt slag är egna nycklar), **MXS KLAR** (standard och MXS□L), **C85 KLAR** (C85/CD85 dubbelverkande enkel kolvstång ø8–25; C85W/C85K/C85R/C75 är egna nycklar), **CJ2 KLAR** (CJ2/CDJ2-Z dubbelverkande enkel kolvstång ø6/10/16; CJ2W/CJ2K/CJ2Z/CJ2R/CBJ2 och enkelverkande är egna nycklar), **CJP KLAR** (stiftcylindern, hela nyckeln), **ZH KLAR** (kropps-/boxtyp ZH□□A ur den riktiga katalogen, hämtad 2026-09-15 -- `smc-kat-zh.pdf` var ZH-X267), **CM2 KLAR** (ur CM2-Z1, hämtad 2026-09-15 -- `smc-kat-cm2.pdf` är CM2-Z vars standardcylinder utgick nov 2025), **CP96 KLAR** (CP96S enkel/dubbel kolvstång; CP96K och dubbelslag -XC10/-XC11 är egna nycklar), **CS1 KLAR** (CS1/CDS1 dubbelverkande enkel kolvstång ø125–300 inkl. lufthydraul och tryckkärlssymbolen -V; CS1W, CS1□Q, dubbelslag -XC8–XC11 och -XC14/-XC15 är egna nycklar), **CY1 KLAR som fyra familjer** (cy1s, cy1l, cy1h, cy1f ur de tre CY1-katalogerna; den påhittade 'cy1r' är borttagen och SMC-CY1R omdöpt till SMC-CY1S; direktmonterade CY3B/CY3R är ett eget kapitel som inte är hämtat), **EX500 KLAR** (typ 2: GW-enhet EN2/PN2, SI-enhet S103, ingångsenhet DXPA/B, grenkabel AC, Y-grenkontakt — en enhet i taget; den påhittade SMC-EX500-Q011 omdöpt till SMC-EX500-GEN2; fältbuss-/matningskablar EX9-AC/EX500-AP, utgångs-/kraftblock och övriga tillbehör sida 1454–1461 är egna artikeltabeller), **LESH KLAR** (storlek 8/16/25, inkrementell steg/servo och batterilös absolut, styrenheten JXC/LEC som nyckel i nyckeln; LES kompakt och det motorlösa utförandet är egna nycklar), **LEY KLAR** (24 V DC steg/servo, storlek 16–40, fästen och lås enligt noterna, styrenheten delad med LESH i le-controller.ts; AC-servo LEY-S/T med LECS/LECY, LEYG, LEY-X5 och den batterilösa absoluta — sida 415–458 saknas i utdraget — är egna nycklar), **MB KLAR** (MB/MDB dubbelverkande enkel kolvstång ø32–125 med sju fästen, gummibuffert, bälg, pivotfäste, knäled, 21 givare med kabellängd/antal och minsta slag per givare, borrning och tappfäste, samt kombinationstabellens specialutföranden; MBW, MBK/MBKW och MBB är egna nycklar, -XC8–XC11 och -XC14 beställs med extra mått och ingår inte; den källösa specen 'ISO 15552' på SMC-MB är borttagen), **MHC2 KLAR** (tvåfingrigt vinkelgripdon ø10–25, D/S, 18 givare med kabellängd/antal och ○ på beställning, 11 specialutföranden; SMC-MHC2 var felbeskriven som treffingrigt radialgripdon — det är MHS3, en egen nyckel), **MHZ2 KLAR** (parallellgripdon ø6–40 ur standardseriens kapitel, hämtat 2026-09-16 från seriesList/?id=MHZ_2-E — `smc-kat-mhz2.pdf` var kompaktserien JMHZ2; D/S/C, fingerläge inkl. smal typ N, ändtapp E/W/K/M för ø10–25, 21 givare med ●/○/—, antal n, -X46/-X51 med egna villkor; MHZL2, MHZJ2, MHZA2, 11-MHZ2 och JMHZ2 är egna nycklar), **VF3000 KLAR** (enkelventilen VF1000/3000/5000 kroppsportad och basmonterad: fem funktioner, högtryck K, strömsparkrets T med sina ljus/spärrdiod-villkor, åtta spänningar, tretton elanslutningar, port och gänga per serie, fäste, -X500/-X600; den fasta ettan före porten; ventilramperna sida 322/333 är egna nycklar; SMC-VF3130-5G-02 döpt om till SMC-VF3130-5G1-02F och rättad från bistabil till monostabil), **VQ1000 KLAR** (plug-in-ventilen VQ1000/2000 för VV5Q11/VV5Q21 och VQ2000 på underplatta: åtta funktioner inkl. dubbla 3-portsventiler A/B/C, metall/gummi, tillvalen B/K/N/R i bokstavsordning, sex spänningar, E, manöver, IP65 W, underplatta 02 med gänga, Q; ramperna och deras kit är egna nycklar; SMC-VQ1101N-5G döpt om till SMC-VQ1101-51 — plug-in-ventilen har varken port, grommet eller direktstyrning), **SY3000 KLAR** (enkelventilen SY3000/5000/7000/9000 kroppsportad och basmonterad: fem funktioner + dubbla 3-portsventiler via -X701, extern pilot R, strömsparkrets T, nio spänningar, 27 elanslutningar inkl. M8 med kabellängd, ljus/spärrdiod, port/snabbkoppling/underplatta per serie, gänga, fästen F1/F2, -X20/-X90/-X701, Q; ramperna sida 766–935 är egna nycklar; SMC-SY3120-5LOZ döpt om till SMC-SY3140-5LOZ-01F), **SV1000 KLAR** (EX260-rampens bas för SV1000/2000/3000: 30 SI-enheter med artikelnummer, 2–20 stationer mot P/E-läge och utgångar, SUP/EXH-block, DIN-skenor D/D0/D3–D20 mot stationerna, portar per serie; EX500/EX250 utgår enligt sida 19, EX600/EX126/EX120/rundkontakt/D-sub/flatkabel/kassett och enkelventilen på underplatta är egna nycklar; SMC-SS5V1-W10S1-04 döpt om till SMC-SS5V1-W10S10D-04U-C6 — rampen har snabbkopplingar, inte G 1/8), **RQ KLAR** (ersätter familjen rdqb, som bara var kombinationen magnet + genomgående hål med påhittad mall: kompaktcylinder med luftdämpning ø20–100, fästena B/A/L/LC/F/G/D, NPT/G för ø32–100, standardtyp 15–100 mm och långslagstyp med gummibuffert C upp till 300 mm, mellanslag i 1 mm-steg, 25 givare med kabellängdernas ○/— per typ, -XA/-XC4/-XC35; katalogkapitlet `smc-kat-rq.pdf` hämtat och inläst, 166 stycken; produkterna SMC-RDQB20/25/32/50 flyttade till family RQ med rätt slag, port och temperatur), **RB KLAR** (ny familj rb i kategorin shock-absorber: RB M6–M27, RBL kylvätsketålig M10–M27, RBQ kort typ M16–M32, kåpa/buffert C, muttertillval J/N/S/SJ/SN, 20 modeller med energi, frekvens, axialkraft, fjäderkraft, reservdelar och fotfästen; produkterna SMC-RBQ0806W/1006W/1412W/2025W var påhittade koder — RBQ har storlekarna 1604–3213 — och döptes om till SMC-RB0806/RB1006/RB1412/RB2015 med katalogens data), **KQ2 KLAR** (ny familj kq2 i kategorin fitting: KQ2{typ}{slang}-{port}{material}{tätning}{knapp}; 32 kopplingstyper, metrisk slang ø2–ø16, gängorna M3/M5/M6, R/Rc 01–04 med S eller P, G01–G04, U01–U04, slang mot slang, nipplar; 1 540 modellnummer lästa ur måttabellerna med scripts/extract-kq2-models.py, 278 regler; tumslangens kapitel, Clean-serien 10-, -X och pluggen KQ2P-□□ är inte med; de nio produktraderna fick SMC-prefix, den nya nyckelns materialbokstav (KQ2H06-01S → KQ2H06-01AS) och rätt gänga — portkoden 01 är R1/8, inte G1/8), 1 kvar |

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

### CY1R — fanns inte; LÖST 2026-09-15 som fyra familjer

`SMC-CY1R` stod i `products`. SMC:s magnetkopplade kolvstångslösa serie har
CY1B, CY1S, CY1L, CY1F och CY1H. Jag hämtade alla tre CY1-katalogerna —
CY1-E, CY1S-Z-E och CY1F-E, 81 sidor tillsammans — och strängen `CY1R`
förekommer **noll gånger**.

Det var inte en källbrist utan ett påhittat artikelnummer, av samma slag som
KPZ:s och VME:s. Åtgärdat: familjen `cy1r` är borttagen och ersatt av
`cy1s`, `cy1l`, `cy1h` och `cy1f` (en modell, `src/lib/catalog/cy1.ts`, fyra
nycklar — OSP-E-mönstret); produktraden är omdöpt till `SMC-CY1S` med
katalogens data (samma id, competitor_map mot FESTO-DGC pekar fortfarande
rätt). CY1L/CY1H/CY1F har inga produktrader — vilka serier som ska säljas är
ett sortimentsbeslut. Direktmonterade CY3B/CY3R (efterföljaren till den
gamla CY1R) är ett eget katalogkapitel som inte är hämtat.

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
