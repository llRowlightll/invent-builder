---
name: rorelse
description: Rörelse och gränssnittshantverk i Emil Kowalskis anda — signaturkurvan cubic-bezier(.32,.72,0,1), transform och opacity enbart, utgång snabbare än ingång, reduced-motion alltid. Använd när något ska animeras, kännas responsivt, eller när ett gränssnitt känns livlöst eller slarvigt.
---

# Rörelse

Principerna kommer från Emil Kowalskis arbete — han skrev [Sonner](https://sonner.emilkowal.ski) och [Vaul](https://vaul.emilkowal.ski), som båda finns i det här projektets `node_modules`, och undervisar på [animations.dev](https://animations.dev). Värdena nedan är **avlästa ur hans kod**, inte återgivna ur minnet.

## Signaturkurvan

```
cubic-bezier(0.32, 0.72, 0, 1)
```

Den förekommer tolv gånger i Sonner och Vaul och är utgångsläget för allt som rör sig. Den startar snabbt och bromsar hårt in i sitt slutläge — rörelsen är *klar* innan ögat hinner följa hela vägen, vilket är det som får ett gränssnitt att kännas snabbt utan att det blir ryckigt.

I Tailwind v4, lägg den som token:

```css
@theme inline {
  --ease-rorelse: cubic-bezier(0.32, 0.72, 0, 1);
}
```

`ease-in-out` är nästan alltid fel. Den bromsar i början, vilket läser som tvekan.

## De fyra reglerna

**1. Animera `transform` och `opacity`. Ingenting annat.**
Sonner rör `transform` och `opacity` på varje tillståndsbyte. De komponeras på GPU:n och utlöser varken layout eller paint. `width`, `height`, `top`, `left` och `margin` gör det, och hackar på en mellanklassmobil. Behöver något byta storlek: `scale`. Behöver något flytta: `translate`.

Undantagen i hans egen kod är få och medvetna — `box-shadow` på 200 ms, `background` och `border-color` på 200 ms för hovring.

**2. Utgång är snabbare än ingång.**
Sonner tonar in på 300 ms och ut på 200 ms. Något som kommer in ska hinna märkas; något som försvinner är redan avklarat i användarens huvud och ska inte stå kvar och vänta. En symmetrisk animering känns trög i utgången varje gång.

**3. Håll dig i bandet 150–400 ms.**
Sonner rör sig mellan 100 ms och 500 ms, med tyngdpunkten på 200–300. Under 100 ms syns rörelsen inte och blir ett hopp. Över 500 ms står användaren och väntar på gränssnittet. 500 ms förekommer hos honom bara på `transform` för ett helt element som byter plats — aldrig på något man klickat på.

**4. `prefers-reduced-motion` är inte valfritt.**
Sonner stänger av allt, med `!important`:

```css
@media (prefers-reduced-motion) {
  [data-sonner-toast], [data-sonner-toast] > * {
    transition: none !important;
    animation: none !important;
  }
}
```

Inte "kortare varaktighet" — **av**. Slutläget ska vara korrekt utan att en enda animering körts.

## Rörelse ska ha ett skäl

Tre giltiga skäl, och inga andra:

- **Orientering** — varifrån kom det här, vart tog det vägen. En meny som växer ur sin egen knapp förklarar sitt ursprung; en som tonar in mitt på skärmen gör det inte.
- **Återkoppling** — systemet tog emot. En knapp som sjunker 1 px vid tryck svarar.
- **Kontinuitet** — samma sak, ny plats. Ett kort som blir en sida ska behålla sin identitet genom bytet.

Är skälet "det ser kul ut" ska rörelsen bort. Utsmyckande animering är den snabbaste vägen till ett gränssnitt som känns AI-genererat, och den kostar dessutom batteri.

## Ursprungsmedveten rörelse

Saker ska röra sig från där de kom ifrån. En dropdown som öppnas under sin knapp sätter `transform-origin: top`; en som öppnas ovanför sätter `bottom`. Radix exponerar `data-side` för just det här, och projektet kör redan Radix:

```css
[data-side="bottom"] { transform-origin: top; }
[data-side="top"]    { transform-origin: bottom; }
```

En panel som skalas från sin mitt när den hör hemma i ett hörn ser fel ut även för den som inte kan säga varför.

## Avbrytbarhet

En animering som inte kan avbrytas är en bugg. Klickar någon två gånger snabbt ska den andra rörelsen ta vid från var den första faktiskt befann sig, inte från sitt startläge. Varaktighetsbaserade övergångar i CSS hanterar det hyfsat eftersom `transition` interpolerar från nuvarande beräknade värde — men en `@keyframes`-animering med `forwards` gör det inte, den börjar om. Föredrar `transition` framför `animation` för allt som svarar på indata.

## Hantverket runt omkring

Rörelse är sista lagret. Det som faktiskt skiljer ett polerat gränssnitt från ett slarvigt sitter i detaljer som inte rör sig alls:

- **Optisk justering slår matematisk.** En ikon centrerad på pixeln ser ofta ocentrerad ut. Flytta den tills den *ser* rätt ut.
- **Tal i kolumn kräver `tabular-nums`.** Utan det hoppar siffror i bredd och en uppdaterande summa darrar.
- **Hover finns inte på pekskärm.** Bygg aldrig något nödvändigt bakom `:hover`. `@media (hover: hover)` när effekten bara gäller mus.
- **Fokusringen tas aldrig bort.** `:focus-visible` med synlig kontrast, alltid.
- **Klickytan är minst 44×44 px** även när det synliga elementet är mindre.
- **Markera inte text som inte ska markeras.** `user-select: none` på knappetiketter, aldrig på innehåll.
- **Disabled utan förklaring är en återvändsgränd.** Står en knapp avstängd ska skälet synas intill.

## Checklista före merge

- [ ] Kurvan är `cubic-bezier(.32,.72,0,1)` och inte `ease-in-out`
- [ ] Bara `transform` och `opacity` animeras
- [ ] Utgången är kortare än ingången
- [ ] Varaktigheten ligger i 150–400 ms
- [ ] `prefers-reduced-motion` stänger av allt, och slutläget är ändå korrekt
- [ ] Rörelsen har ett av de tre skälen
- [ ] `transform-origin` pekar mot där elementet kom ifrån
- [ ] Inget nödvändigt gömt bakom `:hover`
- [ ] Fokusringen syns
