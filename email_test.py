"""
Backend tests for FitLux Email drip + transactional infrastructure (Resend wrapper).

Scenario: RESEND_API_KEY is intentionally EMPTY — all sends should be no-op.
"""
import os
import random
import string
import sys
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
    # ------------- Admin login -------------
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    if r.status_code != 200:
        record("Admin login", False, f"{r.status_code} {r.text}")
        return
    admin_token = r.json()["token"]
    admin_user = r.json()["user"]
    record("Admin login", admin_user.get("role") == "admin",
           f"user_id={admin_user['id']} role={admin_user.get('role')}")
    H_ADMIN = {"Authorization": f"Bearer {admin_token}"}

    # ------------- 1) POST /api/auth/register fresh user -------------
    fresh_email = f"emailtest_{rand_str()}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": fresh_email, "password": "Test1234!", "name": "Email Test"},
                      timeout=30)
    ok = (r.status_code == 200 and "token" in r.json() and "user" in r.json())
    user_token = None
    fresh_user_id = None
    if ok:
        user_token = r.json()["token"]
        fresh_user_id = r.json()["user"]["id"]
    record("1) POST /api/auth/register (fresh user, email disabled)", ok,
           f"status={r.status_code} email={fresh_email} has_token={bool(user_token)} user_id={fresh_user_id}")

    # ------------- 2) GET /api/admin/email-log as admin -------------
    r = requests.get(f"{API}/admin/email-log", headers=H_ADMIN, timeout=30)
    if r.status_code != 200:
        record("2) GET /api/admin/email-log (admin)", False, f"{r.status_code} {r.text[:300]}")
    else:
        body = r.json()
        has_shape = (isinstance(body.get("log"), list)
                     and isinstance(body.get("totals_by_kind"), dict))
        # Per spec, with empty key sends are no-op, so log and totals should both be empty.
        empty = (len(body.get("log", [])) == 0 and len(body.get("totals_by_kind", {})) == 0)
        record("2) GET /api/admin/email-log (admin)", has_shape and empty,
               f"status=200 log_len={len(body.get('log', []))} totals={body.get('totals_by_kind')}")

    # ------------- 3) POST /api/admin/email-drip-now as admin -------------
    r = requests.post(f"{API}/admin/email-drip-now", headers=H_ADMIN, timeout=30)
    if r.status_code != 200:
        record("3) POST /api/admin/email-drip-now (admin)", False,
               f"{r.status_code} {r.text[:300]}")
    else:
        body = r.json()
        ok = (body.get("skipped") is True
              and body.get("reason") == "RESEND_API_KEY not set")
        record("3) POST /api/admin/email-drip-now (admin)", ok, f"body={body}")

    # ------------- 4) POST /api/admin/email-drip-now as non-admin → 403 -------------
    if user_token:
        r = requests.post(f"{API}/admin/email-drip-now",
                          headers={"Authorization": f"Bearer {user_token}"}, timeout=30)
        record("4) POST /api/admin/email-drip-now (non-admin) → 403",
               r.status_code == 403,
               f"status={r.status_code} body={r.text[:200]}")
    else:
        record("4) POST /api/admin/email-drip-now (non-admin) → 403", False,
               "skipped — no non-admin token available")

    # ------------- 5) GET /api/email/unsubscribe with invalid token → 400 -------------
    r = requests.get(f"{API}/email/unsubscribe", params={"u": "fake", "t": "invalid"},
                     timeout=30)
    if r.status_code != 400:
        record("5) GET /api/email/unsubscribe (invalid token) → 400", False,
               f"status={r.status_code} body={r.text[:300]}")
    else:
        body = r.json()
        record("5) GET /api/email/unsubscribe (invalid token) → 400",
               body.get("detail") == "Invalid unsubscribe link",
               f"body={body}")

    # ------------- 6) GET /api/email/unsubscribe missing query params → 422 -------------
    r = requests.get(f"{API}/email/unsubscribe", timeout=30)
    record("6) GET /api/email/unsubscribe (no params) → 422",
           r.status_code == 422,
           f"status={r.status_code}")

    # ------------- 7) Backend startup log contains 'email drip loop started' -------------
    try:
        log_path_err = "/var/log/supervisor/backend.err.log"
        log_path_out = "/var/log/supervisor/backend.out.log"
        found = False
        for p in (log_path_err, log_path_out):
            if os.path.exists(p):
                with open(p) as fp:
                    if "email drip loop started" in fp.read():
                        found = True
                        break
        record("7) Backend log contains 'email drip loop started'", found,
               "found in backend.err.log" if found else "NOT FOUND")
    except Exception as e:
        record("7) Backend log contains 'email drip loop started'", False, f"err={e}")

    # ------------- 8) Re-verify admin smoke-test endpoints -------------
    r = requests.get(f"{API}/admin/metrics", headers=H_ADMIN, timeout=30)
    record("8a) GET /api/admin/metrics", r.status_code == 200,
           f"status={r.status_code}")

    r = requests.get(f"{API}/admin/promo-codes", headers=H_ADMIN, timeout=30)
    record("8b) GET /api/admin/promo-codes", r.status_code == 200,
           f"status={r.status_code}")

    r = requests.get(f"{API}/admin/influencers", headers=H_ADMIN, timeout=30)
    record("8c) GET /api/admin/influencers", r.status_code == 200,
           f"status={r.status_code}")

    r = requests.get(f"{API}/admin/influencer-earnings", headers=H_ADMIN, timeout=30)
    record("8d) GET /api/admin/influencer-earnings", r.status_code == 200,
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
