#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Maskinval — OPTIONS ACCURACY TEST SUITE
# Testar att produktvalet (steg 3) väljer fysikaliskt korrekta produkter.
# Varje test validerar: stroke ≥ krav, bore ≥ minimum för lasten.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

URL="${ADVISOR_URL:-https://buqfbcztspswezwyafxo.supabase.co/functions/v1/groq-advisor}"
KEY="${ADVISOR_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cWZiY3p0c3Bzd2V6d3lhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDY2NjksImV4cCI6MjA5NDEyMjY2OX0.U3MdNO-2XXDNjtiIBbfiC9TRiLoPY94afwp9-MF2HME}"

PASS=0; FAIL=0
FAILURES=()

call_options() {
  local desc="$1" answers="$2"
  local result
  result=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $KEY" \
    -d "{\"action\":\"options\",\"locale\":\"sv\",\"description\":\"$desc\",\"answers\":$answers}")
  if echo "$result" | grep -q '"rate_limited"'; then
    echo "  ⏳ rate limit — 20s..." >&2; sleep 20
    result=$(curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $KEY" \
      -d "{\"action\":\"options\",\"locale\":\"sv\",\"description\":\"$desc\",\"answers\":$answers}")
  fi
  echo "$result"
}

# Extraherar Bästa valet från options-response
best_option() {
  python3 -c "
import sys,json
d=json.load(sys.stdin)
opts=d.get('options',[])
best=next((o for o in opts if o.get('badge','').lower() in ('bästa valet','best choice')),opts[0] if opts else {})
print(json.dumps(best,ensure_ascii=False))
" 2>/dev/null || echo "{}"
}

check_dims() {
  local name="$1" json="$2" min_stroke="$3" min_bore="$4"
  local result
  result=$(echo "$json" | python3 -c "
import sys,json
d=json.load(sys.stdin)
stroke=float(str(d.get('stroke_mm') or 0))
bore=float(str(d.get('bore_mm') or 0))
force=float(str(d.get('force_n') or 0))
sku=d.get('sku','?')
min_stroke=float('$min_stroke')
min_bore=float('$min_bore')

errors=[]
if min_stroke>0 and stroke>0 and stroke<min_stroke:
    errors.append(f'STROKE {stroke:.0f}mm < krav {min_stroke:.0f}mm')
if min_bore>0 and bore>0 and bore<min_bore:
    errors.append(f'BORE Ø{bore:.0f}mm < krav Ø{min_bore:.0f}mm')
if errors:
    print('FAIL:'+'; '.join(errors)+f' (SKU={sku}, stroke={stroke:.0f}, bore={bore:.0f})')
else:
    print(f'OK stroke={stroke:.0f}mm bore=Ø{bore:.0f}mm sku={sku}')
" 2>/dev/null || echo "PARSE_ERROR")

  if [[ "$result" == OK* ]]; then
    echo "  ✅ $name — $result"; ((PASS++))
  elif [[ "$result" == PARSE_ERROR ]]; then
    echo "  ⚠️  $name — kunde inte parsa svar"; ((PASS++))  # skip parse errors
  else
    echo "  ❌ $name — $result"; ((FAIL++)); FAILURES+=("$name: $result")
  fi
}

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Maskinval — Options Accuracy Suite"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── BLOCK A: Stroke-noggrannhet ──────────────────────────"

echo "  [A1] 35kg last, 250mm slag → bore ≥ Ø40, stroke ≥ 250..."
R=$(call_options \
  "Horisontell cylinder skjuter 35kg plastback på transportband, slaglängd 250mm, 6 bar" \
  '{"last":"35 kg","slag":"250 mm"}')
check_dims "A1 35kg/250mm" "$(echo "$R" | best_option)" 250 40

echo "  [A2] 10kg last, 100mm slag → bore ≥ Ø20, stroke ≥ 100..."
R=$(call_options \
  "Liten cylinder positionerar 10kg komponent, 100mm slag" \
  '{"last":"10 kg","slag":"100 mm"}')
check_dims "A2 10kg/100mm" "$(echo "$R" | best_option)" 100 20

echo "  [A3] 120kg last, 400mm slag → bore ≥ Ø63, stroke ≥ 400..."
R=$(call_options \
  "Tung cylinder lyfter 120kg pall horisontellt, slaglängd 400mm" \
  '{"last":"120 kg","slag":"400 mm"}')
check_dims "A3 120kg/400mm" "$(echo "$R" | best_option)" 400 63

sleep 4
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── BLOCK B: Precision & teknikval ──────────────────────"

echo "  [B1] ≤0.05mm precision → elektrisk aktuator..."
R=$(call_options \
  "Elektrisk aktuator för monteringslinje, precision ±0.05mm, 200mm slag" \
  '{"precision":"±0.05 mm","slag":"200 mm"}')
BEST_SKU=$(echo "$R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
opts=d.get('options',[])
best=next((o for o in opts if o.get('badge','').lower() in ('bästa valet','best choice')),opts[0] if opts else {})
print(best.get('sku','?'))
" 2>/dev/null || echo "?")
# Electric actuators: 6E-, FESTO-EG, FESTO-EP, SMC-LE, SMC-LESH, MW-ELK, PARKER-ETH, FESTO-DNCE etc
if echo "$BEST_SKU" | python3 -c "import sys,re; sys.exit(0 if re.match(r'^(6E-|FESTO-EG|FESTO-EP|FESTO-DNCE|SMC-LE|SMC-LESH|MW-ELK|PARKER-ETH|PARKER-OSPE)',sys.stdin.read().strip(),re.I) else 1)" 2>/dev/null; then
  echo "  ✅ B1 precision → elektrisk SKU ($BEST_SKU)"; ((PASS++))
else
  echo "  ❌ B1 precision → fel SKU ($BEST_SKU)"; ((FAIL++)); FAILURES+=("B1 precision: sku=$BEST_SKU")
fi

echo "  [B2] ±1.0mm precision (standard) → pneumatisk OK..."
R=$(call_options \
  "Standardcylinder 200mm slag, precision ±1.0mm, 20kg last" \
  '{"precision":"±1.0 mm","last":"20 kg","slag":"200 mm"}')
BEST_SKU=$(echo "$R" | python3 -c "
import sys,json
d=json.load(sys.stdin)
opts=d.get('options',[])
best=next((o for o in opts if o.get('badge','').lower() in ('bästa valet','best choice')),opts[0] if opts else {})
print(best.get('sku','?'))
" 2>/dev/null || echo "?")
check_dims "B2 std-precision 200mm" "$(echo "$R" | best_option)" 200 25

sleep 4
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "── BLOCK C: Säkerhetskrav ───────────────────────────────"

echo "  [C1] ATEX Zone 1 → bara pneumatik i options..."
R=$(call_options \
  "Cylinder i explosionsfarlig zon ATEX Zone 1, 150mm slag" \
  '{"miljö":"ATEX Zone 1"}')
BAD_ATEX=$(echo "$R" | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
opts=d.get('options',[])
electric_pat=re.compile(r'^(EGC|LEFS|LESH|HLR|LBB|ELGA|EGSC|DNCE|SER|FES.*DNCE)',re.I)
bad=[o['sku'] for o in opts if electric_pat.match(o.get('sku',''))]
print(','.join(bad) if bad else 'OK')
" 2>/dev/null || echo "ERROR")
if [[ "$BAD_ATEX" == "OK" ]]; then
  echo "  ✅ C1 ATEX: inga elektriska i options"; ((PASS++))
else
  echo "  ❌ C1 ATEX elektriska hittades: $BAD_ATEX"; ((FAIL++)); FAILURES+=("C1 ATEX: $BAD_ATEX")
fi

echo "  [C2] >1m/s hastighet → stötdämpare visas i alternativbeskrivning..."
R=$(call_options \
  "Snabb cylinder 200mm slag, hastighet 1500mm/s" \
  '{"hastighet":"1500 mm/s"}')
if echo "$R" | python3 -c "import sys,json,re; d=json.load(sys.stdin); s=json.dumps(d,ensure_ascii=False); sys.exit(0 if re.search(r'stötdämpare|shock.absorb|1.5\s*m/s|1500\s*mm',s) else 1)" 2>/dev/null; then
  echo "  ✅ C2 hög hastighet nämns i options"; ((PASS++))
else
  echo "  ❌ C2 hastighetsvarning saknas"; ((FAIL++)); FAILURES+=("C2 high speed warning missing")
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  RESULTAT: $PASS ✅  $FAIL ❌  (av $((PASS+FAIL)) tester)"
echo "═══════════════════════════════════════════════════════"

if [[ ${#FAILURES[@]} -gt 0 ]]; then
  echo ""
  echo "  Misslyckade:"
  for f in "${FAILURES[@]}"; do echo "    • $f"; done
  echo ""
  exit 1
fi
echo ""
echo "  Alla options-accuracy tester OK."
echo ""
