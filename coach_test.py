"""
Coach + workout-style + workout-history test suite.

Targets the three NEW backend areas added this session:
  1) GET /api/workouts/prescription respects workout_style (gym/calisthenics/home)
  2) GET /api/workouts/history (NEW)
  3) GET /api/coach/briefing + POST /api/coach/walkthrough (NEW, Claude Sonnet 4.5)

Run:
    python /app/coach_test.py
"""
from __future__ import annotations

import os
import sys
import time
import uuid
import json
import random
import string
from typing import Any, Dict, Optional

import requests

# ----------------------- Config -----------------------
def _read_frontend_env() -> str:
    path = "/app/frontend/.env"
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("EXPO_PUBLIC_BACKEND_URL=") or line.startswith(
                "REACT_APP_BACKEND_URL="
            ):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("Could not find backend URL in /app/frontend/.env")


BASE = _read_frontend_env().rstrip("/") + "/api"
ADMIN_EMAIL = "admin@fitlux.com"
ADMIN_PASSWORD = "Admin@12345"
LLM_TIMEOUT = 120  # Claude calls can take ~15-30s; allow more


# ----------------------- Helpers -----------------------
class Suite:
    def __init__(self) -> None:
        self.passed: list[str] = []
        self.failed: list[tuple[str, str]] = []

    def expect(self, name: str, cond: bool, detail: str = "") -> bool:
        if cond:
            self.passed.append(name)
            print(f"  ✅ {name}")
            return True
        self.failed.append((name, detail))
        print(f"  ❌ {name}: {detail}")
        return False

    def report(self) -> int:
        total = len(self.passed) + len(self.failed)
        print()
        print("=" * 60)
        print(f"RESULTS: {len(self.passed)}/{total} passed")
        if self.failed:
            print("\nFAILED:")
            for name, detail in self.failed:
                print(f"  - {name}: {detail}")
        return 0 if not self.failed else 1


def auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def rand_email(prefix: str) -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"{prefix}_{suffix}@example.com"


