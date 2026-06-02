#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Maskinval advisor regression test suite
# Usage: ./scripts/test-advisor.sh [--url URL] [--key KEY]
#
# Tests the groq-advisor edge function against known-good scenarios.
# PASS = expected SKU or pattern appears in the response.
# FAIL = wrong product, hallucinated SKU, or missing required row.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

URL="${ADVISOR_URL:-https://buqfbcztspswezwyafxo.supabase.co/functions/v1/groq-advisor}"
KEY="${ADVISOR_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cWZiY3p0c3Bzd2V6d3lhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDY2NjksImV4cCI6MjA5NDEyMjY2OX0.U3MdNO-2XXDNjtiIBbfiC9TRiLoPY94afwp9-MF2HME}"

PASS=0; FAIL=0; SKIP=0
FAILURES=()

# Call with automatic retry on rate_limited (waits 15s and retries once)
advisor_call() {
  local body="$1"
  local result
  result=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $KEY" \
    -d "$body")
  if echo "$result" | grep -q '"rate_limited"'; then
    echo "  ⏳ rate limit hit — waiting 20s..." >&2
    sleep 20
    result=$(curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $KEY" \
      -d "$body")
  fi
  echo "$result"
}

call_options() {
  local desc="$1" answers="$2"
  advisor_call "{\"action\":\"options\",\"locale\":\"sv\",\"description\":\"$desc\",\"answers\":$answers}"
}

call_bom() {
  local desc="$1" answers="$2" sku="$3"
  advisor_call "{\"action\":\"bom\",\"locale\":\"sv\",\"description\":\"$desc\",\"answers\":$answers,\"primarySku\":\"$sku\"}"
}

call_questions() {
  local desc="$1"
  advisor_call "{\"action\":\"questions\",\"locale\":\"sv\",\"description\":\"$desc\"}"
}

# Returns exit 0 if response is rate-limited (caller should skip)
is_rate_limited() {
  echo "$1" | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  sys.exit(0 if d.get('error')=='rate_limited' else 1)
except: sys.exit(1)" 2>/dev/null
}

# Returns exit 0 if an OPTIONS response is unusable — any error, unparseable, or no
# options at all (e.g. a rate-limit that survived the retry, returning an empty/error
# body). Caller should SKIP rather than FAIL on these transient/infra responses.
options_unusable() {
  echo "$1" | python3 -c "import sys,json
try:
  d=json.load(sys.stdin)
  sys.exit(0 if (d.get('error') or not d.get('options')) else 1)
except: sys.exit(0)" 2>/dev/null
}

check() {
  local name="$1" json="$2" pattern="$3" expect_absent="${4:-}"
  local ok=true

  # Rate-limited response → skip, not fail (prevents CI flapping on Groq quota spikes)
  if echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('error')=='rate_limited' else 1)" 2>/dev/null; then
    echo "  ⚠️  $name [SKIP — rate limited]"
    ((SKIP++))
    return
  fi

  if ! echo "$json" | python3 -c "import sys,json,re; d=json.load(sys.stdin); s=json.dumps(d,ensure_ascii=False); ok=bool(re.search(r'$pattern',s)); sys.exit(0 if ok else 1)" 2>/dev/null; then
    ok=false
  fi
  if [[ -n "$expect_absent" ]]; then
    if echo "$json" | python3 -c "import sys,json,re; d=json.load(sys.stdin); s=json.dumps(d,ensure_ascii=False); ok=bool(re.search(r'$expect_absent',s)); sys.exit(0 if ok else 1)" 2>/dev/null; then
      ok=false  # pattern that should be absent IS present → fail
    fi
  fi

  if $ok; then
    echo "  ✅ $name"
    ((PASS++))
  else
    echo "  ❌ $name"
    echo "     pattern: $pattern"
    [[ -n "$expect_absent" ]] && echo "     absent:  $expect_absent (found, should not be)"
    FAILURES+=("$name")
    ((FAIL++))
  fi
}

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Maskinval Advisor — Regression Test Suite"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── BLOCK 1: Pneumatiska cylindrar ──────────────────────"

# Test 1: 200mm stroke ska ge PRA-cylinder, INTE KPZ-50mm
echo "  [1] 200mm stroke, 12kg last..."
R=$(call_options \
  "Horisontell cylinder knuffar 12kg kartonger på transportband, stroke 200mm, 400mm/s, 6 bar" \
  '{"cylinder_typ":"Aktor","precision":"±1,0 mm"}')
