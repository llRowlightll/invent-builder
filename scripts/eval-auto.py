#!/usr/bin/env python3
"""
eval-auto.py — Maskinval automatisk eval-loop

Kör N slumpmässiga applikationsscenarier mot live-APIet varje gång.
Validerar fysikaliska krav (stroke, bore, kraft).
Identifierar katalogluckor och RAPPORTERAR dem (auto-skapande borttaget).

Användning:
  python3 scripts/eval-auto.py [--runs N] [--seed S] [--fix] [--verbose]

Flaggor:
  --runs N      Antal scenarios att testa (standard: 15)
  --seed S      Slump-seed för reproducerbarhet (standard: slumpmässigt)
  --fix         (avvecklad no-op) luckor rapporteras, aldrig auto-skapade
  --verbose     Visa fullständiga API-svar
"""

import argparse
import json
import math
import os
import random
import re
import subprocess
import sys
import time
from datetime import datetime
from typing import Optional

# ── Konfiguration ──────────────────────────────────────────────────────────────
URL = os.environ.get(
    "ADVISOR_URL",
    "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/groq-advisor"
)
KEY = os.environ.get(
    "ADVISOR_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cWZiY3p0c3Bzd2V6d3lhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDY2NjksImV4cCI6MjA5NDEyMjY2OX0.U3MdNO-2XXDNjtiIBbfiC9TRiLoPY94afwp9-MF2HME"
)
SUPABASE_URL = "https://buqfbcztspswezwyafxo.supabase.co"
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# ── Scenario-generator ─────────────────────────────────────────────────────────

APPLICATIONS = [
    ("Cylinder skjuter {load}kg kartonger på transportband",    "horisontell", False),
    ("Cylinder pressar {load}kg plastdetaljer i formar",        "horisontell", False),
    ("Cylinder lyfter {load}kg emballage vertikalt",            "vertikal",    True),
    ("Cylinder klipper folie, rörelse {stroke}mm",              "horisontell", False),
    ("Cylinder centrerar {load}kg metallplåt",                  "horisontell", False),
    ("Cylinder knuffar {load}kg produkt längs rulle",           "horisontell", False),
    ("Cylinder lyfter {load}kg verktyg upp och ned",            "vertikal",    True),
    ("Cylinder drar {load}kg vagn {stroke}mm horisontellt",     "horisontell", False),
    ("Cylinder positionerar {load}kg svetsarm, {stroke}mm slag","horisontell", False),
    ("Cylinder pressar {load}kg filter till hus",               "horisontell", False),
]

STROKE_VALUES = [50, 75, 100, 125, 150, 175, 200, 250, 300, 400, 500]
LOAD_VALUES   = [2, 5, 10, 15, 20, 25, 30, 35, 50, 60, 80, 100, 120]
PRESSURE_BAR  = 6.0


def calc_min_bore(load_kg: float, pressure_bar: float = PRESSURE_BAR) -> float:
    """Minsta bore (mm) för given last med säkerhetsfaktor 2."""
    if load_kg <= 0:
        return 0
    force_n = load_kg * 9.81 * 2
    area_mm2 = force_n / (pressure_bar * 0.1)
    return math.ceil(2 * math.sqrt(area_mm2 / math.pi))


def generate_scenario(rng: random.Random) -> dict:
    """Generera ett slumpmässigt men fysikaliskt meningsfullt scenario."""
    template, direction, is_vertical = rng.choice(APPLICATIONS)
    stroke = rng.choice(STROKE_VALUES)
    load   = rng.choice(LOAD_VALUES)
    desc   = template.format(load=load, stroke=stroke)
    answers = {"slag": f"{stroke} mm", "last": f"{load} kg"}
    if is_vertical:
        answers["riktning"] = "vertikal"
    min_bore = calc_min_bore(load)
    return {
        "description": desc,
        "answers":     answers,
        "min_stroke":  stroke,
        "min_bore":    min_bore,
        "load_kg":     load,
        "is_vertical": is_vertical,
    }


# ── API-anrop ──────────────────────────────────────────────────────────────────

