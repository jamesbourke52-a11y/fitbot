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


# ---------------- XP awarding ----------------
# Actions that grant XP:
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