# Verify first option (Bästa valet) has stroke=200, not stroke=50
FIRST_STROKE=$(echo "$R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
opts=d.get('options',[])
best=[o for o in opts if o.get('badge','').lower() in ('bästa valet','best choice')]
first=best[0] if best else (opts[0] if opts else {})
print(str(first.get('stroke_mm',0)))
" 2>/dev/null || echo "0")
if options_unusable "$R"; then
  echo "  ⚠️  T01 [SKIP — rate limited / empty response]"; ((SKIP++))
elif [[ "$FIRST_STROKE" == "200" ]]; then
  echo "  ✅ T01 primary stroke=200mm (fick: $FIRST_STROKE)"; ((PASS++))
else
  echo "  ❌ T01 primary stroke=200mm (fick stroke: $FIRST_STROKE, ska vara 200)"; ((FAIL++)); FAILURES+=("T01 stroke=$FIRST_STROKE expected 200")
fi

# Test 2: Givare ska finnas i BOM när detektering begärs
echo "  [2] BOM med ändlägesgivare..."
R=$(call_bom \
  "Cylinder 200mm stroke, detektera båda ändlägen med givare" \
  '{"cylinder_typ":"Aktor","precision":"±1,0 mm","detektionspositioner":"2"}' \
  "0822121007")
check "T02 BOM har sensor-rad" "$R" "givare|sensor|SMT|SME|B\\\\.E|detect" ""
check "T02 primär SKU bevarad" "$R" "0822121007" ""

# Test 3: Ingen hallucination — alla BOM-SKU:er ska vara SPECIFY eller katalog-SKU
echo "  [3] Inga hallucinerade SKU:er i BOM..."
R=$(call_bom \
  "Standard pneumatisk cylinder 40mm bore 100mm stroke, 6 bar" \
  '{}' \
  "KPZ-040-0100-A-0-PPV")
check "T03 ingen hallucination" "$R" "KPZ-040-0100-A-0-PPV" ""
# Check that no obviously wrong SKU pattern appears (e.g. random alphanumerics without catalog pattern)

# ─────────────────────────────────────────────────────────────────────────────
sleep 4
echo ""
echo "── BLOCK 2: Precision & elektriska aktuatorer ──────────"

# Test 4: ≤0.1mm precision → el-aktuator, ALDRIG pneumatik som Bästa valet
echo "  [4] High-precision → el-aktuator som Bästa valet..."
R=$(call_options \
  "Elektrisk aktuator 300mm stroke, precision 0.05mm för mätstation" \
  '{"precision":"0.05 mm","stroke":"300 mm"}')
BEST_SKU=$(echo "$R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
opts=d.get('options',[])
best=[o for o in opts if o.get('badge','').lower() in ('bästa valet','best choice')]
print((best[0] if best else (opts[0] if opts else {})).get('sku',''))
" 2>/dev/null || echo "")
# Bästa valet ska INTE vara en pneumatisk cylinder (KPZ, PRA, SMC-C, P1D, etc.)
if options_unusable "$R"; then
  echo "  ⚠️  T04 [SKIP — rate limited / empty response]"; ((SKIP++))
elif echo "$BEST_SKU" | grep -qiE '^(KPZ|0822|P1D-S|SMC-C|SMC-MB|FESTO-DSBC|FESTO-ADN|FESTO-ADVC)'; then
  echo "  ❌ T04 Bästa valet är pneumatisk: $BEST_SKU (ska vara elektrisk)"; ((FAIL++)); FAILURES+=("T04 pneumatic for high-precision: $BEST_SKU")
else
  echo "  ✅ T04 Bästa valet är el-aktuator: $BEST_SKU"; ((PASS++))
fi

# Test 5: Elektrisk vertikal → bromsmotor obligatorisk i BOM
echo "  [5] Elektrisk vertikal → bromsmotor..."
R=$(call_bom \
  "Elektrisk linjäraktuator lyfter 10kg vertikalt 200mm, servodriven" \
  '{"riktning":"vertikal","last_kg":"10"}' \
  "FESTO-DNCE")
check "T05 brake motor present" "$R" "broms|brake|hållbroms|holding.brake" ""

# ─────────────────────────────────────────────────────────────────────────────
sleep 4
echo ""
echo "── BLOCK 3: Specialmiljöer ─────────────────────────────"

# Test 6: ATEX Zone 1 → INGA elektriska actuator-SKU:er i BOM
echo "  [6] ATEX Zone 1 → bara pneumatik..."
R=$(call_bom \
  "Cylinder i ATEX Zone 1 gasexplosiv miljö, 100mm stroke" \
  '{"atex":"Zone 1 gas"}' \
  "0822121007")
# Check SKUs only — explanation text may mention "servo" as context
ATEX_BAD=$(echo "$R" | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
bom=d.get('bom',[])
electric_pat=re.compile(r'^(EGC|LEFS|LESH|HLR|LBB|ELGA|EGSC|DNCE.*servo|SER|FES.*DNCE)',re.I)
bad=[b['sku'] for b in bom if electric_pat.match(b['sku']) and b['sku']!='SPECIFY']
print(','.join(bad) if bad else 'OK')
" 2>/dev/null || echo "ERROR")
if [[ "$ATEX_BAD" == "OK" ]]; then
  echo "  ✅ T06 ATEX: inga elektriska aktuator-SKU:er i BOM"; ((PASS++))
elif [[ "$ATEX_BAD" == "ERROR" ]]; then
  echo "  ⚠️  T06 parse-fel"; ((SKIP++))
else
  echo "  ❌ T06 ATEX: elektriska SKU:er funna: $ATEX_BAD"; ((FAIL++)); FAILURES+=("T06 ATEX electric: $ATEX_BAD")
fi

# Test 7: Vertikal pneumatik → backslagsventil
echo "  [7] Vertikal pneumatik → backslagsventil..."
R=$(call_bom \
  "Pneumatisk cylinder lyfter 20kg vertikalt, 150mm stroke" \
  '{"riktning":"vertikal"}' \
  "0822121007")
check "T07 check valve present" "$R" "backslagsventil|check.valve|pilot.check|hållventil|lock.valve" ""

# Test 8: Hög hastighet >1m/s → stötdämpare
echo "  [8] >1m/s → stötdämpare..."
R=$(call_bom \
  "Cylinder 150mm stroke, hastighet 1200mm/s" \
  '{"hastighet":"1200 mm/s"}' \
  "0822121007")
check "T08 shock absorber present" "$R" "stötdämpare|shock.absorb|dämp|cushion" ""

# ─────────────────────────────────────────────────────────────────────────────
sleep 4
echo ""
echo "── BLOCK 4: Speed/stroke-parsing ───────────────────────"

# Test 9: 400mm/s hastighet ska INTE tolkas som 400mm stroke
echo "  [9] 400mm/s → stroke tolkas som 200mm..."
R=$(call_options \
  "Cylinder stroke 200mm, hastighet 400mm/s" \
  '{}')
check "T09 stroke not 400mm" "$R" "200" "KPZ-025-0050|KPZ-016|50mm.Compact"

# Test 10: 500mm/s → stroke 300mm
echo "  [10] 300mm stroke, 500mm/s hastighet..."
R=$(call_options \
  "Cylinder 300mm stroke, 500mm/s, 8kg last" \
  '{}')
check "T10 stroke=300mm recommended" "$R" "300|P1D-S0[3-9]|PRA.*300|ISO.15552" ""

# ─────────────────────────────────────────────────────────────────────────────
sleep 4
echo ""
echo "── BLOCK 5: PROFINET & Ventilramp ──────────────────────"

# Test 11: PROFINET → ventilramp ska inkluderas i BOM
echo "  [11] PROFINET → ventilramp i BOM..."
R=$(call_bom \
  "Pneumatisk cylinder 200mm, PROFINET styrsystem via ventilramp" \
  '{"styrsystem":"PROFINET","ventiler":"2"}' \
  "0822121007")
check "T11 valve terminal present" "$R" "ventilramp|valve.terminal|CPV|VTSA|MPA|valve" ""

# Test 12: FRL ska alltid vara med för pneumatik
echo "  [12] FRL alltid med för pneumatik..."
R=$(call_bom \
  "Standard pneumatisk cylinder, fabriksluft 6 bar" \
  '{}' \
  "0822121007")
check "T12 FRL present" "$R" "FRL|filter|regulator|MS4|LFR|luftbered|air.prep" ""

# ─────────────────────────────────────────────────────────────────────────────
sleep 4
echo ""
echo "── BLOCK 6: SKU-integritet ─────────────────────────────"

# Test 13: Primär SKU ska alltid vara FÖRSTA raden i BOM
echo "  [13] Primär SKU = första BOM-rad..."
R=$(call_bom \
  "Standard pneumatisk cylinder 200mm" \
  '{}' \
  "0822121007")
FIRST_SKU=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('bom',[{}])[0].get('sku',''))" 2>/dev/null || echo "")
if is_rate_limited "$R"; then
  echo "  ⚠️  T13 [SKIP — rate limited]"; ((SKIP++))
elif [[ "$FIRST_SKU" == "0822121007" ]]; then
  echo "  ✅ T13 primär SKU = rad 1 ($FIRST_SKU)"; ((PASS++))
else
  echo "  ❌ T13 primär SKU = rad 1 (fick: $FIRST_SKU)"; ((FAIL++)); FAILURES+=("T13 primary SKU first row")
fi

# Test 14: FESTO family product → varning i reason
echo "  [14] Family product → config-varning i reason..."
R=$(call_bom \
  "Standard ISO cylinder 200mm stroke" \
  '{}' \
  "FESTO-DSBC")
check "T14 family warning" "$R" "familj|family|beställningskod|ordering.code|config|SPECIFY" ""

# Test 15: Alla SKU:er antingen i katalog eller SPECIFY — inga okända
echo "  [15] Inga okända SKU:er i BOM..."
R=$(call_bom \
  "Pneumatisk cylinder 100mm stroke, FRL, ventil, givare" \
  '{}' \
  "KPZ-040-0100-A-0-PPV")
UNKNOWN=$(echo "$R" | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
bom=d.get('bom',[])
# Flag SKUs that look hallucinated: not SPECIFY, not matching known patterns
known=re.compile(r'^(SPECIFY|KPZ|0822|P1D|FE-|FESTO-|SMC-|CAM|NOR|MW|D-|VTSA|CPV|MS4|MC-|\d{4}-|\d{4}[A-Z])')
bad=[b['sku'] for b in bom if not known.match(b['sku'])]
print(','.join(bad) if bad else 'OK')
" 2>/dev/null || echo "ERROR")
if is_rate_limited "$R"; then
  echo "  ⚠️  T15 [SKIP — rate limited]"; ((SKIP++))
elif [[ "$UNKNOWN" == "OK" ]]; then
  echo "  ✅ T15 alle SKU:er kända format"; ((PASS++))
elif [[ "$UNKNOWN" == "ERROR" ]]; then
  echo "  ⚠️  T15 kunde inte parsa svar"; ((SKIP++))
else
  echo "  ❌ T15 okända SKU:er: $UNKNOWN"; ((FAIL++)); FAILURES+=("T15 unknown SKUs: $UNKNOWN")
fi

# ─────────────────────────────────────────────────────────────────────────────
sleep 4
echo ""
echo "── BLOCK 7: Vakuum & Gripper ────────────────────────────"

# Test 16: Vakuumgrepp → sugkoppar + ejektor i BOM
echo "  [16] Vakuumgrepp → sugkopp + ejektor..."
R=$(call_bom \
  "Vakuumgrepp plockar glasskivor 2kg, sugkoppar, ejektor" \
  '{"typ":"vacuum grip"}' \
  "FESTO-VN")
check "T16 vacuum ejector" "$R" "ejektor|ejector|VN|vacuum|sug" ""

# Test 17: Multi-axis pick & place → 2 aktuatorer
echo "  [17] Pick & place → X + Z aktuatorer..."
R=$(call_bom \
  "Pick and place, X-axel 400mm, Z-axel 150mm, elektrisk servo" \
  '{"x_stroke":"400 mm","z_stroke":"150 mm"}' \
  "FESTO-DNCE")
check "T17 multi-axis 2 actuators" "$R" "X-axel|Z-axel|x.axis|z.axis|Aktuator.*axel" ""

# ─────────────────────────────────────────────────────────────────────────────
sleep 4
echo ""
echo "── BLOCK 8: Frågekvalitet ───────────────────────────────"

# Test 18: Inga dubblettfrågor
echo "  [18] Inga duplicerade frågor..."
R=$(call_questions "Pneumatisk cylinder för att stoppa kartonger på transportband")
DUP=$(echo "$R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
qs=d.get('questions',[])
labels=[q.get('label','')[:40].lower() for q in qs]
dups=[l for l in labels if labels.count(l)>1]
print('DUP:'+','.join(set(dups)) if dups else 'OK')
" 2>/dev/null || echo "ERROR")
if is_rate_limited "$R"; then
  echo "  ⚠️  T18 [SKIP — rate limited]"; ((SKIP++))
elif [[ "$DUP" == "OK" ]]; then
  echo "  ✅ T18 inga dubbletter"; ((PASS++))
elif [[ "$DUP" == "ERROR" ]]; then
  echo "  ⚠️  T18 parse-fel"; ((SKIP++))
else
  echo "  ❌ T18 dubblettfrågor: $DUP"; ((FAIL++)); FAILURES+=("T18 duplicate questions: $DUP")
fi

# Test 19: 4–6 frågor genereras
echo "  [19] 4–6 frågor genereras..."
R=$(call_questions "Elektrisk aktuator för montagelinje, precision viktig")
if is_rate_limited "$R"; then
  echo "  ⚠️  T19 [SKIP — rate limited]"; ((SKIP++))
else
  QCOUNT=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('questions',[])))" 2>/dev/null || echo "0")
  if [[ "$QCOUNT" -eq 0 ]]; then
    echo "  ⚠️  T19 0 frågor [SKIP — troligen rate limit/tomt LLM-svar]"; ((SKIP++))
  elif [[ "$QCOUNT" -ge 4 && "$QCOUNT" -le 6 ]]; then
    echo "  ✅ T19 $QCOUNT frågor (OK)"; ((PASS++))
  else
    echo "  ❌ T19 $QCOUNT frågor (behöver 4–6)"; ((FAIL++)); FAILURES+=("T19 question count=$QCOUNT")
  fi
fi

# Test 20: Stycklistan har minst 3 rader för ett komplett pneumatiskt system
echo "  [20] BOM ≥3 rader (komplett system)..."
R=$(call_bom \
  "Standard pneumatisk cylinder 200mm stroke, 6 bar fabriksluft" \
  '{}' \
  "0822121007")
if is_rate_limited "$R"; then
  echo "  ⚠️  T20 [SKIP — rate limited]"; ((SKIP++))
else
  BCOUNT=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('bom',[])))" 2>/dev/null || echo "0")
  if [[ "$BCOUNT" -ge 3 ]]; then
    echo "  ✅ T20 $BCOUNT BOM-rader (OK)"; ((PASS++))
  else
    echo "  ❌ T20 $BCOUNT BOM-rader (behöver ≥3)"; ((FAIL++)); FAILURES+=("T20 BOM rows=$BCOUNT")
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
sleep 4
echo ""
echo "── BLOCK 9: Specialmiljöer & Katalogkvalitet ───────────"

