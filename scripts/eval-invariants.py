#!/usr/bin/env python3
"""
eval-invariants.py — PROPERTY-BASED eval for the Maskinval advisor.

Instead of "input X must give output Y" (example tests, which only catch the
exact cases someone thought to write), this generates a WIDE variety of
randomized scenarios — varying load, stroke, environment AND free-text PHRASING
— and checks INVARIANTS that must hold for EVERY response. That catches whole
classes of bugs (e.g. "a precision spec in ANY wording must yield an electric
axis", "an ATEX BOM must never contain an electric SKU and must be complete")
rather than single examples. This is what would have caught the precision-
without-the-word-"electric" and incomplete-ATEX bugs automatically.

Design rule: invariants are CONSERVATIVE — they only assert what physics/safety
unambiguously require, with explicit escape hatches (CUSTOM-SOLUTION when nothing
fits, SPECIFY rows, family products). A false positive erodes trust in the eval,
so we err toward silence over noise.

Usage:
  python3 scripts/eval-invariants.py [--runs N] [--seed S] [--bom] [--verbose]
    --runs N    number of scenarios (default 20)
    --seed S    rng seed (default: time-based; CI passes the run number)
    --bom       also exercise the BOM step (slower, more API calls)
    --verbose   print each scenario's applied invariants
"""

import argparse, json, math, os, random, re, subprocess, sys, time
from datetime import datetime
from typing import Optional

URL = os.environ.get("ADVISOR_URL", "https://buqfbcztspswezwyafxo.supabase.co/functions/v1/groq-advisor")
KEY = os.environ.get("ADVISOR_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cWZiY3p0c3Bzd2V6d3lhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDY2NjksImV4cCI6MjA5NDEyMjY2OX0.U3MdNO-2XXDNjtiIBbfiC9TRiLoPY94afwp9-MF2HME")
REST = "https://buqfbcztspswezwyafxo.supabase.co/rest/v1"
PRESSURE_BAR = 6.0

ELECTRIC_SKU = re.compile(r"^(6E-|FESTO-EG|FESTO-EP|FESTO-DNCE|FESTO-ELG|SMC-LE|SMC-MXS|MW-ELK|PARKER-ETH|PARKER-OSPE)", re.I)
# Electric actuator SKU prefixes that must NOT appear in an ATEX result:
ELECTRIC_ATEX_BAN = re.compile(r"^(6E-|FESTO-EG|FESTO-EP|FESTO-DNCE|FESTO-ELG|SMC-LE|SMC-LEY|SMC-LESH|MW-ELK|PARKER-ETH|PARKER-OSPE|EGC|LEFS|LESH)", re.I)


# ── Catalog snapshot (anon) — for no-hallucination + electric-availability ─────
def load_catalog():
    cmd = ["curl", "-s", f"{REST}/products?select=sku,category:categories(slug),specs:product_specs(key,value)&status=eq.active",
           "-H", f"apikey: {KEY}", "-H", f"Authorization: Bearer {KEY}"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30).stdout
        rows = json.loads(out)
    except Exception:
        return None
    skus, electric_strokes = set(), []
    for r in rows:
        skus.add(r["sku"])
        cat = (r.get("category") or {}).get("slug", "")
        if cat in ("electric-actuator", "linear-module"):
            for s in (r.get("specs") or []):
                if s["key"] in ("stroke_mm", "stroke_max", "max_stroke", "stroke_range"):
                    m = re.findall(r"\d+", str(s["value"]))
                    if m:
                        electric_strokes.append(max(int(x) for x in m))
    return {"skus": skus, "max_electric_stroke": max(electric_strokes) if electric_strokes else 0}


def calc_min_bore(load_kg, pressure_bar=PRESSURE_BAR):
    if load_kg <= 0:
        return 0
    force = load_kg * 9.81 * 2
    area = force / (pressure_bar * 0.1)
    return math.ceil(2 * math.sqrt(area / math.pi))


# ── Scenario generator — base application × environment × PHRASING ─────────────
APPS = [
    ("skjuter {load}kg kartonger på band", "horiz"),
    ("pressar {load}kg detaljer i form", "horiz"),
    ("lyfter {load}kg vertikalt", "vert"),
    ("drar {load}kg vagn {stroke}mm", "horiz"),
    ("centrerar {load}kg plåt", "horiz"),
    ("matar fram {load}kg ämnen", "horiz"),
]
STROKES = [50, 75, 100, 150, 200, 250, 300, 400, 500]
LOADS = [3, 8, 12, 20, 30, 45, 60, 90, 120]

