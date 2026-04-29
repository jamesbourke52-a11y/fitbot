from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage

# ----------------------- Setup -----------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI(title="FitLux API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ----------------------- Auth helpers -----------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_active_subscription(user: dict = Depends(get_current_user)) -> dict:
    sub = await db.subscriptions.find_one({"user_id": user["id"]}, {"_id": 0})
    if user.get("role") == "admin":
        return user  # admins always pass
    if sub and sub.get("status") in {"active", "trialing"}:
        return user
    raise HTTPException(status_code=402, detail="Subscription required")


# ----------------------- Models -----------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: Dict[str, Any]


class QuizSubmission(BaseModel):
    age: int
    gender: str  # male, female, other
    height_cm: float
    weight_kg: float
    goal: str  # lose_weight, gain_muscle, maintain, athletic
    activity_level: str  # sedentary, light, moderate, very_active
    workout_days_per_week: int
    diet_preference: str  # omnivore, vegetarian, vegan, keto
    wake_time: str  # "06:30"
    sleep_time: str  # "22:30"
    work_schedule: str = "mon_fri"  # mon_fri, mon_sat, flexible, shift, none
    work_start: str = "09:00"  # ignored if work_schedule == "none"
    work_end: str = "17:00"
    workout_style: str = "gym"  # gym, calisthenics, mixed, home


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class WaterLogRequest(BaseModel):
    glasses: int = 1


class CalorieLogRequest(BaseModel):
    meal_name: str
    calories: int


class ReminderCreate(BaseModel):
    label: str
    time: str  # "HH:MM"
    icon: str = "bell"


class ReminderUpdate(BaseModel):
    label: Optional[str] = None
    time: Optional[str] = None
    icon: Optional[str] = None


