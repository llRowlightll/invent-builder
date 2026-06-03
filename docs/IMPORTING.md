# Importera produkter (leverantörskataloger)

Så fyller du katalogen så att advisorn refererar **riktiga artiklar** istället för
"ej i katalog". Ladda ner leverantörens datablad/katalog, klistra in i mallen och
importera.

## Hur
1. Gå till **`/sv/admin/import`** (admin-inloggning).
2. Klistra in / ladda upp en CSV med rubrikraden nedan.
3. Rader med okänt `brand_slug` eller `category_slug` hoppas över (du får en lista).
4. Importen gör **upsert på `sku`** — kör om för att uppdatera befintliga.

Mall: [`product-import-template.csv`](./product-import-template.csv)

## Kolumner
| Kolumn | Krav | Exempel |
|---|---|---|
| `sku` | **obligatorisk** (unik) | `FESTO-EMME-AS-40` |
| `name` | **obligatorisk** | `EMME-AS-40 Servomotor 0.4 kW` |
| `brand_slug` | **obligatorisk** | `festo` |
| `category_slug` | **obligatorisk** | `servo-motor` |
| `family` | valfri | `EMME-AS` |
| `description` | valfri | `Servomotor med hållbroms` |
| `lead_time_days` | valfri (default 14) | `14` |
| `ip_rating` | valfri | `IP54` |
| `fieldbus` | valfri | `EtherCAT` |
| `voltage` | valfri | `400 V` |

> Pris och marginal importeras **inte** här — de sätts separat i `/sv/admin/pricing`.
> Tillgänglighet sätts alltid till "beställ".

## Giltiga `brand_slug`
`festo` · `smc` · `metal-work` · `camozzi` · `parker` · `bosch-rexroth` · `norgren`

## Giltiga `category_slug`
`cylinder` · `valve` · `valve-terminal` · `gripper` · `vacuum` · `sensor` ·
`fitting` · `tubing` · `frl` · `flow-control` · `linear-module` ·
`electric-actuator` · `rotary-actuator` · `mounting` · `shock-absorber` ·
`silencer` · `check-valve` · `cable` · `seal-kit` · `rod-lock` ·
**`servo-motor`** · **`servo-drive`** · **`controller`**

## Prioritera dessa luckor (störst nytta i BOM:en)
1. **`servo-motor`, `servo-drive`, `controller`** — el-drivlinan (Festo EMME/EMMT + CMMT/CMMP + CPX, SMC LECP/LECA). Behövs i varje elektriskt/precisions-system.
2. **`cable`** — motor-/encoderkablar (idag bara 4 st).
3. **`check-valve`** (5 st), **`sensor`** (15), **`mounting`** (13), **`seal-kit`** (4).

När dessa fyllts slutar advisorn skriva "ej i katalog" för el-system och BOM:en blir
direkt beställningsbar.
