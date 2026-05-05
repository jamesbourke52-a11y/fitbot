"""
Backend test suite for new session-5 additions:
  1) Prescription enrichment (thumb + demo_url on every key_lift / accessory)
  2) POST /api/workouts/exercise-log with replace-not-duplicate semantics + validation
  3) GET /api/workouts/session/{id}

Auth: admin@fitlux.com / Admin@12345  (admin always passes require_active_subscription).
"""
import os
import sys
import requests

BASE = "https://fitbot-whatsapp.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@fitlux.com"
ADMIN_PASS = "Admin@12345"

PASS = []
FAIL = []


def log_pass(name):
    PASS.append(name)
    print(f"  PASS  {name}")


def log_fail(name, info=""):
    FAIL.append(f"{name} :: {info}")
    print(f"  FAIL  {name}  ::  {info}")


def hdr(tok=None):
    h = {"Content-Type": "application/json"}
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


def login_admin():
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    r.raise_for_status()
    j = r.json()
    return j["token"], j["user"]


def submit_quiz(token, style: str):
    body = {
        "age": 30, "gender": "male", "height_cm": 178, "weight_kg": 78,
        "goal": "gain_muscle", "activity_level": "moderate",
        "workout_days_per_week": 4, "diet_preference": "omnivore",
        "wake_time": "06:30", "sleep_time": "22:30",
        "work_schedule": "mon_fri", "work_start": "09:00", "work_end": "17:00",
        "workout_style": style,
    }
    r = requests.post(f"{BASE}/quiz/submit", json=body, headers=hdr(token), timeout=120)
    return r


def get_prescription(token):
    r = requests.get(f"{BASE}/workouts/prescription", headers=hdr(token), timeout=30)
    return r


# ============================================================================
# TEST 1 — Prescription enrichment
# ============================================================================
def test1_prescription_enrichment(token):
    print("\n=== TEST 1: Prescription enrichment (thumb + demo_url) ===")

    for style in ["gym", "calisthenics", "home"]:
        print(f"\n-- style={style}")
        rq = submit_quiz(token, style)
        if rq.status_code == 402:
            print(f"  quiz/submit returned 402 (subscription) — proceeding with current plan style")
        elif rq.status_code != 200:
            log_fail(f"quiz/submit({style})", f"status={rq.status_code} body={rq.text[:200]}")
            continue
        else:
            log_pass(f"quiz/submit({style}) -> 200")

        rp = get_prescription(token)
        if rp.status_code != 200:
            log_fail(f"GET prescription ({style})", f"status={rp.status_code}")
            continue
        log_pass(f"GET prescription ({style}) -> 200")
        p = rp.json().get("prescription", {})
        actual_style = p.get("style") or rp.json().get("style")
        key_lifts = p.get("key_lifts", [])
        accessories = p.get("accessories", [])

        if not key_lifts:
            log_fail(f"{style}: key_lifts empty")
            continue
        if not accessories:
            log_fail(f"{style}: accessories empty")

        # Every key_lift has thumb + demo_url
        all_lift_thumb = all(isinstance(l.get("thumb"), str) and l["thumb"].startswith("http") for l in key_lifts)
        all_lift_demo = all(
            isinstance(l.get("demo_url"), str)
            and l["demo_url"].startswith("https://www.youtube.com/results?search_query=")
            for l in key_lifts
        )
        all_acc_thumb = all(isinstance(a.get("thumb"), str) and a["thumb"].startswith("http") for a in accessories)
        all_acc_demo = all(
            isinstance(a.get("demo_url"), str)
            and a["demo_url"].startswith("https://www.youtube.com/results?search_query=")
            for a in accessories
        )

        if all_lift_thumb:
            log_pass(f"{style}: every key_lift has http thumb")
        else:
            bad = [l.get("name") for l in key_lifts if not (isinstance(l.get("thumb"), str) and l["thumb"].startswith("http"))]
            log_fail(f"{style}: missing thumb on key_lifts", str(bad))

        if all_lift_demo:
            log_pass(f"{style}: every key_lift has youtube demo_url")
        else:
            bad = [l.get("name") for l in key_lifts if not (isinstance(l.get("demo_url"), str) and l["demo_url"].startswith("https://www.youtube.com/results?search_query="))]
            log_fail(f"{style}: missing demo_url on key_lifts", str(bad))

        if accessories:
            if all_acc_thumb:
                log_pass(f"{style}: every accessory has http thumb")
            else:
                log_fail(f"{style}: missing thumb on accessories")
            if all_acc_demo:
                log_pass(f"{style}: every accessory has youtube demo_url")
            else:
                log_fail(f"{style}: missing demo_url on accessories")

        # Style-specific
        if style == "calisthenics":
            all_bw = all(l.get("bodyweight") is True for l in key_lifts)
            if all_bw:
                log_pass("calisthenics: every key_lift bodyweight=true")
            else:
                bad = [l.get("name") for l in key_lifts if l.get("bodyweight") is not True]
                log_fail("calisthenics: not all key_lifts bodyweight=true", str(bad))
        elif style == "home":
            has_wd = all(l.get("weight_display") is not None for l in key_lifts)
            if has_wd:
                log_pass("home: every key_lift has weight_display")
            else:
                bad = [l.get("name") for l in key_lifts if l.get("weight_display") is None]
                log_fail("home: missing weight_display", str(bad))


