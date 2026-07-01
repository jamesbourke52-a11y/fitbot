"""
Backend test suite for:
  1) POST /api/coach/review-session/{session_id}  (NEW — AI session review)
  2) GET  /api/progress/share-card/{days}         (ENRICHED with new stats)

Uses the public REACT_APP_BACKEND_URL from /app/frontend/.env
(EXPO_PUBLIC_BACKEND_URL is the mobile equivalent).
Auth: admin@fitlux.com / Admin@12345
"""
import os
import sys
import time
import json
import requests

BASE = "https://fitbot-whatsapp.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@fitlux.com"
ADMIN_PASS = "Admin@12345"

PASS = []
FAIL = []


def _ok(desc):
    PASS.append(desc)
    print(f"  ✓ {desc}")


def _fail(desc, extra=None):
    FAIL.append((desc, extra))
    print(f"  ✗ {desc}")
    if extra:
        print(f"      {extra}")


def assert_true(cond, desc, extra=None):
    if cond:
        _ok(desc)
    else:
        _fail(desc, extra)


def login_admin():
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
                      timeout=30)
    r.raise_for_status()
    data = r.json()
    return data["token"]


def h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- TEST 1 ----------------
def test_review_session(token):
    print("\n=== TEST 1 — POST /api/coach/review-session/{id} ===")

    # 1) start session
    r = requests.post(f"{BASE}/workouts/start", headers=h(token), timeout=30)
    assert_true(r.status_code == 200,
                f"POST /workouts/start → 200 (got {r.status_code})",
                r.text[:200])
    if r.status_code != 200:
        return
    sid = r.json()["session_id"]

    # 2-4) log 3 exercises
    exercises = [
        {"session_id": sid, "exercise_id": "bench",
         "exercise_name": "Bench press", "completed": True,
         "form_rating": 5, "difficulty": "just_right",
         "sets_done": 3, "reps_done": 5},
        {"session_id": sid, "exercise_id": "squat",
         "exercise_name": "Back squat", "completed": True,
         "form_rating": 2, "difficulty": "too_hard",
         "sets_done": 2, "reps_done": 3},
        {"session_id": sid, "exercise_id": "row",
         "exercise_name": "Row", "completed": True,
         "form_rating": 4, "difficulty": "too_easy"},
    ]
    for ex in exercises:
        r = requests.post(f"{BASE}/workouts/exercise-log",
                          headers=h(token), json=ex, timeout=30)
        assert_true(r.status_code == 200,
                    f"POST /workouts/exercise-log ({ex['exercise_id']}) → 200 "
                    f"(got {r.status_code})", r.text[:200])

    # 5) call review-session
    r = requests.post(f"{BASE}/coach/review-session/{sid}",
                      headers=h(token), timeout=90)
    assert_true(r.status_code == 200,
                f"POST /coach/review-session/<id> → 200 (got {r.status_code})",
                r.text[:300])
    if r.status_code != 200:
        return
    data = r.json()
    review = data.get("review", "")
    stats = data.get("stats", {})
    assert_true(isinstance(review, str) and len(review) > 0,
                f"review is non-empty string (len={len(review)})")
    assert_true(data.get("session_id") == sid,
                f"session_id matches (got {data.get('session_id')})")
    assert_true(stats.get("count") == 3,
                f"stats.count == 3 (got {stats.get('count')})")
    form_avg = stats.get("form_avg", 0)
    assert_true(abs(float(form_avg) - 3.7) < 0.15,
                f"stats.form_avg ≈ 3.7 (got {form_avg})")
    best = stats.get("best") or {}
    assert_true(best.get("name") == "Bench press" and best.get("form") == 5,
                f"stats.best.name=='Bench press' & form==5 (got {best})")
    worst = stats.get("worst") or {}
    assert_true(worst.get("name") == "Back squat" and worst.get("form") == 2,
                f"stats.worst.name=='Back squat' & form==2 (got {worst})")
    mix = stats.get("difficulty_mix") or {}
    assert_true(mix.get("too_hard") == 1
                and mix.get("too_easy") == 1
                and mix.get("just_right") == 1,
                f"difficulty_mix each 1 (got {mix})")

    # 6) Bad session ID → 404
    r = requests.post(f"{BASE}/coach/review-session/bogus-id",
                      headers=h(token), timeout=60)
    assert_true(r.status_code == 404,
                f"bogus-id → 404 (got {r.status_code})", r.text[:200])

    # 7) No-auth → 401 (or 403)
    r = requests.post(f"{BASE}/coach/review-session/{sid}", timeout=60)
    assert_true(r.status_code in (401, 403),
                f"no-auth → 401 (got {r.status_code})", r.text[:200])

    # 8) Empty session (start & don't log) → 200 fallback, count=0
    r = requests.post(f"{BASE}/workouts/start", headers=h(token), timeout=30)
    if r.status_code == 200:
        sid2 = r.json()["session_id"]
        r = requests.post(f"{BASE}/coach/review-session/{sid2}",
                          headers=h(token), timeout=60)
        assert_true(r.status_code == 200,
                    f"empty-session review → 200 (got {r.status_code})",
                    r.text[:300])
        if r.status_code == 200:
            d2 = r.json()
            assert_true(isinstance(d2.get("review"), str) and len(d2["review"]) > 0,
                        "empty-session review string non-empty")
            assert_true((d2.get("stats") or {}).get("count") == 0,
                        f"empty-session stats.count == 0 (got {(d2.get('stats') or {}).get('count')})")
    else:
        _fail("second /workouts/start failed", r.text[:200])

    # 9) Persisted to chat history
    r = requests.get(f"{BASE}/coach/history", headers=h(token), timeout=30)
    assert_true(r.status_code == 200,
                f"GET /coach/history → 200 (got {r.status_code})",
                r.text[:200])
    if r.status_code == 200:
        msgs = r.json().get("messages") or r.json().get("history") or []
        # find assistant message whose text matches or starts with first 30
        snippet = review[:30]
        found = None
        for m in msgs:
            if m.get("role") == "assistant" and isinstance(m.get("text"), str):
                if m["text"] == review or m["text"].startswith(snippet):
                    found = m
                    break
        assert_true(found is not None,
                    "Review string persisted to /coach/history as assistant message")


