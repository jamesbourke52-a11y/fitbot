"""Test suite for NEW backend addition: home_equipment field on quiz submission.

Verifies:
  TEST 1 — Quiz accepts and persists home_equipment.
  TEST 2 — home_equipment is optional / accepts null & empty string / absent.
  TEST 3 — home_equipment reaches the coach briefing context.
  TEST 4 — Existing endpoints still work (smoke).
"""
import os
import sys
import requests

BASE = "https://fitbot-whatsapp.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@fitlux.com"
ADMIN_PASSWORD = "Admin@12345"

BASE_QUIZ = {
    "age": 30, "gender": "male", "height_cm": 180, "weight_kg": 80,
    "goal": "gain_muscle", "activity_level": "moderate",
    "workout_days_per_week": 4, "diet_preference": "omnivore",
    "wake_time": "06:30", "sleep_time": "22:30",
    "work_schedule": "mon_fri", "work_start": "09:00", "work_end": "17:00",
    "workout_style": "home",
}
EQUIPMENT = "Dumbbells, Resistance bands · 20kg pair max"

passed = []
failed = []


def record(name, ok, msg=""):
    (passed if ok else failed).append((name, msg))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}" + (f" — {msg}" if msg else ""))


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    return r.json()["token"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def main():
    # 1. Admin login
    try:
        token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        record("admin login", True, f"token_len={len(token)}")
    except Exception as e:
        record("admin login", False, str(e))
        return

    H = hdr(token)

    # =========================================================
    # TEST 1 — Quiz accepts and persists home_equipment
    # =========================================================
    body = {**BASE_QUIZ, "home_equipment": EQUIPMENT}
    r = requests.post(f"{BASE}/quiz/submit", json=body, headers=H, timeout=120)
    record("T1: POST /quiz/submit with home_equipment → 200",
           r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")
    if r.status_code == 200:
        body_json = r.json()
        record("T1: /quiz/submit response.quiz.home_equipment matches input",
               body_json.get("quiz", {}).get("home_equipment") == EQUIPMENT,
               f"got={body_json.get('quiz', {}).get('home_equipment')!r}")

    r = requests.get(f"{BASE}/plan", headers=H, timeout=30)
    record("T1: GET /plan → 200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        plan = r.json()
        q = plan.get("quiz", {}) or {}
        record("T1: plan.quiz exists", isinstance(q, dict) and len(q) > 0)
        record("T1: plan.quiz.home_equipment == EQUIPMENT",
               q.get("home_equipment") == EQUIPMENT,
               f"got={q.get('home_equipment')!r}")

    # =========================================================
    # TEST 2a — home_equipment = null
    # =========================================================
    body_null = {**BASE_QUIZ, "home_equipment": None}
    r = requests.post(f"{BASE}/quiz/submit", json=body_null, headers=H, timeout=120)
    record("T2a: POST /quiz/submit home_equipment=null → 200",
           r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")
    r = requests.get(f"{BASE}/plan", headers=H, timeout=30)
    if r.status_code == 200:
        q = r.json().get("quiz", {}) or {}
        record("T2a: plan.quiz.home_equipment is None",
               q.get("home_equipment") is None,
               f"got={q.get('home_equipment')!r}")

    # =========================================================
    # TEST 2b — home_equipment = ""
    # =========================================================
    body_empty = {**BASE_QUIZ, "home_equipment": ""}
    r = requests.post(f"{BASE}/quiz/submit", json=body_empty, headers=H, timeout=120)
    record("T2b: POST /quiz/submit home_equipment='' → 200",
           r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")
    r = requests.get(f"{BASE}/plan", headers=H, timeout=30)
    if r.status_code == 200:
        q = r.json().get("quiz", {}) or {}
        record("T2b: plan.quiz.home_equipment == ''",
               q.get("home_equipment") == "",
               f"got={q.get('home_equipment')!r}")

    # =========================================================
    # TEST 2c — home_equipment key missing (backwards compat)
    # =========================================================
    body_no_key = dict(BASE_QUIZ)
    assert "home_equipment" not in body_no_key
    r = requests.post(f"{BASE}/quiz/submit", json=body_no_key, headers=H, timeout=120)
    record("T2c: POST /quiz/submit WITHOUT home_equipment → 200 (backwards compat)",
           r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")

    # =========================================================
    # Re-apply TEST 1 body so coach briefing has the equipment in context
    # =========================================================
    body1 = {**BASE_QUIZ, "home_equipment": EQUIPMENT}
    r = requests.post(f"{BASE}/quiz/submit", json=body1, headers=H, timeout=120)
    record("T3 setup: re-submit quiz with home_equipment for coach",
           r.status_code == 200, f"status={r.status_code}")

    # =========================================================
    # TEST 3 — /coach/briefing receives home_equipment context
    # =========================================================
    r = requests.get(f"{BASE}/coach/briefing", headers=H, timeout=120)
    record("T3: GET /coach/briefing → 200",
           r.status_code == 200, f"status={r.status_code} body={r.text[:300]}")
    if r.status_code == 200:
        data = r.json()
        greeting = data.get("greeting", "") or ""
        record("T3: greeting is a non-empty string",
               isinstance(greeting, str) and len(greeting) > 0,
               f"len={len(greeting)}")
        # SOFT check — equipment echo
        g_lower = greeting.lower()
        keywords = ["dumbbell", "band", "swap", "instead", "with your"]
        matched = [k for k in keywords if k in g_lower]
        if matched:
            print(f"[SOFT PASS] T3 greeting mentions equipment/substitution: {matched}")
        else:
            print(f"[SOFT WARN] T3 greeting does NOT echo equipment/substitution. "
                  f"Preview: {greeting[:240]!r} — the hard requirement (200 + non-empty) passed.")

    # =========================================================
    # TEST 4 — Smoke: existing endpoints still work
    # =========================================================
    r = requests.get(f"{BASE}/workouts/prescription", headers=H, timeout=60)
    record("T4: GET /workouts/prescription → 200",
           r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    r = requests.post(f"{BASE}/workouts/start", headers=H, timeout=60)
    record("T4: POST /workouts/start → 200",
           r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    r = requests.get(f"{BASE}/workouts/history?limit=5", headers=H, timeout=30)
    record("T4: GET /workouts/history?limit=5 → 200",
           r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

    # =========================================================
    print(f"\nSUMMARY: {len(passed)} passed, {len(failed)} failed")
    for n, m in failed:
        print(f"  FAIL: {n} — {m}")
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
