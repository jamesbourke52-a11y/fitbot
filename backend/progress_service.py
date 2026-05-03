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
# Each workout style has its own 8-level ladder. Exercises with `bodyweight=True`
# are shown as reps-only (no weight calculation). Weighted lifts use `bw_pct` of
# the user's bodyweight × an adjust factor.
_GYM_PROGRAMMING = {
    1: {"sets": 3, "key_lifts": [
        {"id": "bench",    "name": "Bench press",      "bw_pct": 40, "reps": 8},
        {"id": "squat",    "name": "Back squat",       "bw_pct": 50, "reps": 10},
        {"id": "deadlift", "name": "Deadlift",         "bw_pct": 60, "reps": 8},
        {"id": "ohp",      "name": "Overhead press",   "bw_pct": 30, "reps": 8},
    ], "accessories": [
        {"id": "pushup",   "name": "Push-ups",         "reps": 8},
        {"id": "row",      "name": "Seated row",       "reps": 10},
        {"id": "plank_s",  "name": "Plank (seconds)",  "reps": 20},
    ]},
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

# Calisthenics — pure bodyweight progressions (no barbells).
_CAL_PROGRAMMING = {
    1: {"sets": 3, "key_lifts": [
        {"id": "incpush", "name": "Incline push-ups",        "reps": 10, "bodyweight": True},
        {"id": "bwsquat", "name": "Bodyweight squats",       "reps": 15, "bodyweight": True},
        {"id": "asspull", "name": "Assisted pull-ups (band)","reps": 5,  "bodyweight": True},
        {"id": "pike",    "name": "Pike push-ups",            "reps": 6,  "bodyweight": True},
    ], "accessories": [
        {"id": "hipraise","name": "Glute bridges",            "reps": 15},
        {"id": "plank_s", "name": "Plank (seconds)",          "reps": 20},
        {"id": "bwrow",   "name": "Inverted rows",            "reps": 8},
    ]},
    2: {"sets": 3, "key_lifts": [
        {"id": "pushup",  "name": "Full push-ups",            "reps": 12, "bodyweight": True},
        {"id": "airsq",   "name": "Air squats",               "reps": 20, "bodyweight": True},
        {"id": "negpull", "name": "Negative pull-ups (3s)",   "reps": 5,  "bodyweight": True},
        {"id": "pike",    "name": "Pike push-ups",            "reps": 10, "bodyweight": True},
    ], "accessories": [
        {"id": "lunge",   "name": "Walking lunges (each leg)","reps": 10},
        {"id": "plank_s", "name": "Plank (seconds)",          "reps": 40},
        {"id": "bwrow",   "name": "Inverted rows",            "reps": 12},
    ]},
    3: {"sets": 4, "key_lifts": [
        {"id": "diamond", "name": "Diamond push-ups",          "reps": 10, "bodyweight": True},
        {"id": "bulgar",  "name": "Bulgarian split squats",    "reps": 10, "bodyweight": True},
        {"id": "pullup",  "name": "Strict pull-ups",           "reps": 6,  "bodyweight": True},
        {"id": "dip",     "name": "Parallel bar dips",         "reps": 8,  "bodyweight": True},
    ], "accessories": [
        {"id": "lsit_s",  "name": "L-sit hold (seconds)",       "reps": 10},
        {"id": "pistol",  "name": "Assisted pistol squats",     "reps": 5},
        {"id": "pike",    "name": "Pike push-ups",               "reps": 12},
    ]},
    4: {"sets": 4, "key_lifts": [
        {"id": "archpush","name": "Archer push-ups",            "reps": 8,  "bodyweight": True},
        {"id": "pistol",  "name": "Pistol squats (unassisted)", "reps": 5,  "bodyweight": True},
        {"id": "pullup",  "name": "Strict pull-ups",            "reps": 10, "bodyweight": True},
        {"id": "wallHSPU","name": "Wall handstand push-ups",    "reps": 4,  "bodyweight": True},
    ], "accessories": [
        {"id": "dip",     "name": "Parallel bar dips",          "reps": 12},
        {"id": "lsit_s",  "name": "L-sit hold (seconds)",        "reps": 20},
        {"id": "muscleup","name": "Muscle-up progression",      "reps": 3},
    ]},
    5: {"sets": 5, "key_lifts": [
        {"id": "oap",     "name": "One-arm push-up progression","reps": 3,  "bodyweight": True},
        {"id": "pistol",  "name": "Pistol squats",              "reps": 8,  "bodyweight": True},
        {"id": "wpull",   "name": "Weighted pull-ups",          "reps": 6,  "bodyweight": True},
        {"id": "frontlvr","name": "Front lever tuck (seconds)", "reps": 15, "bodyweight": True},
    ], "accessories": [
        {"id": "muscleup","name": "Muscle-ups",                 "reps": 5},
        {"id": "wallHSPU","name": "Wall handstand push-ups",    "reps": 6},
        {"id": "lsit_s",  "name": "L-sit hold (seconds)",        "reps": 30},
    ]},
    6: {"sets": 5, "key_lifts": [
        {"id": "oap",     "name": "One-arm push-ups",           "reps": 5,  "bodyweight": True},
        {"id": "shrimp",  "name": "Shrimp squats",              "reps": 6,  "bodyweight": True},
        {"id": "frontlvr","name": "Front lever (seconds)",       "reps": 10, "bodyweight": True},
        {"id": "hspu",    "name": "Freestanding HSPU",           "reps": 4,  "bodyweight": True},
    ], "accessories": [
        {"id": "humanflag","name": "Human flag progression",    "reps": 3},
        {"id": "planche",  "name": "Planche lean (seconds)",     "reps": 20},
        {"id": "muscleup", "name": "Strict muscle-ups",          "reps": 6},
    ]},
    7: {"sets": 6, "key_lifts": [
        {"id": "oap",     "name": "One-arm push-ups",           "reps": 8,  "bodyweight": True},
        {"id": "oapull",  "name": "One-arm chin-up progression","reps": 2,  "bodyweight": True},
        {"id": "frontlvr","name": "Full front lever (seconds)",  "reps": 15, "bodyweight": True},
        {"id": "planche", "name": "Straddle planche (seconds)",  "reps": 8,  "bodyweight": True},
    ], "accessories": [
        {"id": "humanflag","name": "Human flag (seconds)",      "reps": 8},
        {"id": "hspu",     "name": "Freestanding HSPU",          "reps": 8},
        {"id": "backlvr",  "name": "Back lever (seconds)",        "reps": 10},
    ]},
    8: {"sets": 6, "key_lifts": [
        {"id": "oap",     "name": "Deep one-arm push-ups",      "reps": 10, "bodyweight": True},
        {"id": "oapull",  "name": "Full one-arm pull-up",        "reps": 3,  "bodyweight": True},
        {"id": "planche", "name": "Full planche (seconds)",      "reps": 5,  "bodyweight": True},
        {"id": "ironx",   "name": "Iron cross progression",      "reps": 3,  "bodyweight": True},
    ], "accessories": [
        {"id": "humanflag","name": "Full human flag (seconds)", "reps": 15},
        {"id": "maltese",  "name": "Maltese progression",        "reps": 3},
        {"id": "hefestop", "name": "Hefesto pull-up",             "reps": 1},
    ]},
}

# Home — minimal equipment (bands, one pair of dumbbells), no barbells.
_HOME_PROGRAMMING = {
    1: {"sets": 3, "key_lifts": [
        {"id": "dbpress", "name": "Dumbbell chest press",    "bw_pct": 20, "reps": 10},
        {"id": "goblet",  "name": "Goblet squat",            "bw_pct": 25, "reps": 12},
        {"id": "dbrow",   "name": "DB rows (each arm)",      "bw_pct": 20, "reps": 10},
        {"id": "dbohp",   "name": "Dumbbell shoulder press", "bw_pct": 15, "reps": 10},
    ], "accessories": [
        {"id": "pushup",  "name": "Push-ups",                 "reps": 10},
        {"id": "plank_s", "name": "Plank (seconds)",          "reps": 30},
        {"id": "lunge",   "name": "Reverse lunges",           "reps": 10},
    ]},
    2: {"sets": 3, "key_lifts": [
        {"id": "dbpress", "name": "Dumbbell chest press",    "bw_pct": 30, "reps": 10},
        {"id": "goblet",  "name": "Goblet squat",            "bw_pct": 35, "reps": 12},
        {"id": "dbrow",   "name": "DB rows (each arm)",      "bw_pct": 28, "reps": 10},
        {"id": "dbohp",   "name": "Dumbbell shoulder press", "bw_pct": 22, "reps": 10},
    ], "accessories": [
        {"id": "dipbench","name": "Bench dips",               "reps": 12},
        {"id": "plank_s", "name": "Plank (seconds)",          "reps": 45},
        {"id": "bulgar",  "name": "Bulgarian split squats",   "reps": 8},
    ]},
    3: {"sets": 4, "key_lifts": [
        {"id": "dbpress", "name": "Dumbbell chest press",    "bw_pct": 40, "reps": 8},
        {"id": "frontsq", "name": "DB front squat",           "bw_pct": 45, "reps": 10},
        {"id": "dbrow",   "name": "DB rows (each arm)",      "bw_pct": 35, "reps": 8},
        {"id": "dbohp",   "name": "Dumbbell shoulder press", "bw_pct": 28, "reps": 8},
    ], "accessories": [
        {"id": "pullup",  "name": "Pull-ups",                 "reps": 6},
        {"id": "lsit_s",  "name": "L-sit hold (seconds)",      "reps": 15},
        {"id": "diamond", "name": "Diamond push-ups",          "reps": 10},
    ]},
    4: {"sets": 4, "key_lifts": [
        {"id": "dbpress", "name": "Dumbbell chest press",    "bw_pct": 50, "reps": 6},
        {"id": "frontsq", "name": "DB front squat",           "bw_pct": 55, "reps": 8},
        {"id": "rdl",     "name": "DB Romanian deadlift",     "bw_pct": 60, "reps": 8},
        {"id": "dbohp",   "name": "Dumbbell shoulder press", "bw_pct": 35, "reps": 8},
    ], "accessories": [
        {"id": "pullup",  "name": "Pull-ups",                 "reps": 10},
        {"id": "pistol",  "name": "Assisted pistol squats",   "reps": 5},
        {"id": "archpush","name": "Archer push-ups",           "reps": 6},
    ]},
    5: {"sets": 5, "key_lifts": [
        {"id": "dbpress", "name": "Dumbbell chest press",    "bw_pct": 60, "reps": 6},
        {"id": "frontsq", "name": "DB front squat",           "bw_pct": 65, "reps": 8},
        {"id": "rdl",     "name": "DB Romanian deadlift",     "bw_pct": 70, "reps": 6},
        {"id": "dbohp",   "name": "Dumbbell shoulder press", "bw_pct": 40, "reps": 6},
    ], "accessories": [
        {"id": "wpull",   "name": "Weighted pull-ups",        "reps": 6},
        {"id": "pistol",  "name": "Pistol squats",            "reps": 6},
        {"id": "hspu",    "name": "Wall handstand push-ups",  "reps": 5},
    ]},
    6: {"sets": 5, "key_lifts": [
        {"id": "dbpress", "name": "Dumbbell chest press",    "bw_pct": 70, "reps": 5},
        {"id": "frontsq", "name": "DB front squat",           "bw_pct": 80, "reps": 6},
        {"id": "rdl",     "name": "DB Romanian deadlift",     "bw_pct": 85, "reps": 5},
        {"id": "dbohp",   "name": "Dumbbell shoulder press", "bw_pct": 50, "reps": 6},
    ], "accessories": [
        {"id": "wpull",   "name": "Weighted pull-ups",        "reps": 10},
        {"id": "oap",     "name": "One-arm push-ups progression","reps": 3},
        {"id": "muscleup","name": "Muscle-ups",                "reps": 5},
    ]},
    7: {"sets": 6, "key_lifts": [
        {"id": "dbpress", "name": "Dumbbell chest press",    "bw_pct": 80, "reps": 4},
        {"id": "frontsq", "name": "DB front squat",           "bw_pct": 90, "reps": 5},
        {"id": "rdl",     "name": "DB Romanian deadlift",     "bw_pct": 100, "reps": 4},
        {"id": "dbohp",   "name": "Dumbbell shoulder press", "bw_pct": 55, "reps": 5},
    ], "accessories": [
        {"id": "wpull",   "name": "Weighted pull-ups",        "reps": 12},
        {"id": "oap",     "name": "One-arm push-ups",          "reps": 5},
        {"id": "frontlvr","name": "Front lever (seconds)",     "reps": 10},
    ]},
    8: {"sets": 6, "key_lifts": [
        {"id": "dbpress", "name": "Dumbbell chest press",    "bw_pct": 90, "reps": 3},
        {"id": "frontsq", "name": "DB front squat",           "bw_pct": 100, "reps": 4},
        {"id": "rdl",     "name": "DB Romanian deadlift",     "bw_pct": 110, "reps": 3},
        {"id": "dbohp",   "name": "Dumbbell shoulder press", "bw_pct": 60, "reps": 4},
    ], "accessories": [
        {"id": "oap",     "name": "Deep one-arm push-ups",    "reps": 8},
        {"id": "planche", "name": "Planche (seconds)",         "reps": 5},
        {"id": "oapull",  "name": "One-arm pull-up",           "reps": 2},
    ]},
}

LEVEL_PROGRAMMING = {
    "gym":          _GYM_PROGRAMMING,
    "calisthenics": _CAL_PROGRAMMING,
    "home":         _HOME_PROGRAMMING,
    "mixed":        _GYM_PROGRAMMING,  # mixed defaults to gym
}


def build_prescription(level_id: int, bodyweight_kg: float, adjust: float = 1.0,
                        unit: str = "metric", style: str = "gym") -> dict:
    """Return the prescribed weights/reps for a user at a given level + style."""
    style_key = style if style in LEVEL_PROGRAMMING else "gym"
    prog_set = LEVEL_PROGRAMMING[style_key]
    prog = prog_set.get(level_id, prog_set[1])
    factor = max(0.6, min(1.6, adjust))
    step = 5.0 if unit == "imperial" else 2.5

    def _reps(base: int) -> int:
        return max(1, int(round(base * (2 - factor))))

    key_lifts = []
    for lift in prog["key_lifts"]:
        if lift.get("bodyweight"):
            # Bodyweight exercise — no weight calc, just reps that scale
            key_lifts.append({
                "id": lift["id"], "name": lift["name"],
                "sets": prog["sets"], "reps": _reps(lift["reps"]),
                "bodyweight": True,
            })
            continue
        kg = bodyweight_kg * (lift["bw_pct"] / 100.0) * factor
        weight_display = round(kg * 2.2046226, 1) if unit == "imperial" else round(kg, 1)
        weight_display = round(weight_display / step) * step
        key_lifts.append({
            "id": lift["id"], "name": lift["name"],
            "sets": prog["sets"], "reps": _reps(lift["reps"]),
            "weight_display": weight_display,
            "weight_unit": "lb" if unit == "imperial" else "kg",
            "bw_pct": lift["bw_pct"],
        })
    accessories = [
        {**a, "sets": prog["sets"], "reps": _reps(a["reps"])}
        for a in prog["accessories"]
    ]
    return {
        "level_id": level_id, "style": style_key,
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