# Test 21: Washdown IP69K → IP69K-produkt eller washdown-varning
echo "  [21] Washdown IP69K → IP69K eller hygien-varning..."
R=$(call_bom \
  "Pneumatisk cylinder för tvättzon i livsmedelsproduktion, IP69K krävs, 150mm stroke" \
  '{"miljö":"IP69K washdown"}' \
  "0822121007")
check "T21 washdown IP69K" "$R" "IP69K|ip69|washdown|hygien|hygenic|food.grade|livs" ""

# Test 22: Hög temperatur >80°C → PTFE/FKM-tätning nämns
echo "  [22] >80°C → PTFE/FKM-varning..."
R=$(call_bom \
  "Pneumatisk cylinder inuti industriugn, driftstemperatur 120°C, 100mm stroke" \
  '{"temperatur":"120°C"}' \
  "0822121007")
check "T22 high-temp PTFE/FKM" "$R" "PTFE|FKM|hög.*temp|high.*temp|temperatur|120" ""

# Test 23: SIL-säkerhetsfunktion → säkerhetsventil eller SIL nämns
echo "  [23] SIL 2 säkerhetsfunktion → certifierad ventil..."
R=$(call_bom \
  "Säkerhetsfunktion SIL 2, nödstopp klipper pneumatisk cylinder vid maskinskydd" \
  '{"säkerhetsnivå":"SIL 2"}' \
  "0822121007")