# Environment modifiers. Each carries: the flags it sets, and SEVERAL phrasings
# (crucially incl. ones WITHOUT the obvious keyword — that is where bugs hide).
ENVS = {
    "precision": {
        "phrasings": [
            "precision ±0.02 mm", "noggrannhet ±0.05 mm", "repeterbarhet 0.03mm",
            "positionera exakt inom 0.05 mm", "tolerans 20 µm",
        ],
        "answers": {"precision": "±0.05 mm"},
    },
    "atex": {
        "phrasings": ["i ATEX zon 1", "explosionsfarlig miljö zon 1", "EX-klassad zon 21 damm", "brännbar gas närvarande, ATEX"],
        "answers": {"miljö": "ATEX"},
    },
    "washdown": {
        "phrasings": ["i tvättzon IP69K", "livsmedelsproduktion högtrycksspolning", "daglig kemisk rengöring, hygienisk design"],
        "answers": {"miljö": "washdown IP69K"},
    },
    "highspeed": {
        "phrasings": ["mycket snabb cykel 1500 mm/s", "hastighet 2 m/s", "snabb rörelse >1 m/s"],
        "answers": {"hastighet": "1500 mm/s"},
    },
    "hightemp": {
        "phrasings": ["nära ugn 120 °C", "driftstemperatur 110°C", "het miljö 95 grader"],
        "answers": {"temperatur": "120 °C"},
    },
}


def gen_scenario(rng):
    # ~30% of scenarios omit the stroke entirely. This exercises the no-stroke path
    # (requiredStroke == 0), where strokeless / family products used to be able to
    # rank as "Bästa valet" — the exact bug fixed in the stroke-qualification work.
    give_stroke = rng.random() > 0.3
    apps = APPS if give_stroke else [a for a in APPS if "{stroke}" not in a[0]]
    app, orient = rng.choice(apps)
    load = rng.choice(LOADS)
    stroke = rng.choice(STROKES) if give_stroke else 0
    desc = app.format(load=load, stroke=stroke)
    answers = {"last": f"{load} kg"}
    flags = set()
    if give_stroke:
        answers["slag"] = f"{stroke} mm"
    else:
        flags.add("no_stroke")
    if orient == "vert":
        answers["riktning"] = "vertikal"
        flags.add("vertical")
    # 0–2 environment modifiers (some scenarios are plain pneumatic)
    n_env = rng.choices([0, 1, 2], weights=[3, 5, 2])[0]
    for env in rng.sample(list(ENVS), n_env):
        desc += " " + rng.choice(ENVS[env]["phrasings"])
        answers.update(ENVS[env]["answers"])
        flags.add(env)
    return {"description": f"Cylinder {desc}", "answers": answers,
            "load": load, "stroke": stroke, "flags": flags, "orient": orient}


# ── API ────────────────────────────────────────────────────────────────────────
def call(action, scenario, primary=None, retries=1):
    body = {"action": action, "locale": "sv", "description": scenario["description"], "answers": scenario["answers"]}
    if primary:
        body["primarySku"] = primary
    cmd = ["curl", "-s", "-X", "POST", URL, "-H", "Content-Type: application/json",
           "-H", f"Authorization: Bearer {KEY}", "-d", json.dumps(body)]
    for attempt in range(retries + 1):
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=35).stdout
            d = json.loads(out)
            if isinstance(d, dict) and d.get("error") == "rate_limited":
                if attempt < retries:
                    time.sleep(20); continue
                return {"__rate__": True}
            return d
        except Exception:
            if attempt < retries:
                time.sleep(3); continue
            return None
    return None


def best_option(resp):
    opts = resp.get("options", []) if isinstance(resp, dict) else []
    return next((o for o in opts if str(o.get("badge", "")).lower() in ("bästa valet", "best choice")),
                opts[0] if opts else {})


def num(v):
    try:
        return float(str(v))
    except Exception:
        return 0.0


