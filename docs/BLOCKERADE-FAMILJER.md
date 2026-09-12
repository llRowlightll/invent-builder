# Familjer som inte går att modellera med de dokument vi har

Uppdaterad 2026-09-12.

Revisionen (`scripts/audit-order-codes.ts` och
`scripts/verify-skus-against-catalogue.sql`) pekar ut familjer vars
artikelnummer inte går att belägga. För de flesta räcker dokumentet vi har.
För familjerna nedan gör det inte det, och det är inte något jag kan lösa med
mer grävande — det saknas en källa.

## Ingen beställnyckel i källan

| Familj | Dokument | Problem |
|---|---|---|
| **OSP-E** | `parker-electromechanical.pdf` | Översiktsbroschyr. Ordet "ordering" förekommer **inte en enda gång** i dokumentets 74 stycken. Storlekar (20/25/32/50) och slag för remvarianterna (B 50–3500 mm, BHD 100–2500 mm) står där, men skruvvarianternas slag saknas och det finns ingen kodstruktur alls. |
| **HMR** | `parker-electromechanical.pdf` | Samma broschyr, samma brist. |

**Vad som behövs:** Parkers produktkatalog för OSP-E respektive HMR — inte
översiktsbroschyren. Parker publicerar dem som separata PDF:er.

## Driftmanual utan beställnummer

SMC:s driftmanualer beskriver montage och underhåll men listar inga
beställnycklar. Det gäller **CJP, EX500, SY3000, CY1R** med flera.

**Vad som behövs:** SMC publicerar inga beställnycklar öppet på webben. De
måste begäras via distributörskontakt.

## Källan finns, men beställtabellen går inte att läsa rent

Metal Works General Catalogue är en **bra** källa i sig — 649 stycken, 153 med
beställinformation, och VME gick att modellera ur den (PR #220). Men två
familjer till i samma dokument stannar av olika skäl:

### CCIV — kompaktcylinder med integrerad ventil

Avsnittet (A1.134–A1.137, chunk 49–50) har fixeringsalternativ, dimensioner,
pilotventiler och reservdelar — men **cylinderns egen beställtabell finns inte
i den inlästa texten**. Det som går att belägga:

- Borrningar 20, 25, 32, 40 (ur dimensionstabellen)
- Metal Works kompaktcylinderkod är 12 tecken, t.ex. `230020P040XP` =
  serie 23, borrning 0020, steg P, slag 040, hanrör XP (chunk 45)

CCIV:s egen serieprefix är inte utläst. Att anta att den följer CMPC:s vore en
gissning.

### ISV — ventiler ISO 5599/1

Här finns en **ren** tabell (chunk 332) med riktiga artikelnummer:

```
7054021200  ISV 55 COB OO  512 g
7054022100  ISV 56 COS CC  496 g
7055021200  ISV 65 COB OO  860 g
```

Men den täcker bara **ett** av seriens avsnitt: solenoid/pneumatisk med
M12-kontakt, bistabil 5/2 och monostabil 5/3, storlek ISO 1 och ISO 2.
Katalogen har fler avsnitt — plug-in, M8, ISO 3, monostabil 5/2 — som inte
ligger lika rent i texten.

Att modellera en ventilfamilj till hälften är sämre än att låta bli: kunden
ser ett urval och tror att det är sortimentet. ISV behöver att hela avsnittet
B1.127–B1.160 läses in med bevarad tabellstruktur.

**Vad som behövs för båda:** en ny textutvinning av Metal Work-katalogen som
bevarar tabellkolumner, eller de enskilda produktbladen.

## Tunn källa

| Familj | Dokument | Beställinformation |
|---|---|---|
| **ELEKTRO** | `metalwork-ELEKTRO.pdf` | 2 av 398 stycken |
| **EPCO** | `festo-EPCE-203026.pdf` | 4 av 47 — och dokumentet gäller **EPCE**, inte EPCO. Fel dokument kopplat till familjen. |
| **MFH** | `festo-MH1-203291.pdf` | Dokumentet är *"Solenoid valves MH1, miniature"*. Strängen **"MFH" förekommer 0 gånger** i dess 145 stycken. MH1 är en miniatyrsätesventil; MFH är Festos större magnetventilserie (MFH-5-1/8 m.fl.). Helt fel katalog. |

---

## Varför det här dokumentet finns

Att modellera en familj ur en broschyr vore att gissa med extra steg. Hela
poängen med arbetet är att varje värde ska gå att peka tillbaka på en källa —
en modell byggd på en översiktstabell ser lika färdig ut som en byggd på en
beställnyckel, och det är precis därför den är farlig.

Familjerna ovan står därför orörda tills rätt dokument finns.

---

## Sammanfattning

Av de 21 familjer revisionen pekade ut har **12 modellerats** ur sina
kataloger. De nio som återstår är alla blockerade av källan, inte av arbetet:

| orsak | familjer |
|---|---|
| Broschyr utan beställnyckel | OSP-E, HMR |
| Fel dokument kopplat till familjen | EPCO (EPCE), MFH (MH1) |
| Driftmanual utan beställnummer | SMC-familjerna |
| Tunn källa | ELEKTRO |
| Tabellen går inte att läsa rent | CCIV, ISV |

Det finns alltså inget kvar att göra på den här listan förrän dokument
tillkommer. Nästa steg är antingen att skaffa dem, eller att gå vidare till de
~135 familjer som inte hade uppenbart trasiga artikelnummer men heller aldrig
har kontrollerats mot sin katalog.