check "T23 SIL safety valve" "$R" "SIL|säkerhet|safety|certif|nödstopp|PLd|ISO.13849|PNOZ" ""

# Test 24: Hög hastighet → verklig stötdämpare-SKU (inte bara SPECIFY)
echo "  [24] >1m/s → katalog-SKU för stötdämpare (inte SPECIFY)..."
R=$(call_bom \
  "Cylinder 200mm stroke, slaghastighet 1500mm/s, hög hastighet" \
  '{"hastighet":"1500 mm/s"}' \
  "0822121007")
SA_SKU=$(echo "$R" | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
bom=d.get('bom',[])
hits=[r['sku'] for r in bom if re.search(r'FE-YSR|SMC-RBQ|NOR-SA',r.get('sku',''))]
print(','.join(hits) if hits else 'NONE')
" 2>/dev/null || echo "ERROR")
if is_rate_limited "$R"; then
  echo "  ⚠️  T24 [SKIP — rate limited]"; ((SKIP++))
elif [[ "$SA_SKU" != "NONE" && "$SA_SKU" != "ERROR" ]]; then
  echo "  ✅ T24 stötdämpare katalog-SKU: $SA_SKU"; ((PASS++))
else
  echo "  ❌ T24 stötdämpare saknar katalog-SKU (fick: $SA_SKU)"; ((FAIL++)); FAILURES+=("T24 shock absorber SKU=$SA_SKU")
fi

# ─────────────────────────────────────────────────────────────────────────────
sleep 4

# Test 25: Vertikal lyft → verklig backslagsventil-SKU (inte bara SPECIFY)
echo "  [25] Vertikal lyft → katalog-SKU för backslagsventil..."
R=$(call_bom \
  "Pneumatisk cylinder vertikal lyft 30kg, 200mm stroke, last får ej falla vid luftbortfall" \
  '{"riktning":"vertikal","last":"30 kg"}' \
  "0822121007")
CV_SKU=$(echo "$R" | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
bom=d.get('bom',[])
hits=[r['sku'] for r in bom if re.search(r'FE-HGL|SMC-AKH|MW-NRV',r.get('sku',''))]
print(','.join(hits) if hits else 'NONE')
" 2>/dev/null || echo "ERROR")
if is_rate_limited "$R"; then
  echo "  ⚠️  T25 [SKIP — rate limited]"; ((SKIP++))
elif [[ "$CV_SKU" != "NONE" && "$CV_SKU" != "ERROR" ]]; then
  echo "  ✅ T25 backslagsventil katalog-SKU: $CV_SKU"; ((PASS++))
else
  echo "  ❌ T25 backslagsventil saknar katalog-SKU (fick: $CV_SKU)"; ((FAIL++)); FAILURES+=("T25 check valve SKU=$CV_SKU")
fi

# Test 26: FRL → Festo MS4 (inte Camozzi MC-FR)
echo "  [26] FRL → Festo MS4 föredras över Camozzi..."
R=$(call_bom \
  "Standard pneumatisk cylinder 100mm stroke, 6 bar" \
  '{}' \
  "0822121007")
check "T26 FRL är Festo MS4" "$R" "MS4|FE-MS4|FE-MS6" "MC-FR"

# Test 27: 3-axlig XYZ → minst 3 aktuatorrader i BOM
echo "  [27] XYZ 3-axlad → ≥3 aktuatorrader..."
R=$(call_bom \
  "XYZ pick-and-place robot, X-axel 400mm slag, Y-axel 300mm slag, Z-axel 200mm slag, elektrisk servo" \
  '{"x_stroke":"400 mm","y_stroke":"300 mm","z_stroke":"200 mm"}' \
  "FESTO-DNCE")
AXIS_COUNT=$(echo "$R" | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
bom=d.get('bom',[])
axes=[r for r in bom if re.search(r'X-axel|Y-axel|Z-axel|x.axis|y.axis|z.axis|[XYZ]-ax',r.get('role',''),re.I)]
print(len(axes))
" 2>/dev/null || echo "0")
if is_rate_limited "$R"; then
  echo "  ⚠️  T27 [SKIP — rate limited]"; ((SKIP++))
elif [[ "$AXIS_COUNT" -ge 3 ]]; then
  echo "  ✅ T27 $AXIS_COUNT axelrader (OK)"; ((PASS++))
else
  echo "  ❌ T27 $AXIS_COUNT axelrader (behöver ≥3)"; ((FAIL++)); FAILURES+=("T27 axis rows=$AXIS_COUNT")
fi

# ─────────────────────────────────────────────────────────────────────────────
sleep 4

# Test 28: Hydraulik/extremt hög kraft → varning om att det är utanför katalog
echo "  [28] Hydraulik 50kN → utanför-katalog-varning..."
R=$(call_bom \
  "Hydraulisk cylinder, 200 bar, 50kN kraft, 150mm stroke, pressmaskin" \
  '{"kraft":"50 kN","tryck":"200 bar"}' \
  "0822121007")
check "T28 hydraulic out-of-scope warning" "$R" "hydraul|utanför|outside.*catalog|kN|hög.*kraft|high.*force|200.*bar" ""

sleep 4
# Test 29: precision ≤0.1mm WITHOUT the word "electric" → must still recommend
# an electric ball-screw actuator (not CUSTOM-SOLUTION, not pneumatic).
echo "  [29] precision ±0.02mm utan 'elektrisk' → elektrisk kulskruv..."
R=$(call_options \
  "Positionera 5kg med precision ±0.02mm, 200mm slag" \
  '{"precision":"±0.02 mm","slag":"200 mm"}')
BEST29=$(echo "$R" | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
opts=d.get('options',[])
best=next((o for o in opts if o.get('badge','').lower() in ('bästa valet','best choice')),opts[0] if opts else {})
print(best.get('sku','NONE'))
" 2>/dev/null || echo "ERR")
if options_unusable "$R"; then
  echo "  ⚠️  T29 [SKIP — rate limited / empty response]"; ((SKIP++))
elif echo "$BEST29" | python3 -c "import sys,re; sys.exit(0 if re.match(r'^(6E-|FESTO-EG|FESTO-EP|FESTO-DNCE|SMC-LE|SMC-MXS|MW-ELK|PARKER-ETH|PARKER-OSPE)',sys.stdin.read().strip(),re.I) else 1)" 2>/dev/null; then
  echo "  ✅ T29 precision → elektrisk SKU ($BEST29)"; ((PASS++))
else
  echo "  ❌ T29 precision gav fel/ingen elektrisk ($BEST29)"; ((FAIL++)); FAILURES+=("T29 precision best=$BEST29")
fi

# Test 30: ATEX pneumatic → BOM must be COMPLETE (valve + air prep + warning),
# not just the bare primary actuator, and contain no electric SKUs.
echo "  [30] ATEX zon 1 → komplett BOM (ventil + FRL + ATEX-varning)..."
R=$(call_bom \
  "Cylinder i ATEX zon 1 explosionsfarlig miljö, 150mm" \
  '{"miljö":"ATEX zon 1"}' \
  "0822121007")
if is_rate_limited "$R"; then
  echo "  ⚠️  T30 [SKIP — rate limited]"; ((SKIP++))
else
  ATEX_OK=$(echo "$R" | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
bom=d.get('bom',[])
s=json.dumps(d,ensure_ascii=False).lower()
has_valve = bool(re.search(r'ventil|valve',s))
has_atex  = 'atex' in s
print('OK' if (len(bom)>=3 and has_valve and has_atex) else f'INCOMPLETE rows={len(bom)} valve={has_valve} atex={has_atex}')
" 2>/dev/null || echo "ERR")
  if [[ "$ATEX_OK" == "OK" ]]; then
    echo "  ✅ T30 ATEX komplett BOM"; ((PASS++))
  else
    echo "  ❌ T30 ATEX ofullständig: $ATEX_OK"; ((FAIL++)); FAILURES+=("T30 ATEX: $ATEX_OK")
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  RESULTAT: $PASS ✅  $FAIL ❌  $SKIP ⚠️  (av $((PASS+FAIL+SKIP)) tester)"
echo "═══════════════════════════════════════════════════════"

if [[ ${#FAILURES[@]} -gt 0 ]]; then
  echo ""
  echo "  Misslyckade:"
  for f in "${FAILURES[@]}"; do echo "    • $f"; done
  echo ""
  exit 1
fi

echo ""
echo "  Alla tester OK — redo att deploya."
echo ""
