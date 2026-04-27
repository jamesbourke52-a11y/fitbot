"""FitLux backend API tests - auth, quiz/plan (AI), tracker, coach (AI), products."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/') if os.environ.get('EXPO_PUBLIC_BACKEND_URL') else None
if not BASE_URL:
    # Fallback: read frontend .env
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')

ADMIN_EMAIL = "admin@fitlux.com"
ADMIN_PASSWORD = "Admin@12345"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_user(session):
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "Pass@1234", "name": "Test User"}
    r = session.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "password": "Pass@1234", "token": data["token"], "user": data["user"]}


# ---- Health ----
def test_root(session):
    r = session.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---- Auth ----
def test_register_returns_token_and_user(test_user):
    assert test_user["token"]
    assert test_user["user"]["email"] == test_user["email"]
    assert test_user["user"]["has_completed_quiz"] is False
    assert "password_hash" not in test_user["user"]


def test_register_duplicate_rejected(session, test_user):
    r = session.post(f"{BASE_URL}/api/auth/register",
                     json={"email": test_user["email"], "password": "x", "name": "x"}, timeout=15)
    assert r.status_code == 400


def test_login_admin(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    assert data["token"]


def test_login_invalid(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
    assert r.status_code == 401


def test_me_requires_auth(session):
    r = session.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r.status_code == 401


def test_me_with_token(session, test_user):
    r = session.get(f"{BASE_URL}/api/auth/me",
                    headers={"Authorization": f"Bearer {test_user['token']}"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["email"] == test_user["email"]


# ---- Products ----
def test_products_list(session):
    r = session.get(f"{BASE_URL}/api/products", timeout=15)
    assert r.status_code == 200
    products = r.json()["products"]
    assert len(products) == 6
    ids = {p["id"] for p in products}
    assert {"p-protein", "p-shilajit", "p-creatine", "p-multi", "p-omega", "p-bcaa"} == ids
    for p in products:
        assert p["buy_url"].startswith("http")
        assert p["image"].startswith("http")


# ---- Quiz / Plan (AI) ----
@pytest.fixture(scope="module")
def plan_data(session, test_user):
    quiz = {
        "age": 28, "gender": "male", "height_cm": 178, "weight_kg": 75,
        "goal": "gain_muscle", "activity_level": "moderate",
        "workout_days_per_week": 5, "diet_preference": "omnivore",
        "wake_time": "06:30", "sleep_time": "22:30",
    }
    r = session.post(f"{BASE_URL}/api/quiz/submit", json=quiz,
                     headers={"Authorization": f"Bearer {test_user['token']}"}, timeout=90)
    assert r.status_code == 200, f"quiz/submit failed: {r.status_code} {r.text}"
    return r.json()


def test_quiz_submit_generates_ai_plan(plan_data):
    assert plan_data["plan_text"] and len(plan_data["plan_text"]) > 100
    assert plan_data["calorie_target"] > 1000
    assert plan_data["water_target_glasses"] >= 6
    assert isinstance(plan_data["reminders"], list) and len(plan_data["reminders"]) == 7
    labels = {r["id"] for r in plan_data["reminders"]}
    assert {"wake", "breakfast", "workout", "lunch", "dinner", "sleep"}.issubset(labels)


def test_get_plan_persisted(session, test_user, plan_data):
    r = session.get(f"{BASE_URL}/api/plan",
                    headers={"Authorization": f"Bearer {test_user['token']}"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["calorie_target"] == plan_data["calorie_target"]


def test_me_after_quiz_has_flag(session, test_user):
    r = session.get(f"{BASE_URL}/api/auth/me",
                    headers={"Authorization": f"Bearer {test_user['token']}"}, timeout=15)
    assert r.json()["has_completed_quiz"] is True


# ---- Tracker ----
def test_tracker_today(session, test_user):
    r = session.get(f"{BASE_URL}/api/tracker/today",
                    headers={"Authorization": f"Bearer {test_user['token']}"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "water_glasses" in d and "calorie_target" in d and "reminders" in d


def test_tracker_water_increments(session, test_user):
    h = {"Authorization": f"Bearer {test_user['token']}"}
    session.post(f"{BASE_URL}/api/tracker/reset", headers=h, timeout=15)
    r1 = session.post(f"{BASE_URL}/api/tracker/water", json={"glasses": 2}, headers=h, timeout=15)
    assert r1.status_code == 200
    r2 = session.get(f"{BASE_URL}/api/tracker/today", headers=h, timeout=15)
    assert r2.json()["water_glasses"] == 2


def test_tracker_calories_adds_meal(session, test_user):
    h = {"Authorization": f"Bearer {test_user['token']}"}
    r1 = session.post(f"{BASE_URL}/api/tracker/calories",
                      json={"meal_name": "Oats", "calories": 350}, headers=h, timeout=15)
    assert r1.status_code == 200
    r2 = session.get(f"{BASE_URL}/api/tracker/today", headers=h, timeout=15)
    d = r2.json()
    assert d["calories_consumed"] == 350
    assert any(m["name"] == "Oats" for m in d["meals"])


# ---- Coach (AI) ----
def test_coach_chat_and_history(session, test_user):
    h = {"Authorization": f"Bearer {test_user['token']}"}
    r = session.post(f"{BASE_URL}/api/coach/chat",
                     json={"message": "Give me one quick tip for muscle gain."},
                     headers=h, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["reply"] and len(data["reply"]) > 10
    assert data["session_id"]

    time.sleep(1)
    r2 = session.get(f"{BASE_URL}/api/coach/history", headers=h, timeout=15)
    assert r2.status_code == 200
    msgs = r2.json()["messages"]
    assert len(msgs) >= 2
    roles = [m["role"] for m in msgs[-2:]]
    assert roles == ["user", "assistant"]
