#!/usr/bin/env python3
"""
test-customer-flows.py — exercises the REAL logged-in customer (and, if
configured, admin) experience end to end: RLS-scoped visibility, the
status-inquiry thread (rfq-status-request + get_rfq_status_log), and
claims. This is the "eval-invariants.py" idea applied to the account-gated
flows — order visibility, the reklamation flow, admin-vs-customer RLS
scoping — none of which could be exercised before, because doing so needs
a real logged-in session, and Claude Code will not create accounts or
handle passwords (see CLAUDE.md).

Needs two things configured once, by a human, never by an automated agent:
  TEST_CUSTOMER_EMAIL / TEST_CUSTOMER_PASSWORD  — a real throwaway customer
                                                    account (sign up normally)
  TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD        — (optional) a second account
                                                    with the admin role

Each half is SKIPPED (not failed) when its pair of env vars isn't set, so
this is safe to land and run before both accounts exist — set one, get one
half of the coverage; set both, get all of it.

Usage: python3 scripts/test-customer-flows.py
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://buqfbcztspswezwyafxo.supabase.co")
ANON_KEY = os.environ.get(
    "ADVISOR_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cWZiY3p0c3Bzd2V6d3lhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDY2NjksImV4cCI6MjA5NDEyMjY2OX0.U3MdNO-2XXDNjtiIBbfiC9TRiLoPY94afwp9-MF2HME",
)
REST = f"{SUPABASE_URL}/rest/v1"
AUTH = f"{SUPABASE_URL}/auth/v1"
FUNCTIONS = f"{SUPABASE_URL}/functions/v1"

PASS = 0
FAIL = 0
FAILURES: list[tuple[str, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        FAILURES.append((name, detail))
        print(f"  ❌ {name}: {detail}")


def sign_in(email: str, password: str) -> tuple[str | None, str | None]:
    cmd = [
        "curl", "-s", "-X", "POST", f"{AUTH}/token?grant_type=password",
        "-H", f"apikey: {ANON_KEY}", "-H", "Content-Type: application/json",
        "-d", json.dumps({"email": email, "password": password}),
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=15).stdout
    try:
        data = json.loads(out)
    except Exception:
        return None, None
    return data.get("access_token"), (data.get("user") or {}).get("id")


def rest(method: str, path: str, token: str, body=None, extra_headers=None):
    headers = [
        "-H", f"apikey: {ANON_KEY}",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Content-Type: application/json",
    ]
    for h in extra_headers or []:
        headers += ["-H", h]
    cmd = ["curl", "-s", "-X", method, f"{REST}/{path}"] + headers
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=15).stdout
    try:
        return json.loads(out)
    except Exception:
        return out


def call_function(name: str, token: str, body: dict) -> tuple[str, int]:
    cmd = [
        "curl", "-s", "-o", "/dev/stderr", "-w", "%{http_code}",
        "-X", "POST", f"{FUNCTIONS}/{name}",
        "-H", f"Authorization: Bearer {token}", "-H", "Content-Type: application/json",
        "-d", json.dumps(body),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
    status = int(result.stdout.strip() or "0")
    return result.stderr, status


def run_customer_checks(email: str, password: str) -> None:
    print("\n── Customer flow ─" * 3)
    token, user_id = sign_in(email, password)
    if not token:
        check("customer sign-in", False, "no access_token returned — check TEST_CUSTOMER_EMAIL/PASSWORD")
        return
    check("customer sign-in", True)

    orders = rest("GET", "orders?select=id,user_id&limit=5", token)
    check("orders: readable (own rows)", isinstance(orders, list), str(orders)[:200])

    rfqs = rest("GET", "rfqs?select=id,user_id&limit=5", token)
    check("rfqs: readable (own rows)", isinstance(rfqs, list), str(rfqs)[:200])

    stamp = datetime.now(timezone.utc).isoformat()
    created = rest(
        "POST", "rfqs", token,
        body={"user_id": user_id, "status": "processing", "title": f"[TEST] flow check {stamp}", "contact_email": email},
        extra_headers=["Prefer: return=representation"],
    )
    rfq_id = created[0]["id"] if isinstance(created, list) and created else None
    check("rfqs: can create own row", bool(rfq_id), str(created)[:200])

    if rfq_id:
        _, status = call_function("rfq-status-request", token, {"rfq_id": rfq_id, "note": "automated test"})
        check("rfq-status-request: accepts owned rfq_id", status == 200, f"http {status}")

        log = rest("POST", "rpc/get_rfq_status_log", token, body={"p_rfq_id": rfq_id})
        has_entry = isinstance(log, list) and any("automated test" in (row.get("message") or "") for row in log)
        check("get_rfq_status_log: sees own request", has_entry, str(log)[:200])

        # Cross-account isolation: an rfq_id this customer does NOT own must
        # be rejected outright, not silently accepted or leaked.
        _, status2 = call_function("rfq-status-request", token, {"rfq_id": "00000000-0000-0000-0000-000000000000"})
        check("rfq-status-request: rejects non-owned rfq_id", status2 in (403, 404), f"http {status2}")

    claim = rest(
        "POST", "claims", token,
        body={"user_id": user_id, "title": "[TEST] automated flow check", "description": "Created by test-customer-flows.py", "urgency": "low"},
        extra_headers=["Prefer: return=representation"],
    )
    check("claims: can create own row", isinstance(claim, list) and len(claim) > 0, str(claim)[:200])

    my_claims = rest("GET", "claims?select=id,title&order=created_at.desc&limit=5", token)
    check("claims: readable (own rows)", isinstance(my_claims, list), str(my_claims)[:200])


def run_admin_checks(email: str, password: str) -> None:
    print("\n── Admin flow ─" * 3)
    token, admin_id = sign_in(email, password)
    if not token:
        check("admin sign-in", False, "no access_token returned — check TEST_ADMIN_EMAIL/PASSWORD")
        return
    check("admin sign-in", True)

    # The whole point of the RLS fixes shipped alongside this script: admin
    # must see rows belonging to OTHER users, not just their own.
    all_claims = rest("GET", "claims?select=id,user_id&limit=20", token)
    check("claims: admin query succeeds (not RLS-blocked)", isinstance(all_claims, list), str(all_claims)[:200])
    if isinstance(all_claims, list) and all_claims:
        sees_others = any(c.get("user_id") != admin_id for c in all_claims)
        check("claims: admin sees rows from other users", sees_others, str(all_claims)[:200])

    all_orders = rest("GET", "orders?select=id,user_id&limit=20", token)
    check("orders: admin query succeeds (not RLS-blocked)", isinstance(all_orders, list), str(all_orders)[:200])

    all_logs = rest("GET", "rfq_status_log?select=id&limit=1", token)
    check(
        "rfq_status_log: admin table access works (not the old public-read hole)",
        isinstance(all_logs, list),
        str(all_logs)[:200],
    )


def main() -> bool:
    print("═" * 60)
    print(f"  Maskinval — Customer/Admin Flow Eval  |  {datetime.now():%Y-%m-%d %H:%M:%S}")
    print("═" * 60)

    c_email, c_pass = os.environ.get("TEST_CUSTOMER_EMAIL"), os.environ.get("TEST_CUSTOMER_PASSWORD")
    a_email, a_pass = os.environ.get("TEST_ADMIN_EMAIL"), os.environ.get("TEST_ADMIN_PASSWORD")

    if c_email and c_pass:
        run_customer_checks(c_email, c_pass)
    else:
        print("\n⏭️  Skipping customer flow — TEST_CUSTOMER_EMAIL/TEST_CUSTOMER_PASSWORD not set")

    if a_email and a_pass:
        run_admin_checks(a_email, a_pass)
    else:
        print("\n⏭️  Skipping admin flow — TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD not set")

    print("\n" + "═" * 60)
    print(f"  RESULTAT: {PASS} ✅  {FAIL} ❌")
    print("═" * 60)
    if FAILURES:
        print("\n  MISSLYCKADE:")
        for name, detail in FAILURES:
            print(f"    • {name}: {detail}")
        return False
    if PASS == 0:
        print("\n  ⚠️  Nothing ran — no test credentials configured. See the file header for setup.")
    return True


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