# ---------------- TEST 2 ----------------
NEW_KEYS = ["xp_gained", "xp_start", "xp_now", "level_start", "level_now",
            "sessions_completed", "leveled_up", "weight_delta_kg"]
EXISTING_KEYS = ["days", "unit", "name", "photos_before", "photos_after",
                 "weight_before", "weight_after", "ready"]


def check_share_card(data, expected_days):
    for k in NEW_KEYS:
        assert_true(k in data,
                    f"share-card/{expected_days}: has new key '{k}'")
    for k in EXISTING_KEYS:
        assert_true(k in data,
                    f"share-card/{expected_days}: has existing key '{k}'")
    if "days" in data:
        assert_true(data["days"] == expected_days,
                    f"share-card/{expected_days}: days == {expected_days} (got {data['days']})")
    # types
    for k in ["xp_gained", "xp_start", "xp_now", "sessions_completed"]:
        v = data.get(k)
        assert_true(isinstance(v, int) and v >= 0,
                    f"share-card/{expected_days}: {k} is int >= 0 (got {v!r})")
    for k in ["level_start", "level_now"]:
        obj = data.get(k)
        assert_true(isinstance(obj, dict)
                    and "name" in obj and "emoji" in obj,
                    f"share-card/{expected_days}: {k} has name+emoji (got {obj!r})")
    assert_true(isinstance(data.get("leveled_up"), bool),
                f"share-card/{expected_days}: leveled_up is bool (got {data.get('leveled_up')!r})")
    wdk = data.get("weight_delta_kg")
    assert_true(wdk is None or isinstance(wdk, (int, float)),
                f"share-card/{expected_days}: weight_delta_kg is float or null (got {wdk!r})")


def test_share_card(token):
    print("\n=== TEST 2 — GET /api/progress/share-card/{days} ===")

    for d in (30, 60, 90):
        r = requests.get(f"{BASE}/progress/share-card/{d}",
                         headers=h(token), timeout=30)
        assert_true(r.status_code == 200,
                    f"share-card/{d} → 200 (got {r.status_code})",
                    r.text[:200])
        if r.status_code == 200:
            check_share_card(r.json(), d)

    # 3) 45 → 400
    r = requests.get(f"{BASE}/progress/share-card/45",
                     headers=h(token), timeout=30)
    assert_true(r.status_code == 400,
                f"share-card/45 → 400 (got {r.status_code})",
                r.text[:200])

    # 4) no-auth → 401
    r = requests.get(f"{BASE}/progress/share-card/30", timeout=30)
    assert_true(r.status_code in (401, 403),
                f"share-card/30 no-auth → 401 (got {r.status_code})",
                r.text[:200])

    # 5) ready flag lenient — after test1, admin has ≥1 completed session recently?
    # Note: /workouts/start creates a session but doesn't complete it.
    # The review-session endpoint doesn't mark completed either. We need to
    # confirm what "completed session" means for the share-card. It uses
    # {completed: True}. Let's check current status.
    r = requests.get(f"{BASE}/progress/share-card/30",
                     headers=h(token), timeout=30)
    if r.status_code == 200:
        data = r.json()
        assert_true(data.get("ready") is True,
                    f"share-card/30 ready==True (got {data.get('ready')}, "
                    f"sessions_completed={data.get('sessions_completed')}, "
                    f"weight_before={bool(data.get('weight_before'))}, "
                    f"weight_after={bool(data.get('weight_after'))}, "
                    f"photos_before={len(data.get('photos_before') or [])}, "
                    f"photos_after={len(data.get('photos_after') or [])})")


def main():
    print(f"BASE = {BASE}")
    token = login_admin()
    print(f"Admin token: {token[:20]}...")
    test_review_session(token)
    test_share_card(token)

    total = len(PASS) + len(FAIL)
    print(f"\n=========================")
    print(f"RESULT: {len(PASS)}/{total} passed, {len(FAIL)} failed")
    if FAIL:
        print("\nFAILURES:")
        for d, e in FAIL:
            print(f"  ✗ {d}")
            if e:
                print(f"      {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
