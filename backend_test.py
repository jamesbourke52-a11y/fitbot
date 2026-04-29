"""
Backend tests for FitLux Admin Dashboard endpoints.
"""
import os
import random
import string
import sys
import json
import requests

BACKEND_URL = "https://fitbot-whatsapp.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

ADMIN_EMAIL = "admin@fitlux.com"
ADMIN_PASSWORD = "Admin@12345"

results = []


def record(step, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((step, status, detail))
    print(f"[{status}] {step}: {detail}")


def rand_str(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def main():
    # ---------------- Login ----------------
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    if r.status_code != 200:
        record("Admin login", False, f"{r.status_code} {r.text}")
        return
    admin_token = r.json()["token"]
    admin_user = r.json()["user"]
    if admin_user.get("role") != "admin":
        record("Admin login", False, f"role={admin_user.get('role')}")
        return
    record("Admin login", True, f"user_id={admin_user['id']} role=admin")
    H = {"Authorization": f"Bearer {admin_token}"}

    # ---------------- 1) Metrics ----------------
    r = requests.get(f"{API}/admin/metrics", headers=H, timeout=30)
    expected_keys = {
        "total_users", "active_subscriptions", "total_revenue_usd",
        "paid_transactions", "promo_codes_total", "promo_codes_active",
        "influencer_signups", "influencer_pending_eur", "influencer_paid_eur",
    }
    if r.status_code != 200:
        record("GET /admin/metrics", False, f"{r.status_code} {r.text}")
    else:
        body = r.json()
        missing = expected_keys - set(body.keys())
        if missing:
            record("GET /admin/metrics", False, f"missing keys: {missing}")
        else:
            ok_types = isinstance(body["total_revenue_usd"], (int, float))
            record("GET /admin/metrics", ok_types,
                   f"revenue={body['total_revenue_usd']} users={body['total_users']} active_subs={body['active_subscriptions']}")

    # ---------------- 2) Create promo code ----------------
    code = "TEST10"
    r = requests.post(f"{API}/admin/promo-codes",
                      headers=H,
                      json={
                          "code": code,
                          "influencer_name": "Test Influencer",
                          "influencer_email": "test_influencer@example.com",
                          "discount_percent": 10,
                          "commission_eur": 1.00,
                      },
                      timeout=30)
    if r.status_code != 200:
        record("POST /admin/promo-codes (TEST10)", False, f"{r.status_code} {r.text}")
        return
    body = r.json()
    influencer_id = body.get("influencer", {}).get("id")
    if not influencer_id:
        record("POST /admin/promo-codes (TEST10)", False, f"no influencer.id: {body}")
        return
    record("POST /admin/promo-codes (TEST10)", True, f"influencer_id={influencer_id}")

    # ---------------- 3) List promo codes - includes TEST10 ----------------
    r = requests.get(f"{API}/admin/promo-codes", headers=H, timeout=30)
    if r.status_code != 200:
        record("GET /admin/promo-codes (after create)", False, f"{r.status_code} {r.text}")
    else:
        codes = [c["code"] for c in r.json().get("codes", [])]
        record("GET /admin/promo-codes (after create)", code in codes, f"codes={codes}")

    # ---------------- 4) PATCH - active false ----------------
    r = requests.patch(f"{API}/admin/promo-codes/{code}",
                       headers=H, json={"active": False}, timeout=30)
    if r.status_code != 200:
        record("PATCH /admin/promo-codes (active=false)", False, f"{r.status_code} {r.text}")
    else:
        pc = r.json().get("promo_code", {})
        record("PATCH /admin/promo-codes (active=false)", pc.get("active") is False, f"active={pc.get('active')}")

    # ---------------- 5) PATCH - active true + discount 15 ----------------
    r = requests.patch(f"{API}/admin/promo-codes/{code}",
                       headers=H, json={"active": True, "discount_percent": 15},
                       timeout=30)
    if r.status_code != 200:
        record("PATCH /admin/promo-codes (active=true, disc=15)", False, f"{r.status_code} {r.text}")
    else:
        pc = r.json().get("promo_code", {})
        ok = pc.get("active") is True and pc.get("discount_percent") == 15
        record("PATCH /admin/promo-codes (active=true, disc=15)", ok,
               f"active={pc.get('active')} disc={pc.get('discount_percent')}")

    # ---------------- 6) Validate promo as authenticated user ----------------
    # Register a fresh user
    fresh_email = f"validuser_{rand_str()}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": fresh_email, "password": "Passw0rd!", "name": "Valid User"},
                      timeout=30)
    if r.status_code != 200:
        record("Register validation user", False, f"{r.status_code} {r.text}")
    else:
        user_token = r.json()["token"]
        UH = {"Authorization": f"Bearer {user_token}"}
        r = requests.post(f"{API}/subscription/promo/validate",
                          headers=UH, json={"code": code}, timeout=30)
        if r.status_code != 200:
            record("POST /subscription/promo/validate", False, f"{r.status_code} {r.text}")
        else:
            j = r.json()
            ok = j.get("valid") is True and j.get("discount_percent") == 15
            record("POST /subscription/promo/validate", ok, f"{j}")

    # ---------------- 7) GET /admin/influencers contains created influencer ----------------
    r = requests.get(f"{API}/admin/influencers", headers=H, timeout=30)
    if r.status_code != 200:
        record("GET /admin/influencers", False, f"{r.status_code} {r.text}")
    else:
        ids = [i.get("id") for i in r.json().get("influencers", [])]
        record("GET /admin/influencers", influencer_id in ids, f"contains influencer_id={influencer_id in ids}")

    # ---------------- 8) Payout - 0 since no earnings ----------------
    r = requests.post(f"{API}/admin/influencers/{influencer_id}/payout",
                      headers=H, timeout=30)
    if r.status_code != 200:
        record("POST /admin/influencers/{id}/payout", False, f"{r.status_code} {r.text}")
    else:
        j = r.json()
        record("POST /admin/influencers/{id}/payout",
               j.get("paid_amount_eur") == 0,
               f"paid_amount_eur={j.get('paid_amount_eur')}")

    # ---------------- 9) GET /admin/influencer-earnings ----------------
    r = requests.get(f"{API}/admin/influencer-earnings", headers=H, timeout=30)
    if r.status_code != 200:
        record("GET /admin/influencer-earnings", False, f"{r.status_code} {r.text}")
    else:
        j = r.json()
        record("GET /admin/influencer-earnings", "earnings" in j and isinstance(j["earnings"], list),
               f"earnings_count={len(j.get('earnings', []))}")

    # ---------------- 10) DELETE /admin/promo-codes/TEST10 ----------------
    r = requests.delete(f"{API}/admin/promo-codes/{code}", headers=H, timeout=30)
    if r.status_code != 200:
        record("DELETE /admin/promo-codes (TEST10)", False, f"{r.status_code} {r.text}")
    else:
        record("DELETE /admin/promo-codes (TEST10)", r.json().get("deleted") is True, f"{r.json()}")

    # ---------------- 11) GET /admin/promo-codes - TEST10 not present ----------------
    r = requests.get(f"{API}/admin/promo-codes", headers=H, timeout=30)
    if r.status_code != 200:
        record("GET /admin/promo-codes (after delete)", False, f"{r.status_code} {r.text}")
    else:
        codes = [c["code"] for c in r.json().get("codes", [])]
        record("GET /admin/promo-codes (after delete)", code not in codes, f"TEST10 absent={code not in codes}")

    # ---------------- 12a) Non-admin → 403 ----------------
    na_email = f"nonadmin_{rand_str()}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": na_email, "password": "Passw0rd!", "name": "NA"},
                      timeout=30)
    if r.status_code != 200:
        record("Register non-admin", False, f"{r.status_code} {r.text}")
    else:
        na_token = r.json()["token"]
        r = requests.get(f"{API}/admin/metrics",
                         headers={"Authorization": f"Bearer {na_token}"}, timeout=30)
        record("Non-admin GET /admin/metrics → 403", r.status_code == 403,
               f"status={r.status_code} body={r.text[:200]}")

    # ---------------- 12b) No auth → 401 ----------------
    r = requests.get(f"{API}/admin/metrics", timeout=30)
    record("No-auth GET /admin/metrics → 401", r.status_code == 401,
           f"status={r.status_code}")

    # ---------------- 12c) PATCH NONEXISTENT → 404 ----------------
    r = requests.patch(f"{API}/admin/promo-codes/NONEXISTENT_{rand_str()}",
                       headers=H, json={"active": False}, timeout=30)
    record("PATCH nonexistent code → 404", r.status_code == 404,
           f"status={r.status_code}")

    # ---------------- 12d) Payout nonexistent influencer → 404 ----------------
    r = requests.post(f"{API}/admin/influencers/nonexistent-id/payout",
                      headers=H, timeout=30)
    record("Payout nonexistent influencer → 404", r.status_code == 404,
           f"status={r.status_code}")


if __name__ == "__main__":
    try:
        main()
    finally:
        print("\n========= SUMMARY =========")
        passed = sum(1 for _, s, _ in results if s == "PASS")
        failed = sum(1 for _, s, _ in results if s == "FAIL")
        for step, status, detail in results:
            print(f"  [{status}] {step}")
        print(f"\nPassed: {passed}, Failed: {failed}")
        sys.exit(0 if failed == 0 else 1)
