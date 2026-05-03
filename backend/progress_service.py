"""FitLux progress + gamification service."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
import uuid

# ---------------- Levels (gamified difficulty ranks) ----------------
LEVELS = [
    {"id": 1, "slug": "rookie",   "name": "Rookie",    "emoji": "🥚",
     "min_xp": 0,    "desc": "Getting started. Light sessions, tons of mobility.",
     "intensity": 1, "color": "#9CA3AF"},
    {"id": 2, "slug": "novice",   "name": "Novice",    "emoji": "🐣",
     "min_xp": 100,  "desc": "You've got the habit. Add weight, keep form.",
     "intensity": 2, "color": "#60A5FA"},
    {"id": 3, "slug": "athlete",  "name": "Athlete",   "emoji": "💪",
     "min_xp": 300,  "desc": "Real training. Progressive overload every week.",
     "intensity": 3, "color": "#22D3EE"},
    {"id": 4, "slug": "warrior",  "name": "Warrior",   "emoji": "⚔️",
     "min_xp": 700,  "desc": "Serious work capacity. Long sessions, heavier loads.",
     "intensity": 4, "color": "#34D399"},
    {"id": 5, "slug": "beast",    "name": "Beast",     "emoji": "🦍",
     "min_xp": 1500, "desc": "Genuine strength. Advanced splits, brutal volume.",
     "intensity": 5, "color": "#F59E0B"},
    {"id": 6, "slug": "titan",    "name": "Titan",     "emoji": "🦖",
     "min_xp": 3000, "desc": "Elite territory. Intensity techniques, max effort.",
     "intensity": 6, "color": "#EF4444"},
    {"id": 7, "slug": "legend",   "name": "Legend",    "emoji": "👑",
     "min_xp": 6000, "desc": "Legendary discipline. Peak performance programming.",
     "intensity": 7, "color": "#A78BFA"},
    {"id": 8, "slug": "extreme",  "name": "EXTREME",   "emoji": "🔥",
     "min_xp": 12000,"desc": "The final form. Only the relentless make it here.",
     "intensity": 10, "color": "#D4A54C"},
]


def level_for_xp(xp: int) -> dict:
    current = LEVELS[0]
    for lv in LEVELS:
        if xp >= lv["min_xp"]:
            current = lv
        else:
            break
    return current


# ---------------- Level-specific prescribed training ----------------
# Key lifts: % of bodyweight × reps (per working set). Accessories use fixed reps.
# "sets" applies to all exercises at that level.
LEVEL_PROGRAMMING = {
    1: {  # Rookie
        "sets": 3,
        "key_lifts": [
            {"id": "bench",    "name": "Bench press",      "bw_pct": 40, "reps": 8},
            {"id": "squat",    "name": "Back squat",       "bw_pct": 50, "reps": 10},
            {"id": "deadlift", "name": "Deadlift",         "bw_pct": 60, "reps": 8},
            {"id": "ohp",      "name": "Overhead press",   "bw_pct": 30, "reps": 8},
        ],
        "accessories": [
            {"id": "pushup",   "name": "Push-ups",         "reps": 8},
            {"id": "row",      "name": "Seated row",       "reps": 10},
            {"id": "plank_s",  "name": "Plank (seconds)",  "reps": 20},
        ],
    },
    2: {"sets": 3, "key_lifts": [
        {"id": "bench",    "name": "Bench press",      "bw_pct": 55, "reps": 8},
        {"id": "squat",    "name": "Back squat",       "bw_pct": 70, "reps": 10},
        {"id": "deadlift", "name": "Deadlift",         "bw_pct": 80, "reps": 8},
        {"id": "ohp",      "name": "Overhead press",   "bw_pct": 40, "reps": 8},
    ], "accessories": [
        {"id": "pullup",   "name": "Pull-ups",         "reps": 5},
        {"id": "dip",      "name": "Dips",             "reps": 8},
        {"id": "plank_s",  "name": "Plank (seconds)",  "reps": 40},
    ]},
    3: {"sets": 4, "key_lifts": [
        {"id": "bench",    "name": "Bench press",      "bw_pct": 70, "reps": 6},
        {"id": "squat",    "name": "Back squat",       "bw_pct": 90, "reps": 8},
        {"id": "deadlift", "name": "Deadlift",         "bw_pct": 100, "reps": 6},
        {"id": "ohp",      "name": "Overhead press",   "bw_pct": 50, "reps": 6},
    ], "accessories": [
        {"id": "pullup",   "name": "Pull-ups",         "reps": 8},
        {"id": "dip",      "name": "Dips",             "reps": 12},
        {"id": "chinup",   "name": "Chin-ups",         "reps": 8},
    ]},
    4: {"sets": 4, "key_lifts": [
        {"id": "bench",    "name": "Bench press",      "bw_pct": 85, "reps": 5},
        {"id": "squat",    "name": "Back squat",       "bw_pct": 110, "reps": 6},
        {"id": "deadlift", "name": "Deadlift",         "bw_pct": 130, "reps": 5},
        {"id": "ohp",      "name": "Overhead press",   "bw_pct": 60, "reps": 6},
    ], "accessories": [
        {"id": "pullup",   "name": "Weighted pull-ups","reps": 6},
        {"id": "dip",      "name": "Weighted dips",    "reps": 8},
        {"id": "muscleup", "name": "Muscle-ups",       "reps": 3},
    ]},
    5: {"sets": 5, "key_lifts": [
        {"id": "bench",    "name": "Bench press",      "bw_pct": 100, "reps": 5},
        {"id": "squat",    "name": "Back squat",       "bw_pct": 130, "reps": 5},
        {"id": "deadlift", "name": "Deadlift",         "bw_pct": 150, "reps": 5},
        {"id": "ohp",      "name": "Overhead press",   "bw_pct": 70, "reps": 5},
    ], "accessories": [
        {"id": "pullup",   "name": "Weighted pull-ups","reps": 8},
        {"id": "dip",      "name": "Weighted dips",    "reps": 10},
        {"id": "muscleup", "name": "Muscle-ups",       "reps": 5},
    ]},
    6: {"sets": 5, "key_lifts": [
        {"id": "bench",    "name": "Bench press",      "bw_pct": 115, "reps": 4},
        {"id": "squat",    "name": "Back squat",       "bw_pct": 150, "reps": 4},
        {"id": "deadlift", "name": "Deadlift",         "bw_pct": 175, "reps": 4},
        {"id": "ohp",      "name": "Overhead press",   "bw_pct": 80, "reps": 5},
    ], "accessories": [
        {"id": "pullup",   "name": "Weighted pull-ups","reps": 10},
        {"id": "dip",      "name": "Weighted dips",    "reps": 12},
        {"id": "hspu",     "name": "Handstand push-ups","reps": 5},
    ]},
    7: {"sets": 6, "key_lifts": [
        {"id": "bench",    "name": "Bench press",      "bw_pct": 130, "reps": 3},
        {"id": "squat",    "name": "Back squat",       "bw_pct": 170, "reps": 3},
        {"id": "deadlift", "name": "Deadlift",         "bw_pct": 200, "reps": 3},
        {"id": "ohp",      "name": "Overhead press",   "bw_pct": 95, "reps": 4},
    ], "accessories": [
        {"id": "pullup",   "name": "Weighted pull-ups","reps": 12},
        {"id": "olc",      "name": "One-arm chin-up",  "reps": 1},
        {"id": "hspu",     "name": "Handstand push-ups","reps": 8},
    ]},
    8: {"sets": 6, "key_lifts": [
        {"id": "bench",    "name": "Bench press",      "bw_pct": 150, "reps": 2},
        {"id": "squat",    "name": "Back squat",       "bw_pct": 200, "reps": 2},
        {"id": "deadlift", "name": "Deadlift",         "bw_pct": 225, "reps": 2},
        {"id": "ohp",      "name": "Overhead press",   "bw_pct": 110, "reps": 3},
    ], "accessories": [
        {"id": "pullup",   "name": "Weighted pull-ups","reps": 15},
        {"id": "olc",      "name": "One-arm chin-up",  "reps": 3},
        {"id": "hspu",     "name": "Strict HSPU",      "reps": 10},
    ]},
}


def build_prescription(level_id: int, bodyweight_kg: float, adjust: float = 1.0, unit: str = "metric") -> dict:
    """Return the prescribed weights/reps for a user at a given level + adjust factor."""
    prog = LEVEL_PROGRAMMING.get(level_id, LEVEL_PROGRAMMING[1])
    factor = max(0.6, min(1.6, adjust))
    key_lifts = []
    for lift in prog["key_lifts"]:
        kg = bodyweight_kg * (lift["bw_pct"] / 100.0) * factor
        weight_display = round(kg * 2.2046226, 1) if unit == "imperial" else round(kg, 1)
        # Round to nearest 2.5kg / 5lb for realistic plate loading
        step = 5.0 if unit == "imperial" else 2.5
        weight_display = round(weight_display / step) * step
        key_lifts.append({
            "id": lift["id"], "name": lift["name"],
            "sets": prog["sets"],
            "reps": max(1, int(round(lift["reps"] * (2 - factor)))),  # easier → more reps, harder → fewer
            "weight_display": weight_display,
            "weight_unit": "lb" if unit == "imperial" else "kg",
            "bw_pct": lift["bw_pct"],
        })
    accessories = [
        {**a, "sets": prog["sets"],
         "reps": max(1, int(round(a["reps"] * (2 - factor))))}
        for a in prog["accessories"]
    ]
    return {
        "level_id": level_id,
        "sets": prog["sets"],
        "key_lifts": key_lifts,
        "accessories": accessories,
        "adjustment_factor": round(factor, 3),
    }


def next_level(lv: dict) -> Optional[dict]:
    for i, x in enumerate(LEVELS):
        if x["id"] == lv["id"] and i + 1 < len(LEVELS):
            return LEVELS[i + 1]
    return None


# ---------------- Default measurement fields ----------------
MEASUREMENT_FIELDS = [
    "neck", "shoulders", "chest", "left_arm", "right_arm",
    "waist", "hips", "left_thigh", "right_thigh", "left_calf", "right_calf",
]


def kg_to_lb(kg: float) -> float:
    return round(kg * 2.2046226, 1)


def lb_to_kg(lb: float) -> float:
    return round(lb / 2.2046226, 2)


def cm_to_in(cm: float) -> float:
    return round(cm * 0.3937008, 1)


def in_to_cm(inches: float) -> float:
    return round(inches / 0.3937008, 1)


def _normalize_weight_kg(value: float, unit: str) -> float:
    return lb_to_kg(value) if unit == "imperial" else float(value)


def _normalize_length_cm(value: float, unit: str) -> float:
    return in_to_cm(value) if unit == "imperial" else float(value)


def to_display(stored_kg: Optional[float], stored_cm_fields: Optional[dict], unit: str) -> dict:
    out: dict = {}
    if stored_kg is not None:
        out["weight"] = kg_to_lb(stored_kg) if unit == "imperial" else round(stored_kg, 2)
    if stored_cm_fields:
        out.update({
            k: (cm_to_in(v) if unit == "imperial" else round(v, 1))
            for k, v in stored_cm_fields.items() if v is not None
        })
    return out


# ---------------- Experience assessment ----------------
# 5 questions, each with 5 choices scoring 0..4. Total 0-20, mapped to a
# starting level. EXTREME (rank 8) is NOT assignable by the quiz — it must
# be earned through XP.
LEVEL_QUIZ = [
    {
        "id": "experience",
        "question": "How long have you been training consistently?",
        "options": [
            {"label": "Never — I'm brand new",            "score": 0},
            {"label": "Less than 6 months",               "score": 1},
            {"label": "6 months to 2 years",              "score": 2},
            {"label": "2 to 5 years",                     "score": 3},
            {"label": "5+ years · serious lifter",        "score": 4},
        ],
    },
    {
        "id": "frequency",
        "question": "How many workouts do you currently do per week?",
        "options": [
            {"label": "0 — starting fresh",               "score": 0},
            {"label": "1-2 · casual",                     "score": 1},
            {"label": "3-4 · regular",                    "score": 2},
            {"label": "5 · dedicated",                    "score": 3},
            {"label": "6+ · training every day",          "score": 4},
        ],
    },
    {
        "id": "pullups",
        "question": "How many strict pull-ups can you do in one set?",
        "options": [
            {"label": "None",                             "score": 0},
            {"label": "1 to 5",                           "score": 1},
            {"label": "6 to 12",                          "score": 2},
            {"label": "13 to 20",                         "score": 3},
            {"label": "20+ (with added weight)",          "score": 4},
        ],
    },
    {
        "id": "bench",
        "question": "Heaviest bench press (or similar) for 5 reps?",
        "options": [
            {"label": "I don't bench / bar only",         "score": 0},
            {"label": "Bodyweight × 0.5",                 "score": 1},
            {"label": "Bodyweight × 1.0",                 "score": 2},
            {"label": "Bodyweight × 1.3",                 "score": 3},
            {"label": "Bodyweight × 1.5 or more",         "score": 4},
        ],
    },
    {
        "id": "recovery",
        "question": "After a hard workout, how do you feel?",
        "options": [
            {"label": "Wrecked for 3-4 days",             "score": 0},
            {"label": "Sore for 2-3 days",                "score": 1},
            {"label": "Mild DOMS next day",               "score": 2},
            {"label": "Barely sore — ready again fast",   "score": 3},
            {"label": "Full recovery within hours",       "score": 4},
        ],
    },
]

# Total score → level id mapping. Assessment cap is 7 (Legend).
# EXTREME (8) must still be earned through XP.
def assess_level_id(total_score: int) -> int:
    if total_score <= 2:   return 1   # Rookie
    if total_score <= 5:   return 2   # Novice
    if total_score <= 9:   return 3   # Athlete
    if total_score <= 12:  return 4   # Warrior
    if total_score <= 15:  return 5   # Beast
    if total_score <= 18:  return 6   # Titan
    return 7                           # Legend


# ---------------- XP awarding ----------------
XP_RULES = {
    "workout_completed": 25,
    "measurement_logged": 10,
    "photo_uploaded": 15,
    "strength_pr": 50,
    "daily_login": 5,
}


async def award_xp(db, user_id: str, reason: str, points: Optional[int] = None) -> dict:
    if points is None:
        points = XP_RULES.get(reason, 0)
    if points <= 0:
        return {"xp_delta": 0}
    now = datetime.now(timezone.utc).isoformat()
    await db.xp_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id, "reason": reason, "points": points, "at": now,
    })
    res = await db.user_levels.find_one_and_update(
        {"user_id": user_id},
        {"$inc": {"xp": points, "events": 1},
         "$setOnInsert": {"user_id": user_id, "starting_level": 1,
                          "created_at": now},
         "$set": {"last_event_at": now}},
        upsert=True, return_document=True,
    ) or {}
    # Motor's find_one_and_update returns pre-update doc by default in older versions
    updated = await db.user_levels.find_one({"user_id": user_id}, {"_id": 0})
    xp = updated.get("xp", points)
    lv = level_for_xp(xp)
    nxt = next_level(lv)
    progress_pct = 100 if not nxt else int(100 * (xp - lv["min_xp"]) / (nxt["min_xp"] - lv["min_xp"]))
    return {"xp_delta": points, "total_xp": xp, "level": lv,
            "next_level": nxt, "progress_pct": progress_pct}
