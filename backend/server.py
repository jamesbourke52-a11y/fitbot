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


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class WaterLogRequest(BaseModel):
    glasses: int = 1


class CalorieLogRequest(BaseModel):
    meal_name: str
    calories: int


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

    prompt = (
        f"Create a personalized fitness plan for {user_name}.\n"
        f"Age: {quiz['age']} | Gender: {quiz['gender']}\n"
        f"Height: {quiz['height_cm']}cm | Weight: {quiz['weight_kg']}kg\n"
        f"Goal: {quiz['goal']}\n"
        f"Activity level: {quiz['activity_level']}\n"
        f"Workout days/week: {quiz['workout_days_per_week']}\n"
        f"Diet: {quiz['diet_preference']}\n"
        f"Wake: {quiz['wake_time']} | Sleep: {quiz['sleep_time']}"
    )
    response = await chat.send_message(UserMessage(text=prompt))
    return response


def build_reminders(quiz: dict) -> List[Dict[str, str]]:
    wake = quiz["wake_time"]
    sleep = quiz["sleep_time"]

    def add_minutes(hhmm: str, minutes: int) -> str:
        h, m = map(int, hhmm.split(":"))
        total = (h * 60 + m + minutes) % (24 * 60)
        return f"{total // 60:02d}:{total % 60:02d}"

    workout_time = add_minutes(wake, 60)
    return [
        {"id": "wake", "label": "Wake up & hydrate", "time": wake, "icon": "sun"},
        {"id": "breakfast", "label": "Breakfast", "time": add_minutes(wake, 30), "icon": "coffee"},
        {"id": "workout", "label": "Workout session", "time": workout_time, "icon": "dumbbell"},
        {"id": "lunch", "label": "Lunch", "time": "13:00", "icon": "utensils"},
        {"id": "snack", "label": "Hydration check", "time": "16:00", "icon": "droplet"},
        {"id": "dinner", "label": "Dinner", "time": "19:30", "icon": "utensils"},
        {"id": "sleep", "label": "Wind down & sleep", "time": sleep, "icon": "moon"},
    ]


@api_router.post("/quiz/submit")
async def submit_quiz(quiz: QuizSubmission, user: dict = Depends(get_current_user)):
    quiz_dict = quiz.model_dump()
    plan_text = await generate_ai_plan(quiz_dict, user["name"])
    calorie_target = calc_calorie_target(quiz_dict)
    water_glasses = calc_water_glasses(quiz_dict["weight_kg"])
    reminders = build_reminders(quiz_dict)

    plan_doc = {
        "user_id": user["id"],
        "quiz": quiz_dict,
        "plan_text": plan_text,
        "calorie_target": calorie_target,
        "water_target_glasses": water_glasses,
        "reminders": reminders,
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
    return plan


# ----------------------- Daily tracker -----------------------
def today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@api_router.get("/tracker/today")
async def get_today(user: dict = Depends(get_current_user)):
    plan = await db.plans.find_one({"user_id": user["id"]}, {"_id": 0})
    log = await db.daily_logs.find_one(
        {"user_id": user["id"], "date": today_key()}, {"_id": 0}
    ) or {"water_glasses": 0, "calories_consumed": 0, "meals": []}
    return {
        "date": today_key(),
        "water_glasses": log.get("water_glasses", 0),
        "water_target": plan["water_target_glasses"] if plan else 8,
        "calories_consumed": log.get("calories_consumed", 0),
        "calorie_target": plan["calorie_target"] if plan else 2000,
        "meals": log.get("meals", []),
        "reminders": plan["reminders"] if plan else [],
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
async def coach_chat(req: ChatRequest, user: dict = Depends(get_current_user)):
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


# ----------------------- Products -----------------------
SEED_PRODUCTS = [
    {
        "id": "p-protein",
        "name": "Gold Whey Protein",
        "tagline": "25g premium whey isolate",
        "description": "Fast-absorbing whey protein isolate to fuel recovery and lean muscle growth. Ultra-filtered, low lactose, 25g protein per scoop.",
        "price": "$49.99",
        "category": "Protein",
        "image": "https://images.pexels.com/photos/29107585/pexels-photo-29107585.jpeg",
        "buy_url": "https://www.amazon.com/s?k=whey+protein",
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
        "buy_url": "https://www.amazon.com/s?k=shilajit",
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
        "buy_url": "https://www.amazon.com/s?k=creatine+monohydrate",
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
        "buy_url": "https://www.amazon.com/s?k=multivitamin",
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
        "buy_url": "https://www.amazon.com/s?k=omega+3+fish+oil",
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
        "buy_url": "https://www.amazon.com/s?k=bcaa",
        "benefits": ["Less soreness", "Faster recovery", "Endurance"],
    },
]


@api_router.get("/products")
async def list_products():
    return {"products": SEED_PRODUCTS}


# ----------------------- Startup -----------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.plans.create_index("user_id", unique=True)
    await db.daily_logs.create_index([("user_id", 1), ("date", 1)], unique=True)

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