def login(email: str, password: str) -> Dict[str, Any]:
    r = requests.post(
        f"{BASE}/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def register(email: str, password: str, name: str) -> Dict[str, Any]:
    r = requests.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": password, "name": name},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def submit_quiz(token: str, workout_style: str) -> Dict[str, Any]:
    payload = {
        "age": 30,
        "gender": "male",
        "height_cm": 180.0,
        "weight_kg": 80.0,
        "goal": "gain_muscle",
        "activity_level": "moderate",
        "workout_days_per_week": 4,
        "diet_preference": "omnivore",
        "wake_time": "07:00",
        "sleep_time": "23:00",
        "work_schedule": "mon_fri",
        "work_start": "09:00",
        "work_end": "17:00",
        "workout_style": workout_style,
    }
    # Quiz uses Anthropic plan generation — give it time
    r = requests.post(
        f"{BASE}/quiz/submit",
        headers=auth_headers(token),
        json=payload,
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


# ----------------------- Tests -----------------------
def test_workout_style(s: Suite, admin_token: str) -> None:
    print("\n[1] Workout prescription respects workout_style")

    # --- a) GYM ---
    print("  -> submitting quiz with workout_style=gym")
    submit_quiz(admin_token, "gym")
    r = requests.get(
        f"{BASE}/workouts/prescription", headers=auth_headers(admin_token), timeout=30
    )
    s.expect("gym: prescription 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        presc = body.get("prescription", {})
        s.expect(
            "gym: prescription.style == 'gym'",
            presc.get("style") == "gym",
            f"got style={presc.get('style')!r}",
        )
        names = [l.get("name") for l in presc.get("key_lifts", [])]
        s.expect(
            "gym: at least one barbell lift (Bench press / Back squat)",
            any(n in {"Bench press", "Back squat"} for n in names),
            f"key_lifts names={names}",
        )

    # --- b) CALISTHENICS ---
    print("  -> resubmitting quiz with workout_style=calisthenics")
    submit_quiz(admin_token, "calisthenics")
    r = requests.get(
        f"{BASE}/workouts/prescription", headers=auth_headers(admin_token), timeout=30
    )
    s.expect(
        "calisthenics: prescription 200",
        r.status_code == 200,
        f"{r.status_code} {r.text[:200]}",
    )
    if r.status_code == 200:
        body = r.json()
        presc = body.get("prescription", {})
        s.expect(
            "calisthenics: prescription.style == 'calisthenics'",
            presc.get("style") == "calisthenics",
            f"got style={presc.get('style')!r}",
        )
        names = [l.get("name") for l in presc.get("key_lifts", [])]
        forbidden = {"Bench press", "Back squat", "Deadlift", "Overhead press"}
        bad = [n for n in names if n in forbidden]
        s.expect(
            "calisthenics: NO barbell key_lifts",
            not bad,
            f"forbidden names found: {bad}; full names={names}",
        )
        all_bw = all(l.get("bodyweight") is True for l in presc.get("key_lifts", []))
        s.expect(
            "calisthenics: every key_lift has bodyweight=true",
            all_bw,
            f"key_lifts={presc.get('key_lifts')}",
        )

    # --- c) HOME ---
    print("  -> resubmitting quiz with workout_style=home")
    submit_quiz(admin_token, "home")
    r = requests.get(
        f"{BASE}/workouts/prescription", headers=auth_headers(admin_token), timeout=30
    )
    s.expect(
        "home: prescription 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    )
    if r.status_code == 200:
        body = r.json()
        presc = body.get("prescription", {})
        s.expect(
            "home: prescription.style == 'home'",
            presc.get("style") == "home",
            f"got style={presc.get('style')!r}",
        )
        names = [l.get("name") for l in presc.get("key_lifts", [])]
        s.expect(
            "home: contains 'Dumbbell chest press' or 'Goblet squat'",
            any(n in {"Dumbbell chest press", "Goblet squat"} for n in names),
            f"key_lifts names={names}",
        )
        # weight_display present (NOT bodyweight) on home key lifts
        any_wd = any(
            "weight_display" in l and not l.get("bodyweight")
            for l in presc.get("key_lifts", [])
        )
        s.expect(
            "home: at least one key_lift has weight_display (not bodyweight)",
            any_wd,
            f"key_lifts={presc.get('key_lifts')}",
        )

    # --- d) no auth → 401 ---
    r = requests.get(f"{BASE}/workouts/prescription", timeout=30)
    s.expect(
        "no-auth /workouts/prescription → 401/403",
        r.status_code in (401, 403),
        f"got {r.status_code}",
    )


def test_workout_history(s: Suite) -> None:
    print("\n[2] Workout history endpoint")
    # Use a fresh user (no completed workouts) — we won't submit quiz so
    # workouts/start works without subscription? Let's check: /workouts/start
    # uses get_current_user (no subscription gate). Good.
    email = rand_email("histtest")
    pw = "Pass1234!"
    reg = register(email, pw, "Hist Tester")
    token = reg["token"]

    # --- a) empty history ---
    r = requests.get(
        f"{BASE}/workouts/history", headers=auth_headers(token), timeout=30
    )
    s.expect("history empty: 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        s.expect(
            "history empty: sessions is []",
            body.get("sessions") == [],
            f"got {body.get('sessions')}",
        )
        s.expect(
            "history empty: total_completed == 0",
            body.get("total_completed") == 0,
            f"got {body.get('total_completed')}",
        )

    # --- b) start + feedback then 1 session ---
    r = requests.post(
        f"{BASE}/workouts/start", headers=auth_headers(token), timeout=30
    )
    s.expect("workouts/start: 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    workout_id = r.json().get("session_id") if r.status_code == 200 else None

    if workout_id:
        r = requests.post(
            f"{BASE}/workouts/feedback",
            headers=auth_headers(token),
            json={
                "workout_id": workout_id,
                "weight_feedback": "just_right",
                "reps_feedback": "just_right",
            },
            timeout=30,
        )
        s.expect(
            "workouts/feedback: 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        )

        r = requests.get(
            f"{BASE}/workouts/history?limit=10",
            headers=auth_headers(token),
            timeout=30,
        )
        s.expect("history (1 session): 200", r.status_code == 200, f"{r.status_code}")
        if r.status_code == 200:
            body = r.json()
            sessions = body.get("sessions", [])
            s.expect(
                "history (1 session): >= 1 session",
                len(sessions) >= 1,
                f"got {len(sessions)} sessions",
            )
            if sessions:
                s0 = sessions[0]
                s.expect(
                    "history session.completed == True",
                    s0.get("completed") is True,
                    f"got completed={s0.get('completed')}",
                )
                s.expect(
                    "history session.weight_feedback == just_right",
                    s0.get("weight_feedback") == "just_right",
                    f"got weight_feedback={s0.get('weight_feedback')}",
                )
                s.expect(
                    "history session.reps_feedback == just_right",
                    s0.get("reps_feedback") == "just_right",
                    f"got reps_feedback={s0.get('reps_feedback')}",
                )
            s.expect(
                "history (1 session): total_completed >= 1",
                body.get("total_completed", 0) >= 1,
                f"got {body.get('total_completed')}",
            )

    # --- c) limit=5 respected ---
    r = requests.get(
        f"{BASE}/workouts/history?limit=5",
        headers=auth_headers(token),
        timeout=30,
    )
    s.expect("history limit=5: 200", r.status_code == 200, f"{r.status_code}")
    if r.status_code == 200:
        body = r.json()
        s.expect(
            "history limit=5: <= 5 sessions",
            len(body.get("sessions", [])) <= 5,
            f"got {len(body.get('sessions', []))}",
        )

    # --- d) no auth ---
    r = requests.get(f"{BASE}/workouts/history", timeout=30)
    s.expect(
        "no-auth /workouts/history → 401/403",
        r.status_code in (401, 403),
        f"got {r.status_code}",
    )


def test_coach_endpoints(s: Suite, admin_token: str) -> None:
    print("\n[3] Coach briefing + walkthrough")

    # Make sure admin has a plan — submit quiz once (gym) so plan exists
    print("  -> ensure admin has a plan (workout_style=gym)")
    submit_quiz(admin_token, "gym")

    # --- a) admin briefing (has_plan = True) ---
    print("  -> GET /api/coach/briefing (admin, may take 15-30s)")
    r = requests.get(
        f"{BASE}/coach/briefing",
        headers=auth_headers(admin_token),
        timeout=LLM_TIMEOUT,
    )
    s.expect(
        "briefing admin: 200", r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    )
    if r.status_code == 200:
        body = r.json()
        s.expect(
            "briefing admin: has_plan == True",
            body.get("has_plan") is True,
            f"got has_plan={body.get('has_plan')}",
        )
        greeting = body.get("greeting") or ""
        s.expect(
            "briefing admin: greeting non-empty string",
            isinstance(greeting, str) and len(greeting.strip()) > 0,
            f"len={len(greeting)}",
        )
        lvl = body.get("level") or {}
        s.expect(
            "briefing admin: level has name+emoji",
            bool(lvl.get("name")) and bool(lvl.get("emoji")),
            f"level={lvl}",
        )
        s.expect(
            "briefing admin: style key present",
            "style" in body,
            f"keys={list(body.keys())}",
        )
        s.expect(
            "briefing admin: time_of_day key present",
            "time_of_day" in body,
            f"keys={list(body.keys())}",
        )
        ps = body.get("prescription_summary") or {}
        for k in ("sets", "key_lifts", "accessories", "adjustment_factor"):
            s.expect(
                f"briefing admin: prescription_summary.{k} present",
                k in ps,
                f"prescription_summary keys={list(ps.keys())}",
            )
        s.expect(
            "briefing admin: awaiting_feedback is bool",
            isinstance(body.get("awaiting_feedback"), bool),
            f"got {type(body.get('awaiting_feedback')).__name__}",
        )

    # --- b) Fresh user with NO plan ---
    print("  -> GET /api/coach/briefing (fresh no-plan user)")
    email = rand_email("noplan")
    pw = "Pass1234!"
    reg = register(email, pw, "No Plan User")
    fresh_token = reg["token"]
    r = requests.get(
        f"{BASE}/coach/briefing",
        headers=auth_headers(fresh_token),
        timeout=LLM_TIMEOUT,
    )
    s.expect(
        "briefing no-plan: 200", r.status_code == 200, f"{r.status_code} {r.text[:300]}"
    )
    if r.status_code == 200:
        body = r.json()
        s.expect(
            "briefing no-plan: has_plan == False",
            body.get("has_plan") is False,
            f"got has_plan={body.get('has_plan')}",
        )
        greeting = body.get("greeting") or ""
        s.expect(
            "briefing no-plan: greeting still non-empty",
            isinstance(greeting, str) and len(greeting.strip()) > 0,
            f"len={len(greeting)}",
        )
        lvl = body.get("level") or {}
        s.expect(
            "briefing no-plan: level defaults to Rookie",
            lvl.get("name") == "Rookie",
            f"got level.name={lvl.get('name')}",
        )

    # --- c) no auth ---
    r = requests.get(f"{BASE}/coach/briefing", timeout=30)
    s.expect(
        "briefing no-auth → 401/403",
        r.status_code in (401, 403),
        f"got {r.status_code}",
    )

    # --- d) walkthrough as admin (active subscription via admin role) ---
    print("  -> POST /api/coach/walkthrough (admin, may take 15-30s)")
    r = requests.post(
        f"{BASE}/coach/walkthrough",
        headers=auth_headers(admin_token),
        timeout=LLM_TIMEOUT,
    )
    s.expect(
        "walkthrough admin: 200",
        r.status_code == 200,
        f"{r.status_code} {r.text[:300]}",
    )
    walkthrough_reply: Optional[str] = None
    if r.status_code == 200:
        body = r.json()
        reply = body.get("reply") or ""
        walkthrough_reply = reply
        s.expect(
            "walkthrough admin: reply non-empty",
            isinstance(reply, str) and len(reply.strip()) > 0,
            f"len={len(reply)}",
        )
        sid = body.get("session_id") or ""
        s.expect(
            "walkthrough admin: session_id starts with 'coach-'",
            isinstance(sid, str) and sid.startswith("coach-"),
            f"got session_id={sid!r}",
        )

    # --- e) non-subscriber fresh user → 402 ---
    r = requests.post(
        f"{BASE}/coach/walkthrough",
        headers=auth_headers(fresh_token),
        timeout=LLM_TIMEOUT,
    )
    s.expect(
        "walkthrough non-subscriber → 402",
        r.status_code == 402,
        f"got {r.status_code} {r.text[:200]}",
    )

    # --- f) coach/history contains the walkthrough reply ---
    if walkthrough_reply:
        r = requests.get(
            f"{BASE}/coach/history",
            headers=auth_headers(admin_token),
            timeout=30,
        )
        s.expect(
            "coach/history admin: 200", r.status_code == 200, f"{r.status_code}"
        )
        if r.status_code == 200:
            msgs = r.json().get("messages", [])
            assistant_texts = [
                m.get("text", "") for m in msgs if m.get("role") == "assistant"
            ]
            found = any(walkthrough_reply.strip() == t.strip() for t in assistant_texts)
            s.expect(
                "coach/history: walkthrough reply present as assistant message",
                found,
                f"reply prefix={walkthrough_reply[:60]!r}; saw {len(assistant_texts)} assistant msgs",
            )


def main() -> int:
    print(f"BASE = {BASE}")
    s = Suite()

    # Admin login
    print("\n[setup] login admin")
    try:
        admin = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    except Exception as e:
        print(f"FATAL: cannot login admin: {e}")
        return 2
    admin_token = admin["token"]
    s.expect(
        "admin login role == admin",
        admin.get("user", {}).get("role") == "admin",
        f"got role={admin.get('user', {}).get('role')!r}",
    )

    test_workout_style(s, admin_token)
    test_workout_history(s)
    test_coach_endpoints(s, admin_token)

    return s.report()


if __name__ == "__main__":
    sys.exit(main())
