#!/usr/bin/env python3
"""
T43: rådgivaren får inte hitta på fakta om en orderkod den slagit upp.

Bakgrunden är en riktig bugg: med rätt mått men utan fakta kallade modellen
DSBC-50-100-PPSA-N3 för "hydraulisk borrcylinder" med 250 bar arbetstryck och
en påhittad "PPSA-tätning i poly-phenylsulfid". DSBC är pneumatisk, och PPSA
är dämpning.

KONTROLLEN PROVAR PÅSTÅENDET, INTE ORDET. Den gjorde inte det förut: förbudet
var ett rent ordförbud ("hydraul" var som helst i svaret), och meningen

    "DSBC är pneumatisk, inte hydraulisk"

-- som är korrekt, och dessutom precis vad vi vill att modellen säger -- fällde
det. Ju utförligare svar, desto större chans att bli röd för att ha rätt. Det
hände 2026-09-25 och stoppade en frontend-deploy som inte hade med rådgivaren
att göra.

Läser svaret som JSON på stdin. Skriver felen på en rad, eller ingenting alls
när svaret håller.
"""
import json
import re
import sys

# Ord som gör meningen till en jämförelse i stället för ett påstående om
# produkten. "Till skillnad från en hydraulcylinder klarar den inte 250 bar"
# innehåller både det förbjudna ordet och det förbjudna talet, och är korrekt.
KONTRAST = r"\b(inte|ej|icke|aldrig|till skillnad|skillnad från|snarare än|varken)\b"

# Pneumatik ligger under det här. Allt däröver är ett hydrauliskt påstående,
# hur det än formuleras.
MAX_BAR = 16


def granska(svar: dict) -> list[str]:
    reply = str(svar.get("reply") or "")
    helheten = json.dumps(svar, ensure_ascii=False)
    fel: list[str] = []

    # Måttet kontrolleras i uppslaget, inte i prosan: "50" står ju redan i
    # koden kunden skickade och ekas tillbaka, så prosan bevisar ingenting.
    if not re.search(r'"bore_mm": ?50', helheten):
        fel.append("bore_mm 50 saknas i uppslaget")

    for mening in re.split(r"(?<=[.!?\n])", reply):
        if not mening.strip() or re.search(KONTRAST, mening, re.I):
            continue
        for m in re.finditer(r"(\d{1,4})\s*bar", mening, re.I):
            if int(m.group(1)) > MAX_BAR:
                fel.append(f"tryckpåstående {m.group(0)} (DSBC är pneumatisk)")
        if re.search(r"hydraul", mening, re.I):
            fel.append("hydrauliskt påstående: " + " ".join(mening.split())[:110])

    # Ordet har ingen korrekt användning om en pneumatikcylinders dämpningskod.
    if re.search(r"poly-?phenyl", helheten, re.I):
        fel.append("påhittat tätningsmaterial (polyphenyl)")

    return fel


if __name__ == "__main__":
    print(" | ".join(granska(json.load(sys.stdin))))
