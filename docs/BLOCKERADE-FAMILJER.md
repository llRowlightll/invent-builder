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

## Tunn källa

| Familj | Dokument | Beställinformation |
|---|---|---|
| **ELEKTRO** | `metalwork-ELEKTRO.pdf` | 2 av 398 stycken |
| **EPCO** | `festo-EPCE-203026.pdf` | 4 av 47 — och dokumentet gäller **EPCE**, inte EPCO. Troligen fel dokument kopplat till familjen. |

---

## Varför det här dokumentet finns

Att modellera en familj ur en broschyr vore att gissa med extra steg. Hela
poängen med arbetet är att varje värde ska gå att peka tillbaka på en källa —
en modell byggd på en översiktstabell ser lika färdig ut som en byggd på en
beställnyckel, och det är precis därför den är farlig.

Familjerna ovan står därför orörda tills rätt dokument finns.