def call_api(payload: dict, retries: int = 1) -> Optional[dict]:
    body = json.dumps(payload)
    cmd = [
        "curl", "-s", "-X", "POST", URL,
        "-H", "Content-Type: application/json",
        "-H", f"Authorization: Bearer {KEY}",
        "-d", body,
    ]
    for attempt in range(retries + 1):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if not result.stdout.strip():
                raise ValueError("Tomt svar")
            data = json.loads(result.stdout)
            if isinstance(data, dict) and data.get("error") == "rate_limited":
                if attempt < retries:
                    print("  ⏳ rate limit — 20s…", flush=True)
                    time.sleep(20)
                    continue
                # All retries exhausted — return sentinel so caller can skip
                return {"__rate_limited__": True}
            return data
        except subprocess.TimeoutExpired:
            if attempt < retries:
                time.sleep(3)
                continue
            print("  ⚠️  Timeout")
            return None
        except Exception as e:
            if attempt < retries:
                time.sleep(3)
                continue
            print(f"  ⚠️  API-fel: {e}")
            return None
    return None


# ── Valideringslogik ───────────────────────────────────────────────────────────

def validate_options(response: dict, scenario: dict) -> list[str]:
    """Returnerar lista med fel (tom = OK)."""
    errors = []
    opts = response.get("options", [])
    if not opts:
        return ["Inga options returnerades"]

    best = next(
        (o for o in opts if o.get("badge", "").lower() in ("bästa valet", "best choice")),
        opts[0]
    )

    stroke = float(str(best.get("stroke_mm") or 0))
    bore   = float(str(best.get("bore_mm")   or 0))
    sku    = best.get("sku", "?")

    if stroke > 0 and stroke < scenario["min_stroke"]:
        errors.append(
            f"STROKE för kort: vald={stroke:.0f}mm, krav={scenario['min_stroke']}mm "
            f"(SKU={sku})"
        )

    if bore > 0 and scenario["min_bore"] > 0 and bore < scenario["min_bore"]:
        errors.append(
            f"BORE för liten: vald=Ø{bore:.0f}mm, krav=Ø{scenario['min_bore']:.0f}mm "
            f"(load={scenario['load_kg']}kg, SKU={sku})"
        )

    return errors


# ── Kataloglucka-detektor och auto-fix ─────────────────────────────────────────

def detect_catalog_gap(scenario: dict, response: dict) -> Optional[dict]:
    """
    Identifierar om felet beror på en kataloglucka (saknar produkt med
    rätt stroke + bore kombination). Returnerar gap-info eller None.
    """
    opts = response.get("options", [])
    best = next(
        (o for o in opts if o.get("badge", "").lower() in ("bästa valet", "best choice")),
        opts[0] if opts else {}
    )
    stroke = float(str(best.get("stroke_mm") or 0))
    bore   = float(str(best.get("bore_mm")   or 0))

    stroke_gap = stroke > 0 and stroke < scenario["min_stroke"]
    bore_gap   = bore > 0 and bore < scenario["min_bore"]

    if stroke_gap or bore_gap:
        # Beräkna vilka bore-värden som behövs
        needed_bores = []
        for b in [32, 40, 50, 63, 80, 100]:
            if b >= scenario["min_bore"]:
                needed_bores.append(b)
                if len(needed_bores) >= 3:
                    break
        return {
            "needed_stroke":  scenario["min_stroke"],
            "needed_bores":   needed_bores[:3],
            "min_bore":       scenario["min_bore"],
            "load_kg":        scenario["load_kg"],
        }
    return None


def fix_catalog_gap(gap: dict) -> list[str]:
    """
    DISABLED — kept as a no-op on purpose.

    This used to POST synthetic "Bosch Rexroth PRA" products with FABRICATED SKUs
    into the LIVE catalog to make a failing eval go green. That games the metric and
    pollutes production inventory with phantom products customers can browse and
    request quotes on. A real catalog gap is handled honestly by the advisor's
    CUSTOM-SOLUTION path and reported by the eval so procurement can source a real
    product — never auto-invented. Returns [] so the old behaviour can't come back.
    """
    return []


# ── Huvudloop ──────────────────────────────────────────────────────────────────