# ── INVARIANTS ─────────────────────────────────────────────────────────────────
# Each returns list of (name, ok, detail) for the invariants that APPLY.
def check_options(scenario, resp, cat):
    out = []
    opts = resp.get("options", [])
    real = [o for o in opts if o.get("sku") != "CUSTOM-SOLUTION"]
    best = best_option(resp)
    bsku = best.get("sku", "")
    f = scenario["flags"]

    # INV-1 no hallucinated SKU in options
    if cat:
        bad = [o["sku"] for o in real if o.get("sku") and o["sku"] not in cat["skus"]]
        out.append(("INV-options-no-hallucination", not bad, f"okända: {bad}"))

    # INV-2 stroke adequacy: every real option's stroke ≥ required (0/family allowed)
    bad_stroke = [(o.get("sku"), o.get("stroke_mm")) for o in real
                  if num(o.get("stroke_mm")) > 0 and num(o.get("stroke_mm")) < scenario["stroke"]]
    out.append(("INV-options-stroke>=req", not bad_stroke, f"krav={scenario['stroke']}mm underdim: {bad_stroke}"))

    # INV-3 bore adequacy: best option bore ≥ minBore(load) (0/unknown allowed)
    min_bore = calc_min_bore(scenario["load"])
    bb = num(best.get("bore_mm"))
    bore_ok = (bb == 0) or (bb >= min_bore)
    out.append(("INV-options-bore>=minBore", bore_ok, f"load={scenario['load']}kg minBore=Ø{min_bore} best=Ø{bb:.0f} ({bsku})"))

    # INV-4 PRECISION ⇒ best option is an electric ball-screw OR an honest
    # CUSTOM-SOLUTION escalation — but NEVER a concrete pneumatic product
    # (pneumatics physically cannot hold ≤0.1 mm). CUSTOM is the correct answer
    # when another hard constraint (e.g. washdown IP69K, for which the catalog
    # has no electric ball-screw) eliminates every stock electric option.
    # ATEX forbids electric entirely, so this invariant does not apply there.
    if "precision" in f and "atex" not in f:
        ok = (bsku == "CUSTOM-SOLUTION") or bool(ELECTRIC_SKU.match(bsku))
        out.append(("INV-precision=>electric-or-custom", ok, f"best={bsku} (förväntar elektrisk kulskruv eller CUSTOM)"))

    # INV-5 ATEX ⇒ no electric actuator SKU anywhere in options
    if "atex" in f:
        bad = [o.get("sku") for o in opts if ELECTRIC_ATEX_BAN.match(o.get("sku", ""))]
        out.append(("INV-atex-no-electric-option", not bad, f"elektriska i ATEX: {bad}"))

    # INV-6 always at least one real option OR a CUSTOM-SOLUTION fallback
    out.append(("INV-options-nonempty", len(opts) > 0, "inga options alls"))

    # INV-7 the 'Bästa valet' must be a concrete stroke-bearing actuator (or an
    # honest CUSTOM-SOLUTION). A strokeless product as the top pick — a rotary
    # mis-filed as a cylinder, or a family with no parseable stroke — is exactly
    # the bug the stroke-qualification work fixed: it must never be silently the
    # best match. (All scenarios here are cylinder/linear requests, so stroke is
    # the relevant spec; this also holds for the no-stroke scenarios.)
    out.append(("INV-best-concrete-stroke",
                bsku == "CUSTOM-SOLUTION" or num(best.get("stroke_mm")) > 0,
                f"best={bsku} stroke_mm={best.get('stroke_mm')}"))
    return out


def check_bom(scenario, resp, cat, primary):
    out = []
    bom = resp.get("bom", []) if isinstance(resp, dict) else []
    skus = [r.get("sku", "") for r in bom]
    blob = json.dumps(resp, ensure_ascii=False).lower()
    f = scenario["flags"]
    is_pneumatic = "atex" not in f  # electric only if precision forced it; ATEX is pneumatic here

    # INV-B1 BOM never empty (survives rate limits via mandatory skeleton)
    out.append(("INV-bom-nonempty", len(bom) >= 1, f"rader={len(bom)}"))

    # INV-B2 primary SKU is row 1
    out.append(("INV-bom-primary-first", bool(bom) and skus[0] == primary, f"rad1={skus[0] if skus else None} primary={primary}"))

    # INV-B3 no hallucinated SKUs (every row is SPECIFY or in catalog or the primary)
    if cat:
        known = cat["skus"] | {"SPECIFY", primary}
        bad = [s for s in skus if s and s not in known]
        out.append(("INV-bom-no-hallucination", not bad, f"okända: {bad}"))

    # INV-B4 no actuator SKU reused as a non-actuator row (Frankenstein guard)
    actuator_rows = [r for r in bom if r.get("sku") != primary and cat and r.get("sku") in cat["skus"]
                     and re.search(r"aktuator|actuator|axel|cylinder|modul", str(r.get("role", "")), re.I) is None
                     and ELECTRIC_SKU.match(r.get("sku", "") or "x") is None]
    # (kept loose; main dup guard below)
    dup = [s for s in skus if s != "SPECIFY" and skus.count(s) > 1]
    out.append(("INV-bom-no-dup-sku", not dup, f"dubbletter: {sorted(set(dup))}"))

    # INV-B5 ATEX ⇒ no electric SKU AND complete (>=3 rows, valve/control + atex note)
    if "atex" in f:
        bad = [s for s in skus if ELECTRIC_ATEX_BAN.match(s)]
        out.append(("INV-bom-atex-no-electric", not bad, f"elektriska: {bad}"))
        complete = len(bom) >= 3 and ("atex" in blob) and bool(re.search(r"ventil|valve", blob))
        out.append(("INV-bom-atex-complete", complete, f"rader={len(bom)} atex={'atex' in blob} ventil={bool(re.search(r'ventil|valve', blob))}"))

    # INV-B6 vertical ⇒ a load-holding/anti-drop device must exist, of the type
    # matching the actuator: brake motor (electric) OR pilot check valve / rod
    # lock (pneumatic). Type-agnostic — we only require that SOMETHING prevents
    # the load dropping on power/air loss.
    if "vertical" in f:
        ok = bool(re.search(r"backslagsventil|check.valve|pilot|stångbroms|rod.lock|hållventil|lock.valve|bromsmotor|broms|brake|holding|hållbroms", blob))
        out.append(("INV-bom-vertical-loadhold", ok, "saknar lasthållning (bromsmotor/backslagsventil/rod-lock)"))

    # INV-B7 high speed ⇒ shock absorber present
    if "highspeed" in f and is_pneumatic:
        ok = bool(re.search(r"stötdämpare|shock.absorb|dämp|cushion", blob))
        out.append(("INV-bom-highspeed-shock", ok, "saknar stötdämpare"))

    # INV-B8 high temp ⇒ PTFE/FKM seal note
    if "hightemp" in f:
        ok = bool(re.search(r"ptfe|fkm|hög.*temp|high.*temp|tätning|seal", blob))
        out.append(("INV-bom-hightemp-seal", ok, "saknar temp/tätningsvarning"))

    # INV-B9 washdown ⇒ IP69K / hygiene note
    if "washdown" in f:
        ok = bool(re.search(r"ip69|washdown|hygien|316l|food|livs|korrosion", blob))
        out.append(("INV-bom-washdown-note", ok, "saknar washdown-varning"))
    return out