# ============================================================================
# TEST 2 — POST /api/workouts/exercise-log
# ============================================================================
def test2_exercise_log(token):
    print("\n=== TEST 2: /api/workouts/exercise-log ===")

    # a) Start session
    r = requests.post(f"{BASE}/workouts/start", headers=hdr(token), timeout=30)
    if r.status_code != 200:
        log_fail("workouts/start", f"status={r.status_code}")
        return None
    sid = r.json().get("session_id")
    if not sid:
        log_fail("workouts/start: no session_id")
        return None
    log_pass(f"workouts/start -> {sid[:8]}...")

    # b) Log first exercise
    payload1 = {
        "session_id": sid, "exercise_id": "bench", "exercise_name": "Bench press",
        "completed": True, "form_rating": 4, "difficulty": "just_right",
        "sets_done": 3, "reps_done": 5,
    }
    r = requests.post(f"{BASE}/workouts/exercise-log", json=payload1, headers=hdr(token), timeout=30)
    if r.status_code != 200:
        log_fail("exercise-log first POST", f"status={r.status_code} body={r.text[:200]}")
        return sid
    j = r.json()
    entry = j.get("entry") or {}
    log = j.get("exercises_log") or []
    if (entry.get("exercise_id") == "bench" and entry.get("exercise_name") == "Bench press"
            and entry.get("form_rating") == 4 and entry.get("difficulty") == "just_right"
            and entry.get("sets_done") == 3 and entry.get("reps_done") == 5):
        log_pass("exercise-log: entry matches input")
    else:
        log_fail("exercise-log: entry mismatch", str(entry))
    if len(log) == 1:
        log_pass("exercise-log: exercises_log has 1 entry")
    else:
        log_fail("exercise-log: exercises_log length != 1", f"got {len(log)}")

    # c) Replace same exercise with form_rating=5
    payload1b = dict(payload1)
    payload1b["form_rating"] = 5
    r = requests.post(f"{BASE}/workouts/exercise-log", json=payload1b, headers=hdr(token), timeout=30)
    if r.status_code != 200:
        log_fail("exercise-log replace POST", f"status={r.status_code}")
    else:
        log = r.json().get("exercises_log") or []
        if len(log) == 1:
            log_pass("exercise-log: replace not duplicate (length still 1)")
        else:
            log_fail("exercise-log: replaced log length != 1", f"got {len(log)}")
        # Find the bench entry
        bench = next((e for e in log if e.get("exercise_id") == "bench"), None)
        if bench and bench.get("form_rating") == 5:
            log_pass("exercise-log: form_rating updated to 5")
        else:
            log_fail("exercise-log: form_rating not updated", str(bench))

    # d) Add second exercise
    payload2 = {
        "session_id": sid, "exercise_id": "squat", "exercise_name": "Back squat",
        "completed": True, "form_rating": 3, "difficulty": "too_hard",
        "sets_done": 4, "reps_done": 5,
    }
    r = requests.post(f"{BASE}/workouts/exercise-log", json=payload2, headers=hdr(token), timeout=30)
    if r.status_code != 200:
        log_fail("exercise-log second POST", f"status={r.status_code}")
    else:
        log = r.json().get("exercises_log") or []
        if len(log) == 2:
            log_pass("exercise-log: second exercise -> length 2")
        else:
            log_fail("exercise-log: length != 2 after second POST", f"got {len(log)}")

    # e) Validation
    # form_rating = 0 → 400
    r = requests.post(f"{BASE}/workouts/exercise-log",
                      json={**payload1, "form_rating": 0},
                      headers=hdr(token), timeout=30)
    if r.status_code == 400:
        log_pass("validation: form_rating=0 -> 400")
    else:
        log_fail("validation: form_rating=0", f"status={r.status_code}")

    # form_rating = 6 → 400
    r = requests.post(f"{BASE}/workouts/exercise-log",
                      json={**payload1, "form_rating": 6},
                      headers=hdr(token), timeout=30)
    if r.status_code == 400:
        log_pass("validation: form_rating=6 -> 400")
    else:
        log_fail("validation: form_rating=6", f"status={r.status_code}")

    # difficulty = medium → 400
    r = requests.post(f"{BASE}/workouts/exercise-log",
                      json={**payload1, "difficulty": "medium"},
                      headers=hdr(token), timeout=30)
    if r.status_code == 400:
        log_pass("validation: difficulty=medium -> 400")
    else:
        log_fail("validation: difficulty=medium", f"status={r.status_code}")

    # session_id = bogus → 404
    r = requests.post(f"{BASE}/workouts/exercise-log",
                      json={**payload1, "session_id": "bogus-id-123"},
                      headers=hdr(token), timeout=30)
    if r.status_code == 404:
        log_pass("validation: bogus session_id -> 404")
    else:
        log_fail("validation: bogus session_id", f"status={r.status_code}")

    # f) No-auth → 401
    r = requests.post(f"{BASE}/workouts/exercise-log",
                      json=payload1, headers={"Content-Type": "application/json"}, timeout=30)
    if r.status_code == 401:
        log_pass("auth: no-auth -> 401")
    else:
        log_fail("auth: no-auth", f"status={r.status_code}")

    return sid