def run_eval(n_runs: int, seed: Optional[int], auto_fix: bool, verbose: bool):
    rng   = random.Random(seed)
    used_seed = seed if seed is not None else "random"

    print()
    print("═══════════════════════════════════════════════════════")
    print(f"  Maskinval — Auto-Eval Loop  |  runs={n_runs}  seed={used_seed}")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═══════════════════════════════════════════════════════")

    passes  = 0
    fails   = 0
    skipped = 0
    failures = []
    gaps_detected = []

    for i in range(n_runs):
        scenario = generate_scenario(rng)
        short_desc = scenario["description"][:60] + ("…" if len(scenario["description"]) > 60 else "")
        print(f"\n  [{i+1:02d}] {short_desc}")
        print(f"        last={scenario['load_kg']}kg  slag={scenario['min_stroke']}mm  "
              f"minBore=Ø{scenario['min_bore']:.0f}mm")

        payload = {
            "action":      "options",
            "locale":      "sv",
            "description": scenario["description"],
            "answers":     scenario["answers"],
        }

        response = call_api(payload, retries=1)
        if response is None:
            print("       ⚠️  Inget svar — skippar")
            skipped += 1
            continue
        if isinstance(response, dict) and response.get("__rate_limited__"):
            print("       ⏭️  Rate-limit på båda försök — skippar (räknas ej som fel)")
            skipped += 1
            continue

        if verbose:
            print(f"       Response: {json.dumps(response, ensure_ascii=False)[:300]}")

        errors = validate_options(response, scenario)

        if not errors:
            opts = response.get("options", [])
            best = next(
                (o for o in opts if o.get("badge","").lower() in ("bästa valet","best choice")),
                opts[0] if opts else {}
            )
            print(f"       ✅ OK — {best.get('sku','?')}  "
                  f"stroke={best.get('stroke_mm','?')}mm  bore=Ø{best.get('bore_mm','?')}mm")
            passes += 1
        else:
            for err in errors:
                print(f"       ❌ {err}")
            fails += 1
            failures.append({"scenario": scenario, "errors": errors, "response": response})

            # Identifiera (men ALDRIG auto-skapa) en kataloglucka — rapport-only.
            # Att uppfinna en produkt för att göra evalet grönt förorenar live-
            # katalogen; en äkta lucka hanteras av CUSTOM-SOLUTION i advisorn och
            # rapporteras här så inköp kan ta in en riktig produkt.
            gap = detect_catalog_gap(scenario, response)
            if gap:
                note = (f"stroke≥{gap['needed_stroke']}mm bore≥Ø{gap['min_bore']:.0f}mm "
                        f"(last {gap['load_kg']:.0f}kg)")
                print(f"       🔧 KATALOGLUCKA (rapport, ej auto-skapad): {note}")
                gaps_detected.append(note)

        # Kort paus för att inte hammra rate limits
        if i < n_runs - 1:
            time.sleep(2)

    # ── Sammanfattning ──────────────────────────────────────────────────────────
    print()
    print("═══════════════════════════════════════════════════════")
    print(f"  RESULTAT: {passes} ✅  {fails} ❌  {skipped} ⚠️  (av {n_runs} scenarios)")
    print("═══════════════════════════════════════════════════════")

    if failures:
        print()
        print("  Misslyckade scenarios:")
        for f in failures:
            s = f["scenario"]
            print(f"    • last={s['load_kg']}kg slag={s['min_stroke']}mm: "
                  f"{'; '.join(f['errors'])}")

    if gaps_detected:
        print()
        print(f"  Katalogluckor (rapport, {len(gaps_detected)} st — EJ auto-skapade):")
        for g in gaps_detected:
            print(f"    • {g}")
        print("  → Överväg att ta in en riktig produkt; advisorn faller annars tillbaka på CUSTOM-SOLUTION.")

    if not failures and not skipped:
        print()
        print("  Alla scenarios OK! Systemet väljer fysikaliskt korrekta produkter.")

    print()
    return fails == 0


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Maskinval auto-eval loop")
    parser.add_argument("--runs",    type=int,  default=15,   help="Antal scenarios")
    parser.add_argument("--seed",    type=int,  default=None, help="Slump-seed")
    parser.add_argument("--fix",     action="store_true",     help="(avvecklad no-op) auto-skapande borttaget — luckor rapporteras bara")
    parser.add_argument("--verbose", action="store_true",     help="Visa API-svar")
    args = parser.parse_args()

    ok = run_eval(
        n_runs=args.runs,
        seed=args.seed,
        auto_fix=args.fix,
        verbose=args.verbose,
    )
    sys.exit(0 if ok else 1)