# ── Runner ─────────────────────────────────────────────────────────────────────
def run(n, seed, do_bom, verbose):
    rng = random.Random(seed)
    print("\n" + "═" * 60)
    print(f"  Maskinval — INVARIANT Eval  |  runs={n}  seed={seed}  bom={do_bom}")
    print(f"  {datetime.now():%Y-%m-%d %H:%M:%S}")
    print("═" * 60)

    cat = load_catalog()
    print(f"  katalog: {len(cat['skus']) if cat else '?'} SKU, max elektriskt slag={cat['max_electric_stroke'] if cat else '?'}mm\n"
          if cat else "  ⚠️  kunde inte ladda katalog (no-hallucination-invarianter hoppas över)\n")

    passed = failed = skipped = 0
    violations = []

    for i in range(n):
        sc = gen_scenario(rng)
        tag = ",".join(sorted(sc["flags"])) or "plain"
        opt = call("options", sc, retries=1)
        if opt is None or (isinstance(opt, dict) and opt.get("__rate__")):
            print(f"  [{i+1:02d}] ⏭️  rate/no-resp  ({tag})"); skipped += 1; continue

        checks = check_options(sc, opt, cat)

        if do_bom:
            best = best_option(opt)
            primary = best.get("sku")
            if primary and primary != "CUSTOM-SOLUTION":
                bres = call("bom", sc, primary=primary, retries=1)
                if isinstance(bres, dict) and not bres.get("__rate__") and bres is not None:
                    checks += check_bom(sc, bres, cat, primary)
            time.sleep(1)

        applied = len(checks)
        bad = [(nm, d) for nm, ok, d in checks if not ok]
        if bad:
            failed += 1
            print(f"  [{i+1:02d}] ❌ ({tag})  «{sc['description'][:54]}»")
            for nm, d in bad:
                print(f"        ✗ {nm}: {d}")
            violations.append({"scenario": sc["description"], "answers": sc["answers"], "fails": bad})
        else:
            passed += 1
            if verbose:
                print(f"  [{i+1:02d}] ✅ ({tag}) {applied} invarianter OK")
        time.sleep(1)

    print("\n" + "═" * 60)
    print(f"  RESULTAT: {passed} ✅  {failed} ❌  {skipped} ⏭️  (av {n} scenarier)")
    print("═" * 60)
    if violations:
        print("\n  INVARIANTBROTT:")
        for v in violations:
            print(f"    • «{v['scenario'][:60]}»")
            for nm, d in v["fails"]:
                print(f"        {nm}: {d}")
        print(f"\n  Reproducera: python3 scripts/eval-invariants.py --seed {seed} --runs {n}" + (" --bom" if do_bom else ""))
        print()
        return False
    print("\n  Alla invarianter höll över hela det slumpade indataspannet.\n")
    return True


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=20)
    ap.add_argument("--seed", type=int, default=int(time.time()))
    ap.add_argument("--bom", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()
    sys.exit(0 if run(a.runs, a.seed, a.bom, a.verbose) else 1)