# ============================================================================
# TEST 3 — GET /api/workouts/session/{id}
# ============================================================================
def test3_session_get(token, sid):
    print("\n=== TEST 3: GET /api/workouts/session/{id} ===")
    if not sid:
        log_fail("session_get: no sid available", "")
        return

    r = requests.get(f"{BASE}/workouts/session/{sid}", headers=hdr(token), timeout=30)
    if r.status_code != 200:
        log_fail("session_get valid -> 200", f"status={r.status_code}")
    else:
        j = r.json()
        log = j.get("exercises_log") or []
        if len(log) >= 2:
            log_pass(f"session_get: returns 200 with {len(log)} exercises_log entries")
        else:
            log_fail("session_get: exercises_log too short", f"got {len(log)}")
        ids = sorted([e.get("exercise_id") for e in log])
        if "bench" in ids and "squat" in ids:
            log_pass("session_get: contains bench + squat entries")
        else:
            log_fail("session_get: missing expected entries", str(ids))

    r = requests.get(f"{BASE}/workouts/session/invalid-uuid", headers=hdr(token), timeout=30)
    if r.status_code == 404:
        log_pass("session_get invalid -> 404")
    else:
        log_fail("session_get invalid", f"status={r.status_code}")

    r = requests.get(f"{BASE}/workouts/session/{sid}", timeout=30)
    if r.status_code == 401:
        log_pass("session_get no-auth -> 401")
    else:
        log_fail("session_get no-auth", f"status={r.status_code}")


# ============================================================================
def main():
    print(f"Backend: {BASE}")
    token, _ = login_admin()
    print(f"Admin token acquired ({token[:18]}...)")

    test1_prescription_enrichment(token)
    sid = test2_exercise_log(token)
    test3_session_get(token, sid)

    print("\n" + "=" * 60)
    print(f"PASSED: {len(PASS)}")
    print(f"FAILED: {len(FAIL)}")
    if FAIL:
        print("\nFailures:")
        for f in FAIL:
            print(f"  - {f}")
        sys.exit(1)
    else:
        print("All assertions passed.")
        sys.exit(0)


if __name__ == "__main__":
    main()