# ----------------------- Auth Endpoints -----------------------
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    email = req.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": req.name,
        "password_hash": hash_password(req.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "has_completed_quiz": False,
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return AuthResponse(token=token, user=user_doc)


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    user.pop("password_hash", None)
    user.pop("_id", None)
    return AuthResponse(token=token, user=user)


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ----------------------- Quiz & Plan -----------------------
def calc_bmr(gender: str, weight_kg: float, height_cm: float, age: int) -> float:
    # Mifflin-St Jeor
    if gender == "female":
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5


def calc_calorie_target(quiz: dict) -> int:
    bmr = calc_bmr(quiz["gender"], quiz["weight_kg"], quiz["height_cm"], quiz["age"])
    activity_mul = {"sedentary": 1.2, "light": 1.375, "moderate": 1.55, "very_active": 1.725}
    tdee = bmr * activity_mul.get(quiz["activity_level"], 1.4)
    if quiz["goal"] == "lose_weight":
        return int(tdee - 400)
    if quiz["goal"] == "gain_muscle":
        return int(tdee + 300)
    return int(tdee)


def calc_water_glasses(weight_kg: float) -> int:
    # ~35 ml/kg, 250 ml glass
    return max(6, round((weight_kg * 35) / 250))


# ----------------------- Exercise Library -----------------------
# Each exercise opens a YouTube search for "<query>" — guarantees an accurate
# tutorial for every movement (free stock libraries lack many gym lifts).
def _yt(query: str) -> str:
    from urllib.parse import quote
    return f"https://www.youtube.com/results?search_query={quote(query)}"


# Curated still images per movement family (Pexels, free)
IMG_PUSH = "https://images.pexels.com/photos/4944966/pexels-photo-4944966.jpeg?w=600"
IMG_PULL = "https://images.pexels.com/photos/4775204/pexels-photo-4775204.jpeg?w=600"
IMG_LEGS = "https://images.pexels.com/photos/4720236/pexels-photo-4720236.jpeg?w=600"
IMG_CORE = "https://images.pexels.com/photos/3076509/pexels-photo-3076509.jpeg?w=600"
IMG_CARDIO = "https://images.pexels.com/photos/4498151/pexels-photo-4498151.jpeg?w=600"
IMG_BARBELL = "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?w=600"
IMG_DUMBBELL = "https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg?w=600"
IMG_KETTLE = "https://images.pexels.com/photos/3253501/pexels-photo-3253501.jpeg?w=600"


# (id, name, thumb, default sets x reps, instruction, youtube search query)
EXERCISES: Dict[str, Dict[str, Any]] = {
    "pushup": {"name": "Push-ups", "thumb": IMG_PUSH,
               "default": "3 x 10-15", "tip": "Keep core tight, elbows ~45°.",
               "search": "perfect push up form tutorial"},
    "diamond_pushup": {"name": "Diamond push-ups", "thumb": IMG_PUSH,
                       "default": "3 x 8-12", "tip": "Hands together to hit triceps.",
                       "search": "diamond push up form tutorial"},
    "incline_pushup": {"name": "Incline push-ups", "thumb": IMG_PUSH,
                       "default": "3 x 12-15", "tip": "Easier — great for beginners.",
                       "search": "incline push up form tutorial"},
    "pullup": {"name": "Pull-ups", "thumb": IMG_PULL,
               "default": "3 x 5-8", "tip": "Full range, no kipping.",
               "search": "pull up proper form tutorial"},
    "bw_squat": {"name": "Bodyweight squats", "thumb": IMG_LEGS,
                 "default": "3 x 15-20", "tip": "Knees track toes, hip crease below knee.",
                 "search": "bodyweight squat proper form"},
    "lunge": {"name": "Lunges", "thumb": IMG_LEGS,
              "default": "3 x 10/leg", "tip": "Step long, drive through front heel.",
              "search": "forward lunge proper form tutorial"},
    "plank": {"name": "Plank hold", "thumb": IMG_CORE,
              "default": "3 x 30-60s", "tip": "Brace core, glutes squeezed.",
              "search": "plank proper form tutorial"},
    "burpee": {"name": "Burpees", "thumb": IMG_CARDIO,
               "default": "3 x 8-12", "tip": "Explosive — full body conditioner.",
               "search": "burpee proper form tutorial"},
    "dip": {"name": "Tricep dips", "thumb": IMG_PUSH,
            "default": "3 x 10-12", "tip": "Use a bench or parallel bars.",
            "search": "tricep dip proper form bench"},
    "mountain_climber": {"name": "Mountain climbers", "thumb": IMG_CARDIO,
                         "default": "3 x 30s", "tip": "Hips stable, fast knees.",
                         "search": "mountain climber proper form tutorial"},
    "jumping_jack": {"name": "Jumping jacks", "thumb": IMG_CARDIO,
                     "default": "3 x 45s", "tip": "Great warm-up cardio.",
                     "search": "jumping jacks proper form"},

    "back_squat": {"name": "Back squat", "thumb": IMG_BARBELL,
                   "default": "4 x 6-8", "tip": "Brace core, drive through midfoot.",
                   "search": "barbell back squat proper form"},
    "deadlift": {"name": "Deadlift", "thumb": IMG_BARBELL,
                 "default": "4 x 5", "tip": "Neutral spine, bar close to body.",
                 "search": "conventional deadlift proper form"},
    "bench_press": {"name": "Bench press", "thumb": IMG_BARBELL,
                    "default": "4 x 6-8", "tip": "Retract scapulae, controlled descent.",
                    "search": "barbell bench press proper form"},
    "overhead_press": {"name": "Overhead press", "thumb": IMG_BARBELL,
                       "default": "4 x 6-8", "tip": "Glutes tight, press straight up.",
                       "search": "overhead press proper form barbell"},
    "row": {"name": "Barbell row", "thumb": IMG_BARBELL,
            "default": "4 x 8", "tip": "Hinge to ~45°, pull to lower chest.",
            "search": "barbell row proper form"},
    "lat_pulldown": {"name": "Lat pulldown", "thumb": IMG_PULL,
                     "default": "4 x 10", "tip": "Drive elbows down and back.",
                     "search": "lat pulldown proper form"},
    "db_curl": {"name": "Dumbbell curl", "thumb": IMG_DUMBBELL,
                "default": "3 x 10-12", "tip": "Elbows pinned, no swing.",
                "search": "dumbbell biceps curl proper form"},
    "tricep_pushdown": {"name": "Tricep pushdown", "thumb": IMG_DUMBBELL,
                        "default": "3 x 10-12", "tip": "Lock elbows by ribs.",
                        "search": "tricep pushdown proper form cable"},
    "leg_press": {"name": "Leg press", "thumb": IMG_LEGS,
                  "default": "4 x 10", "tip": "Don't lock knees at top.",
                  "search": "leg press proper form tutorial"},
    "kettlebell_swing": {"name": "Kettlebell swing", "thumb": IMG_KETTLE,
                         "default": "4 x 15", "tip": "Hip hinge — power from hips, not arms.",
                         "search": "kettlebell swing proper form tutorial"},
}


def _ex(eid: str, sets_reps: Optional[str] = None) -> Dict[str, Any]:
    base = EXERCISES[eid]
    return {
        "id": eid,
        "name": base["name"],
        "thumb": base["thumb"],
        "demo_url": _yt(base["search"]),
        "sets_reps": sets_reps or base["default"],
        "tip": base["tip"],
    }


# Workout splits per style. Each split = list of days (rest days are also listed)
# Split is selected by workout_days_per_week
def build_workout_schedule(style: str, days_per_week: int) -> List[Dict[str, Any]]:
    style = style if style in {"gym", "calisthenics", "mixed", "home"} else "gym"
    d = max(2, min(6, days_per_week))

    if style == "calisthenics":
        days = [
            {"day": "Day 1", "title": "Upper Body Pull & Push", "focus": "Strength",
             "exercises": [_ex("pullup"), _ex("pushup"), _ex("diamond_pushup"), _ex("dip"), _ex("plank")]},
            {"day": "Day 2", "title": "Lower Body & Core", "focus": "Power",
             "exercises": [_ex("bw_squat"), _ex("lunge"), _ex("jumping_jack"), _ex("plank"), _ex("mountain_climber")]},
            {"day": "Day 3", "title": "Full Body Conditioning", "focus": "Cardio",
             "exercises": [_ex("burpee"), _ex("pushup"), _ex("bw_squat"), _ex("mountain_climber"), _ex("jumping_jack")]},
            {"day": "Day 4", "title": "Push Focus", "focus": "Chest/Shoulders/Triceps",
             "exercises": [_ex("pushup", "4 x 12-15"), _ex("incline_pushup"), _ex("dip"), _ex("plank")]},
            {"day": "Day 5", "title": "Pull & Core", "focus": "Back/Biceps",
             "exercises": [_ex("pullup", "4 x 5-8"), _ex("plank"), _ex("mountain_climber"), _ex("burpee")]},
            {"day": "Day 6", "title": "Skills & Mobility", "focus": "Active recovery",
             "exercises": [_ex("plank"), _ex("lunge"), _ex("bw_squat"), _ex("jumping_jack")]},
        ]
    elif style == "home":
        days = [
            {"day": "Day 1", "title": "Full Body Home", "focus": "Strength",
             "exercises": [_ex("pushup"), _ex("bw_squat"), _ex("lunge"), _ex("plank")]},
            {"day": "Day 2", "title": "Cardio Burn", "focus": "Conditioning",
             "exercises": [_ex("jumping_jack"), _ex("burpee"), _ex("mountain_climber"), _ex("plank")]},
            {"day": "Day 3", "title": "Lower Body", "focus": "Legs/Glutes",
             "exercises": [_ex("bw_squat", "4 x 20"), _ex("lunge", "3 x 12/leg"), _ex("jumping_jack"), _ex("plank")]},
            {"day": "Day 4", "title": "Upper Body", "focus": "Push/Pull",
             "exercises": [_ex("pushup"), _ex("diamond_pushup"), _ex("dip"), _ex("plank")]},
            {"day": "Day 5", "title": "HIIT Express", "focus": "Cardio",
             "exercises": [_ex("burpee"), _ex("mountain_climber"), _ex("jumping_jack"), _ex("bw_squat")]},
            {"day": "Day 6", "title": "Core & Mobility", "focus": "Recovery",
             "exercises": [_ex("plank", "4 x 45s"), _ex("mountain_climber"), _ex("lunge")]},
        ]
    elif style == "mixed":
        days = [
            {"day": "Day 1", "title": "Push (Gym)", "focus": "Chest/Shoulders/Triceps",
             "exercises": [_ex("bench_press"), _ex("overhead_press"), _ex("tricep_pushdown"), _ex("pushup")]},
            {"day": "Day 2", "title": "Pull (Gym)", "focus": "Back/Biceps",
             "exercises": [_ex("deadlift"), _ex("row"), _ex("lat_pulldown"), _ex("db_curl")]},
            {"day": "Day 3", "title": "Calisthenics Conditioning", "focus": "Bodyweight",
             "exercises": [_ex("pullup"), _ex("dip"), _ex("burpee"), _ex("plank")]},
            {"day": "Day 4", "title": "Legs (Gym)", "focus": "Quads/Hamstrings/Glutes",
             "exercises": [_ex("back_squat"), _ex("leg_press"), _ex("lunge"), _ex("kettlebell_swing")]},
            {"day": "Day 5", "title": "Calisthenics Strength", "focus": "Bodyweight",
             "exercises": [_ex("pushup", "4 x 15"), _ex("pullup", "4 x 6"), _ex("dip"), _ex("plank")]},
            {"day": "Day 6", "title": "Conditioning & Core", "focus": "Cardio",
             "exercises": [_ex("kettlebell_swing"), _ex("burpee"), _ex("mountain_climber"), _ex("plank")]},
        ]
    else:  # gym
        days = [
            {"day": "Day 1", "title": "Push Day", "focus": "Chest/Shoulders/Triceps",
             "exercises": [_ex("bench_press"), _ex("overhead_press"), _ex("tricep_pushdown"), _ex("pushup")]},
            {"day": "Day 2", "title": "Pull Day", "focus": "Back/Biceps",
             "exercises": [_ex("deadlift"), _ex("row"), _ex("lat_pulldown"), _ex("db_curl")]},
            {"day": "Day 3", "title": "Leg Day", "focus": "Quads/Hamstrings/Glutes",
             "exercises": [_ex("back_squat"), _ex("leg_press"), _ex("lunge"), _ex("plank")]},
            {"day": "Day 4", "title": "Upper Hypertrophy", "focus": "Volume upper",
             "exercises": [_ex("bench_press", "4 x 10"), _ex("row", "4 x 10"), _ex("db_curl"), _ex("tricep_pushdown")]},
            {"day": "Day 5", "title": "Lower Hypertrophy", "focus": "Volume lower",
             "exercises": [_ex("back_squat", "4 x 10"), _ex("leg_press"), _ex("kettlebell_swing"), _ex("plank")]},
            {"day": "Day 6", "title": "Conditioning", "focus": "Cardio + core",
             "exercises": [_ex("kettlebell_swing"), _ex("burpee"), _ex("mountain_climber"), _ex("plank")]},
        ]

    return days[:d]


async def generate_ai_plan(quiz: dict, user_name: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"plan-{uuid.uuid4()}",
        system_message=(
            "You are an elite personal trainer & nutrition coach. "
            "Generate a clear, actionable, motivating personalized fitness plan. "
            "Format as markdown with sections: Overview, Weekly Workout Split, "
            "Nutrition Strategy, Daily Schedule, Pro Tips. Keep it concise (~400 words)."
        ),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    work_line = (
        "Work schedule: no fixed job — flexible all day"
        if quiz.get("work_schedule") == "none"
        else f"Work: {quiz.get('work_schedule', 'mon_fri').replace('_', '-')} "
             f"from {quiz.get('work_start', '09:00')} to {quiz.get('work_end', '17:00')}"
    )
    style_line = f"Workout style: {quiz.get('workout_style', 'gym')}"
    prompt = (
        f"Create a personalized fitness plan for {user_name}.\n"
        f"Age: {quiz['age']} | Gender: {quiz['gender']}\n"
        f"Height: {quiz['height_cm']}cm | Weight: {quiz['weight_kg']}kg\n"
        f"Goal: {quiz['goal']}\n"
        f"Activity level: {quiz['activity_level']}\n"
        f"Workout days/week: {quiz['workout_days_per_week']}\n"
        f"Diet: {quiz['diet_preference']}\n"
        f"Wake: {quiz['wake_time']} | Sleep: {quiz['sleep_time']}\n"
        f"{work_line}\n"
        f"{style_line}\n"
        "IMPORTANT: schedule training and meals AROUND the user's work hours. "
        "Recommend whether morning (before work) or evening (after work) workouts fit best, "
        "and tailor the workout style (gym / calisthenics / home / mixed) accordingly. "
        "A structured workout schedule with specific exercises is shown separately in the app — "
        "in your reply focus on the OVERVIEW, NUTRITION STRATEGY, DAILY SCHEDULE, and PRO TIPS."
    )
    response = await chat.send_message(UserMessage(text=prompt))
    return response


def _to_min(hhmm: str) -> int:
    h, m = map(int, hhmm.split(":"))
    return h * 60 + m


def _to_hhmm(total: int) -> str:
    total = total % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def build_reminders(quiz: dict) -> List[Dict[str, str]]:
    wake = quiz["wake_time"]
    sleep = quiz["sleep_time"]
    has_job = quiz.get("work_schedule", "none") != "none"
    work_start = _to_min(quiz.get("work_start", "09:00"))
    work_end = _to_min(quiz.get("work_end", "17:00"))
    wake_min = _to_min(wake)

    # Workout: prefer before work if there are 90+ min between wake and work_start;
    # otherwise schedule after work.
    if has_job:
        if work_start - wake_min >= 90:
            workout_min = wake_min + 30
            workout_label = "Morning workout"
        else:
            workout_min = work_end + 30
            workout_label = "Post-work workout"
        breakfast_min = wake_min + 25
        # Lunch: within work hours, around midpoint or 13:00 if it falls inside work
        midday = (work_start + work_end) // 2
        lunch_min = midday if work_start <= 13 * 60 <= work_end else midday
        # Hydration check: middle of work or mid-afternoon
        hydration_min = (work_start + midday) // 2
        # Dinner: 1h after work (if workout was post-work, after workout)
        dinner_min = max(work_end + 60, workout_min + 75 if workout_label == "Post-work workout" else work_end + 60)
    else:
        workout_min = wake_min + 60
        workout_label = "Workout session"
        breakfast_min = wake_min + 30
        lunch_min = 13 * 60
        hydration_min = 16 * 60
        dinner_min = 19 * 60 + 30

    items = [
        {"id": "wake", "label": "Wake up & hydrate", "time": wake, "icon": "sun"},
        {"id": "breakfast", "label": "Breakfast", "time": _to_hhmm(breakfast_min), "icon": "coffee"},
        {"id": "workout", "label": workout_label, "time": _to_hhmm(workout_min), "icon": "dumbbell"},
        {"id": "lunch", "label": "Lunch", "time": _to_hhmm(lunch_min), "icon": "utensils"},
        {"id": "snack", "label": "Hydration check", "time": _to_hhmm(hydration_min), "icon": "droplet"},
        {"id": "dinner", "label": "Dinner", "time": _to_hhmm(dinner_min), "icon": "utensils"},
        {"id": "sleep", "label": "Wind down & sleep", "time": sleep, "icon": "moon"},
    ]
    return sorted(items, key=lambda r: _to_min(r["time"]))


@api_router.post("/quiz/submit")
async def submit_quiz(quiz: QuizSubmission, user: dict = Depends(require_active_subscription)):
    quiz_dict = quiz.model_dump()
    plan_text = await generate_ai_plan(quiz_dict, user["name"])
    calorie_target = calc_calorie_target(quiz_dict)
    water_glasses = calc_water_glasses(quiz_dict["weight_kg"])
    reminders = build_reminders(quiz_dict)
    workout_schedule = build_workout_schedule(
        quiz_dict["workout_style"], quiz_dict["workout_days_per_week"]
    )

    plan_doc = {
        "user_id": user["id"],
        "quiz": quiz_dict,
        "plan_text": plan_text,
        "calorie_target": calorie_target,
        "water_target_glasses": water_glasses,
        "reminders": reminders,
        "workout_schedule": workout_schedule,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.plans.update_one({"user_id": user["id"]}, {"$set": plan_doc}, upsert=True)
    await db.users.update_one({"id": user["id"]}, {"$set": {"has_completed_quiz": True}})
    plan_doc.pop("_id", None)
    return plan_doc


@api_router.get("/plan")
async def get_plan(user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"user_id": user["id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="No plan yet — complete the quiz")
    quiz = plan.get("quiz") or {}
    if quiz:
        plan["workout_schedule"] = build_workout_schedule(
            quiz.get("workout_style", "gym"),
            int(quiz.get("workout_days_per_week", 3)),
        )
        if not plan.get("reminders_customized"):
            plan["reminders"] = build_reminders(quiz)
        else:
            plan["reminders"] = sorted(plan.get("reminders", []), key=lambda r: _to_min(r["time"]))
    return plan


# ---- Reminder CRUD ----
async def _get_or_init_reminders(user_id: str) -> List[Dict[str, Any]]:
    plan = await db.plans.find_one({"user_id": user_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Complete the quiz first")
    if plan.get("reminders_customized") and plan.get("reminders"):
        return plan["reminders"]
    auto = build_reminders(plan.get("quiz", {}))
    return auto


@api_router.post("/reminders/add")
async def add_reminder(req: ReminderCreate, user: dict = Depends(get_current_user)):
    reminders = await _get_or_init_reminders(user["id"])
    new_item = {"id": str(uuid.uuid4()), "label": req.label, "time": req.time, "icon": req.icon}
    reminders = sorted(reminders + [new_item], key=lambda r: _to_min(r["time"]))
    await db.plans.update_one(
        {"user_id": user["id"]},
        {"$set": {"reminders": reminders, "reminders_customized": True}},
    )
    return {"reminders": reminders}


@api_router.patch("/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, req: ReminderUpdate, user: dict = Depends(get_current_user)):
    reminders = await _get_or_init_reminders(user["id"])
    found = False
    for r in reminders:
        if r["id"] == reminder_id:
            if req.label is not None:
                r["label"] = req.label
            if req.time is not None:
                r["time"] = req.time
            if req.icon is not None:
                r["icon"] = req.icon
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminders = sorted(reminders, key=lambda r: _to_min(r["time"]))
    await db.plans.update_one(
        {"user_id": user["id"]},
        {"$set": {"reminders": reminders, "reminders_customized": True}},
    )
    return {"reminders": reminders}


@api_router.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, user: dict = Depends(get_current_user)):
    reminders = await _get_or_init_reminders(user["id"])
    new_list = [r for r in reminders if r["id"] != reminder_id]
    if len(new_list) == len(reminders):
        raise HTTPException(status_code=404, detail="Reminder not found")
    await db.plans.update_one(
        {"user_id": user["id"]},
        {"$set": {"reminders": new_list, "reminders_customized": True}},
    )
    return {"reminders": new_list}


@api_router.post("/reminders/reset")
async def reset_reminders(user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"user_id": user["id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Complete the quiz first")
    auto = build_reminders(plan.get("quiz", {}))
    await db.plans.update_one(
        {"user_id": user["id"]},
        {"$set": {"reminders": auto, "reminders_customized": False}},
    )
    return {"reminders": auto}


# ----------------------- Daily tracker -----------------------
def today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@api_router.get("/tracker/today")
async def get_today(user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"user_id": user["id"]}, {"_id": 0})
    log = await db.daily_logs.find_one(
        {"user_id": user["id"], "date": today_key()}, {"_id": 0}
    ) or {"water_glasses": 0, "calories_consumed": 0, "meals": []}
    if plan and plan.get("reminders_customized") and plan.get("reminders"):
        reminders = sorted(plan["reminders"], key=lambda r: _to_min(r["time"]))
    elif plan and plan.get("quiz"):
        reminders = build_reminders(plan["quiz"])
    else:
        reminders = []
    return {
        "date": today_key(),
        "water_glasses": log.get("water_glasses", 0),
        "water_target": plan["water_target_glasses"] if plan else 8,
        "calories_consumed": log.get("calories_consumed", 0),
        "calorie_target": plan["calorie_target"] if plan else 2000,
        "meals": log.get("meals", []),
        "reminders": reminders,
    }


@api_router.post("/tracker/water")
async def log_water(req: WaterLogRequest, user: dict = Depends(get_current_user)):
    await db.daily_logs.update_one(
        {"user_id": user["id"], "date": today_key()},
        {"$inc": {"water_glasses": req.glasses}},
        upsert=True,
    )
    return {"ok": True}


@api_router.post("/tracker/calories")
async def log_calories(req: CalorieLogRequest, user: dict = Depends(get_current_user)):
    await db.daily_logs.update_one(
        {"user_id": user["id"], "date": today_key()},
        {
            "$inc": {"calories_consumed": req.calories},
            "$push": {"meals": {"name": req.meal_name, "calories": req.calories,
                                 "at": datetime.now(timezone.utc).isoformat()}},
        },
        upsert=True,
    )
    return {"ok": True}


@api_router.post("/tracker/reset")
async def reset_today(user: dict = Depends(get_current_user)):
    await db.daily_logs.update_one(
        {"user_id": user["id"], "date": today_key()},
        {"$set": {"water_glasses": 0, "calories_consumed": 0, "meals": []}},
        upsert=True,
    )
    return {"ok": True}


# ----------------------- AI Chat (Coach) -----------------------
@api_router.post("/coach/chat")
async def coach_chat(req: ChatRequest, user: dict = Depends(require_active_subscription)):
    session_id = req.session_id or f"coach-{user['id']}"
    plan = await db.plans.find_one({"user_id": user["id"]}, {"_id": 0})
    plan_context = ""
    if plan:
        q = plan["quiz"]
        plan_context = (
            f"\nUser stats: {q['age']}y {q['gender']}, {q['height_cm']}cm, {q['weight_kg']}kg. "
            f"Goal: {q['goal']}. Activity: {q['activity_level']}. "
            f"Calorie target: {plan['calorie_target']} kcal. Water: {plan['water_target_glasses']} glasses."
        )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=(
            "You are FitLux Coach, a premium personal trainer & nutrition expert. "
            "Be concise, friendly, and motivating. Give practical, science-based advice. "
            "Keep replies under 150 words unless detail is requested."
            + plan_context
        ),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    response = await chat.send_message(UserMessage(text=req.message))

    await db.chat_messages.insert_many([
        {"user_id": user["id"], "session_id": session_id, "role": "user",
         "text": req.message, "at": datetime.now(timezone.utc).isoformat()},
        {"user_id": user["id"], "session_id": session_id, "role": "assistant",
         "text": response, "at": datetime.now(timezone.utc).isoformat()},
    ])
    return {"reply": response, "session_id": session_id}


@api_router.get("/coach/history")
async def coach_history(user: dict = Depends(get_current_user)):
    session_id = f"coach-{user['id']}"
    msgs = await db.chat_messages.find(
        {"user_id": user["id"], "session_id": session_id}, {"_id": 0}
    ).sort("at", 1).to_list(200)
    return {"messages": msgs}


# ----------------------- Products & Amazon Affiliate -----------------------
AMAZON_DOMAINS = {
    "US": "amazon.com",
    "UK": "amazon.co.uk",
    "IN": "amazon.in",
    "CA": "amazon.ca",
    "DE": "amazon.de",
}


def amazon_tag(region: str) -> str:
    return os.environ.get(f"AMAZON_TAG_{region}", os.environ.get("AMAZON_TAG_US", "fitlux-20"))


def build_amazon_url(region: str, asin: Optional[str], keywords: str) -> str:
    from urllib.parse import quote
    region = region if region in AMAZON_DOMAINS else "US"
    domain = AMAZON_DOMAINS[region]
    tag = amazon_tag(region)
    if asin:
        return f"https://www.{domain}/dp/{asin}?tag={tag}"
    return f"https://www.{domain}/s?k={quote(keywords)}&tag={tag}"


# Each product has search keywords and (optional) US ASIN. ASIN stays the same
# across Amazon regions for the same listing in most cases; if a region has no
# listing, we fall back to a keyword search.
SEED_PRODUCTS = [
    {
        "id": "p-protein",
        "name": "Gold Whey Protein",
        "tagline": "25g premium whey isolate",
        "description": "Fast-absorbing whey protein isolate to fuel recovery and lean muscle growth. Ultra-filtered, low lactose, 25g protein per scoop.",
        "price": "$49.99",
        "category": "Protein",
        "image": "https://images.pexels.com/photos/29107585/pexels-photo-29107585.jpeg",
        "asin": "B000QSNYGI",  # Optimum Nutrition Gold Standard Whey 5lb
        "search": "Optimum Nutrition Gold Standard Whey Protein 5lb",
        "benefits": ["Lean muscle growth", "Fast recovery", "Low lactose"],
    },
    {
        "id": "p-shilajit",
        "name": "Pure Himalayan Shilajit",
        "tagline": "Ancient mineral resin",
        "description": "Authentic high-altitude shilajit packed with fulvic acid, trace minerals and antioxidants for energy, vitality and stamina.",
        "price": "$34.99",
        "category": "Vitality",
        "image": "https://images.pexels.com/photos/29107657/pexels-photo-29107657.jpeg",
        "asin": None,
        "search": "Pure Himalayan Shilajit Resin authentic",
        "benefits": ["Energy & stamina", "Mineral rich", "Antioxidant"],
    },
    {
        "id": "p-creatine",
        "name": "Creatine Monohydrate",
        "tagline": "5g micronized — unflavoured",
        "description": "The most studied supplement on the planet. Increases strength, power output and muscle volume.",
        "price": "$24.99",
        "category": "Performance",
        "image": "https://images.pexels.com/photos/14963236/pexels-photo-14963236.jpeg",
        "asin": None,
        "search": "Optimum Nutrition Creatine Monohydrate Powder Unflavored",
        "benefits": ["More strength", "Bigger pumps", "Faster recovery"],
    },
    {
        "id": "p-multi",
        "name": "Daily Multivitamin",
        "tagline": "Complete A–Z formula",
        "description": "Comprehensive blend of essential vitamins and minerals to fill nutritional gaps and support immunity and energy.",
        "price": "$19.99",
        "category": "Wellness",
        "image": "https://images.pexels.com/photos/29107657/pexels-photo-29107657.jpeg",
        "asin": None,
        "search": "Centrum Adult Multivitamin",
        "benefits": ["Daily nutrition", "Immunity", "Energy"],
    },
    {
        "id": "p-omega",
        "name": "Omega-3 Fish Oil",
        "tagline": "1200mg EPA+DHA",
        "description": "Premium triglyceride-form omega-3 for heart, brain and joint health. Burpless and lemon-flavoured.",
        "price": "$22.99",
        "category": "Wellness",
        "image": "https://images.pexels.com/photos/29107585/pexels-photo-29107585.jpeg",
        "asin": None,
        "search": "Nordic Naturals Ultimate Omega 1280mg",
        "benefits": ["Heart health", "Brain function", "Joint support"],
    },
    {
        "id": "p-bcaa",
        "name": "BCAA Recovery",
        "tagline": "2:1:1 ratio • 7g per scoop",
        "description": "Branched-chain amino acids to reduce soreness, support recovery and preserve muscle during intense training.",
        "price": "$29.99",
        "category": "Performance",
        "image": "https://images.pexels.com/photos/14963236/pexels-photo-14963236.jpeg",
        "asin": None,
        "search": "Scivation Xtend BCAA powder 30 servings",
        "benefits": ["Less soreness", "Faster recovery", "Endurance"],
    },
]


@api_router.get("/products")
async def list_products(region: str = "US"):
    region = (region or "US").upper()
    products = []
    for p in SEED_PRODUCTS:
        out = {k: v for k, v in p.items() if k != "asin" and k != "search"}
        out["buy_url"] = build_amazon_url(region, p.get("asin"), p["search"])
        products.append(out)
    return {
        "products": products,
        "region": region if region in AMAZON_DOMAINS else "US",
        "supported_regions": list(AMAZON_DOMAINS.keys()),
        "disclosure": "As an Amazon Associate FitLux earns from qualifying purchases.",
    }

# ----------------------- Stripe Subscriptions (access-window model) -----------------------
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest,
)

STRIPE_API_KEY_ENV = os.environ["STRIPE_API_KEY"]

SUBSCRIPTION_PACKAGES: Dict[str, Dict[str, Any]] = {
    "monthly": {"amount": 9.99, "currency": "usd", "days": 30,
                "label": "FitLux Premium — 1 month"},
    "yearly":  {"amount": 95.99, "currency": "usd", "days": 365,
                "label": "FitLux Premium — 12 months (20% off)"},
}
COMMISSION_EUR = float(os.environ.get("INFLUENCER_COMMISSION_EUR", "1.00"))


class CheckoutRequest(BaseModel):
    plan: str
    origin: str
    promo_code: Optional[str] = None


class PromoCodeCreate(BaseModel):
    code: str
    influencer_name: str
    influencer_email: EmailStr
    discount_percent: int = 10
    commission_eur: float = COMMISSION_EUR


def _get_stripe_checkout(http_request: Request) -> StripeCheckout:
    host = str(http_request.base_url).rstrip("/")
    return StripeCheckout(api_key=STRIPE_API_KEY_ENV, webhook_url=f"{host}/api/webhook/stripe")


async def _resolve_promo(code: str) -> Optional[dict]:
    if not code:
        return None
    return await db.promo_codes.find_one(
        {"code": code.upper(), "active": True}, {"_id": 0}
    )


@api_router.get("/subscription/plans")
async def list_plans():
    return {"plans": [
        {"id": "monthly", "label": "Monthly", "amount_usd": 9.99,
         "billing": "Pay once for 30 days · cancel anytime"},
        {"id": "yearly", "label": "Yearly", "amount_usd": 95.99,
         "billing": "Pay once for 365 days · 20% off vs monthly"},
    ]}


@api_router.get("/subscription/status")
async def subscription_status_endpoint(user: dict = Depends(get_current_user)):
    sub = await db.subscriptions.find_one({"user_id": user["id"]}, {"_id": 0})
    if not sub:
        return {"active": user.get("role") == "admin", "plan": None, "access_until": None}
    until = sub.get("access_until")
    active = bool(until and datetime.now(timezone.utc) < datetime.fromisoformat(until))
    return {"active": active or user.get("role") == "admin",
            "plan": sub.get("plan"), "access_until": until}


@api_router.post("/subscription/promo/validate")
async def validate_promo(req: dict, user: dict = Depends(get_current_user)):
    code = (req.get("code") or "").upper().strip()
    pc = await _resolve_promo(code)
    if not pc:
        return {"valid": False}
    return {"valid": True, "code": pc["code"], "discount_percent": pc["discount_percent"]}


@api_router.post("/subscription/checkout")
async def create_subscription_checkout(req: CheckoutRequest, http_request: Request,
                                       user: dict = Depends(get_current_user)):
    if req.plan not in SUBSCRIPTION_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid plan")
    pkg = SUBSCRIPTION_PACKAGES[req.plan]
    amount = float(pkg["amount"])
    promo = await _resolve_promo(req.promo_code or "")
    if promo:
        amount = round(amount * (1 - promo["discount_percent"] / 100.0), 2)

    origin = req.origin.rstrip("/")
    success_url = f"{origin}/subscription-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/paywall"

    metadata = {
        "user_id": user["id"], "user_email": user["email"],
        "plan": req.plan, "days": str(pkg["days"]),
        "promo_code": (promo["code"] if promo else ""),
        "influencer_id": (promo["influencer_id"] if promo else ""),
        "commission_eur": str(promo["commission_eur"]) if promo else "0",
    }

    checkout = _get_stripe_checkout(http_request)
    session = await checkout.create_checkout_session(CheckoutSessionRequest(
        amount=amount, currency=pkg["currency"],
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
    ))

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["id"], "plan": req.plan,
        "amount": amount, "currency": pkg["currency"],
        "metadata": metadata,
        "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


async def _grant_access(user_id: str, plan: str, days: int, session_id: str):
    existing = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    now = datetime.now(timezone.utc)
    if existing and existing.get("last_session_id") == session_id:
        return
    base = now
    if existing and existing.get("access_until"):
        cur = datetime.fromisoformat(existing["access_until"])
        if cur > now:
            base = cur
    new_until = base + timedelta(days=days)
    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id, "plan": plan,
            "access_until": new_until.isoformat(),
            "last_session_id": session_id,
            "updated_at": now.isoformat(),
        }},
        upsert=True,
    )


async def _credit_influencer(metadata: dict, user_id: str, session_id: str):
    influencer_id = metadata.get("influencer_id")
    if not influencer_id:
        return
    if await db.influencer_earnings.find_one({"session_id": session_id}):
        return
    amount = float(metadata.get("commission_eur", "0") or 0)
    await db.influencer_earnings.insert_one({
        "influencer_id": influencer_id, "user_id": user_id,
        "promo_code": metadata.get("promo_code"),
        "amount_eur": amount, "session_id": session_id,
        "status": "pending",
        "earned_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.influencers.update_one(
        {"id": influencer_id},
        {"$inc": {"pending_eur": amount, "total_signups": 1}},
    )


@api_router.get("/subscription/checkout/status/{session_id}")
async def checkout_status_endpoint(session_id: str, http_request: Request,
                                   user: dict = Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx or tx["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Session not found")
    checkout = _get_stripe_checkout(http_request)
    status = await checkout.get_checkout_status(session_id)
    payment_status = status.payment_status
    new_status = "paid" if payment_status == "paid" else status.status
    if tx["payment_status"] != "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": new_status, "payment_status": payment_status}},
        )
        if payment_status == "paid":
            md = tx.get("metadata") or {}
            await _grant_access(user["id"], md.get("plan", "monthly"),
                                int(md.get("days", "30")), session_id)
            await _credit_influencer(md, user["id"], session_id)
    return {"status": new_status, "payment_status": payment_status,
            "subscription": await subscription_status_endpoint(user)}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    checkout = _get_stripe_checkout(request)
    try:
        evt = await checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.error(f"webhook decode failed: {e}")
        return {"received": False}
    if evt.payment_status == "paid" and evt.session_id:
        tx = await db.payment_transactions.find_one({"session_id": evt.session_id}, {"_id": 0})
        if tx and tx["payment_status"] != "paid":
            await db.payment_transactions.update_one(
                {"session_id": evt.session_id},
                {"$set": {"status": "paid", "payment_status": "paid"}},
            )
            md = tx.get("metadata") or {}
            await _grant_access(tx["user_id"], md.get("plan", "monthly"),
                                int(md.get("days", "30")), evt.session_id)
            await _credit_influencer(md, tx["user_id"], evt.session_id)
    return {"received": True}


# ----- Promo / Influencer admin endpoints -----
async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@api_router.post("/admin/promo-codes")
async def create_promo_code(req: PromoCodeCreate, user: dict = Depends(require_admin)):
    influencer = await db.influencers.find_one({"email": req.influencer_email.lower()}, {"_id": 0})
    if not influencer:
        influencer = {
            "id": str(uuid.uuid4()),
            "name": req.influencer_name,
            "email": req.influencer_email.lower(),
            "pending_eur": 0.0, "paid_eur": 0.0, "total_signups": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.influencers.insert_one(influencer)
    doc = {
        "code": req.code.upper(),
        "influencer_id": influencer["id"],
        "influencer_name": req.influencer_name,
        "discount_percent": req.discount_percent,
        "commission_eur": req.commission_eur,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.promo_codes.update_one(
        {"code": req.code.upper()}, {"$set": doc}, upsert=True
    )
    return {"promo_code": doc, "influencer": {k: v for k, v in influencer.items() if k != "_id"}}


@api_router.get("/admin/promo-codes")
async def list_promo_codes(user: dict = Depends(require_admin)):
    return {"codes": await db.promo_codes.find({}, {"_id": 0}).to_list(200)}


@api_router.get("/admin/influencers")
async def list_influencers(user: dict = Depends(require_admin)):
    return {"influencers": await db.influencers.find({}, {"_id": 0}).to_list(200)}


@api_router.get("/admin/influencer-earnings")
async def list_earnings(user: dict = Depends(require_admin)):
    return {"earnings": await db.influencer_earnings.find({}, {"_id": 0}).sort("earned_at", -1).to_list(500)}


class PromoCodeUpdate(BaseModel):
    active: Optional[bool] = None
    discount_percent: Optional[int] = None
    commission_eur: Optional[float] = None
    influencer_name: Optional[str] = None


@api_router.patch("/admin/promo-codes/{code}")
async def update_promo_code(code: str, req: PromoCodeUpdate,
                            user: dict = Depends(require_admin)):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.promo_codes.update_one(
        {"code": code.upper()}, {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    doc = await db.promo_codes.find_one({"code": code.upper()}, {"_id": 0})
    return {"promo_code": doc}


@api_router.delete("/admin/promo-codes/{code}")
async def delete_promo_code(code: str, user: dict = Depends(require_admin)):
    res = await db.promo_codes.delete_one({"code": code.upper()})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    return {"deleted": True}


@api_router.post("/admin/influencers/{influencer_id}/payout")
async def mark_influencer_paid(influencer_id: str,
                                user: dict = Depends(require_admin)):
    """Mark all pending earnings for an influencer as paid, move balance to paid_eur."""
    inf = await db.influencers.find_one({"id": influencer_id}, {"_id": 0})
    if not inf:
        raise HTTPException(status_code=404, detail="Influencer not found")
    pending = float(inf.get("pending_eur", 0) or 0)
    if pending <= 0:
        return {"influencer": inf, "paid_amount_eur": 0}
    now = datetime.now(timezone.utc).isoformat()
    await db.influencer_earnings.update_many(
        {"influencer_id": influencer_id, "status": "pending"},
        {"$set": {"status": "paid", "paid_at": now}},
    )
    await db.influencers.update_one(
        {"id": influencer_id},
        {"$set": {"pending_eur": 0.0, "last_payout_at": now},
         "$inc": {"paid_eur": pending}},
    )
    updated = await db.influencers.find_one({"id": influencer_id}, {"_id": 0})
    return {"influencer": updated, "paid_amount_eur": pending}


@api_router.get("/admin/metrics")
async def admin_metrics(user: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    now_iso = datetime.now(timezone.utc).isoformat()
    active_subs = await db.subscriptions.count_documents({"access_until": {"$gt": now_iso}})

    paid_cursor = db.payment_transactions.find({"payment_status": "paid"}, {"_id": 0, "amount": 1, "currency": 1})
    total_paid_usd = 0.0
    paid_count = 0
    async for tx in paid_cursor:
        paid_count += 1
        if (tx.get("currency") or "usd").lower() == "usd":
            total_paid_usd += float(tx.get("amount") or 0)

    promo_total = await db.promo_codes.count_documents({})
    promo_active = await db.promo_codes.count_documents({"active": True})

    # Sum influencer pending/paid
    pending_sum = 0.0
    paid_sum = 0.0
    signups_sum = 0
    async for inf in db.influencers.find({}, {"_id": 0}):
        pending_sum += float(inf.get("pending_eur", 0) or 0)
        paid_sum += float(inf.get("paid_eur", 0) or 0)
        signups_sum += int(inf.get("total_signups", 0) or 0)

    return {
        "total_users": total_users,
        "active_subscriptions": active_subs,
        "total_revenue_usd": round(total_paid_usd, 2),
        "paid_transactions": paid_count,
        "promo_codes_total": promo_total,
        "promo_codes_active": promo_active,
        "influencer_signups": signups_sum,
        "influencer_pending_eur": round(pending_sum, 2),
        "influencer_paid_eur": round(paid_sum, 2),
    }




@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.plans.create_index("user_id", unique=True)
    await db.daily_logs.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.subscriptions.create_index("user_id", unique=True)
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.promo_codes.create_index("code", unique=True)
    await db.influencers.create_index("email", unique=True)

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pwd = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Admin",
            "password_hash": hash_password(admin_pwd),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "has_completed_quiz": False,
        })
        logger.info("Admin user seeded")
    elif not verify_password(admin_pwd, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                   {"$set": {"password_hash": hash_password(admin_pwd)}})

    # Promote additional admin emails (comma-separated) to role=admin
    extra = os.environ.get("ADMIN_EMAILS", "")
    for em in [e.strip().lower() for e in extra.split(",") if e.strip()]:
        res = await db.users.update_one({"email": em}, {"$set": {"role": "admin"}})
        if res.matched_count:
            logger.info(f"Promoted {em} to admin")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@api_router.get("/")
async def root():
    return {"message": "FitLux API", "status": "ok"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
