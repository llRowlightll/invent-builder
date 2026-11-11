"""T44/T45: gripdonet mot kravet. Skriver felen, eller ingenting när allt håller.

Läser svaret på stdin. Första argumentet är steget: "options" eller "bom".
Kontrollen tål att katalogen ändras: ett nytt gripdon på 5000 N får gärna
heta "Rätt storlek", men inget under kravet får göra det (granskningen
2026-10-14 -- den gamla T44 hade fallit så fort katalogen fick ett starkt
gripdon).
"""
import json
import re
import sys

KRAV_N = 5000
STORLEK = re.compile(r"Rätt storlek|Mer marginal|Mest marginal|Välj storlek vid order")

d = json.load(sys.stdin)
steg = sys.argv[1] if len(sys.argv) > 1 else "options"
fel = []

if steg == "options":
    opts = d.get("options") or []
    if not opts:
        fel.append("inga alternativ")
    if "Lyftet ingår inte" not in str(d.get("summary", "")):
        fel.append("sammanfattningen säger inte att lyftet inte ingår")
    for o in opts:
        badge = str(o.get("badge", ""))
        kraft = o.get("force_n") or 0
        if STORLEK.search(badge) and kraft < KRAV_N:
            fel.append(f"{o.get('sku')}: '{badge}' med {kraft} N mot ≈ {KRAV_N} N")
    if opts and not any(STORLEK.search(str(o.get("badge", ""))) for o in opts) and opts[0].get("sku") != "CUSTOM-SOLUTION":
        fel.append("inget gripdon räcker, men kundlösningen står inte först")
else:
    rader = d.get("bom") or []
    roller = " | ".join(str(r.get("role", "")) for r in rader)
    lyft = [r for r in rader if "Lyftet ingår inte" in str(r.get("role", ""))]
    if not lyft or lyft[0].get("verifiering") != "ej_uppfyllt":
        fel.append(f"ingen blockerande lyftrad: {roller[:300]}")
    if not any("Greppet ska hålla" in str(r.get("role", "")) for r in rader):
        fel.append("kravet att greppet håller vid tryckfall saknas")
    if d.get("bestallningsklar") is not False:
        fel.append("lösningen kallas beställningsklar utan lyft")
    if any(r.get("kind") in ("check_valve", "rod_lock") for r in rader):
        fel.append("cylinderns fallskydd sitter på gripdonet")

print("; ".join(fel))
