"""FitLux Progress + Gamification backend test suite.

Public URL tested: REACT_APP_BACKEND_URL (EXPO_PUBLIC_BACKEND_URL in this repo).
"""
import os
import random
import string
import sys
import time
import requests

BASE = "https://fitbot-whatsapp.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@fitlux.com"
ADMIN_PWD = "Admin@12345"

session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

passed, failed = [], []


def _rand(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def record(name, ok, detail=""):
    if ok:
        passed.append(name)
        print(f"PASS  {name}  {detail}")
    else:
        failed.append((name, detail))
        print(f"FAIL  {name}  {detail}")


def req(method, path, token=None, **kw):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return session.request(method, f"{BASE}{path}", headers=headers, timeout=30, **kw)


def main():
    # ---- Register fresh user ----
    email = f"progtest_{_rand()}@example.com"
    pwd = "Pass1234!"
    r = req("POST", "/auth/register", json={"email": email, "password": pwd,
                                              "name": "Progress Tester"})
    if r.status_code != 200:
        record("register_fresh_user", False, f"{r.status_code} {r.text}")
        return
    tok = r.json()["token"]
    uid = r.json()["user"]["id"]
    record("register_fresh_user", True, email)

    # ---- Admin login ----
    r = req("POST", "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    if r.status_code != 200:
        record("admin_login", False, f"{r.status_code} {r.text}")
        return
    admin_tok = r.json()["token"]
    record("admin_login", True)

    # ===== 1) GET /api/levels =====
    r = req("GET", "/levels")
    ok = r.status_code == 200 and isinstance(r.json().get("levels"), list)
    levels = r.json().get("levels", []) if ok else []
    ok = ok and len(levels) == 8
    if ok:
        need_keys = {"id", "slug", "name", "emoji", "min_xp", "desc",
                     "intensity", "color"}
        for lv in levels:
            if not need_keys.issubset(lv.keys()):
                ok = False
                break
        names = [lv["name"] for lv in levels]
        if not (names[0] == "Rookie" and names[-1] == "EXTREME"):
            ok = False
    record("1_GET_/levels_8_entries_Rookie_to_EXTREME", ok,
           f"len={len(levels)}")

    # ===== 2) GET /api/me/prefs default =====
    r = req("GET", "/me/prefs", token=tok)
    ok = r.status_code == 200 and r.json() == {"units": "metric",
                                                 "starting_level": 1}
    record("2_GET_/me/prefs_defaults", ok, f"{r.status_code} {r.text}")

    # ===== 3) PATCH units=imperial =====
    r = req("PATCH", "/me/prefs", token=tok, json={"units": "imperial"})
    ok = r.status_code == 200
    r2 = req("GET", "/me/prefs", token=tok)
    ok = ok and r2.status_code == 200 and r2.json().get("units") == "imperial"
    record("3_PATCH_units=imperial_persists", ok, f"{r.status_code} {r2.text}")

    # Revert to metric for remaining weight/measurement test expectations
    req("PATCH", "/me/prefs", token=tok, json={"units": "metric"})

    # ===== 4) PATCH starting_level=4 -> Warrior =====
    r = req("PATCH", "/me/prefs", token=tok, json={"starting_level": 4})
    ok = r.status_code == 200
    r2 = req("GET", "/me/level", token=tok)
    ok2 = (r2.status_code == 200
           and r2.json().get("level", {}).get("name") == "Warrior"
           and r2.json().get("xp", 0) >= 700)
    record("4_PATCH_starting_level=4_Warrior_min_xp", ok and ok2,
           f"{r.status_code} lvl={r2.json() if r2.ok else r2.text}")

    # ===== 5) PATCH starting_level=99 =====
    r = req("PATCH", "/me/prefs", token=tok, json={"starting_level": 99})
    record("5_PATCH_starting_level=99_400", r.status_code == 400,
           f"{r.status_code} {r.text}")

    # ===== 6) PATCH {} =====
    r = req("PATCH", "/me/prefs", token=tok, json={})
    ok = r.status_code == 400 and "Nothing to update" in r.text
    record("6_PATCH_empty_400_nothing_to_update", ok, f"{r.status_code} {r.text}")

    # ===== 7) PATCH units=invalid =====
    r = req("PATCH", "/me/prefs", token=tok, json={"units": "invalid"})
    record("7_PATCH_units=invalid_400", r.status_code == 400,
           f"{r.status_code} {r.text}")

    # Ensure metric before weight tests
    req("PATCH", "/me/prefs", token=tok, json={"units": "metric"})

    # ===== 8) POST /progress/weight metric 75 =====
    r = req("POST", "/progress/weight", token=tok,
            json={"weight": 75, "unit": "metric"})
    data = r.json() if r.ok else {}
    ok = (r.status_code == 200
          and data.get("entry", {}).get("weight_kg") == 75
          and data.get("xp", {}).get("xp_delta") == 10)
    record("8_POST_/progress/weight_metric_75_xp10", ok,
           f"{r.status_code} {data}")

    # ===== 9) POST /progress/weight imperial 170 -> 77.11 =====
    r = req("POST", "/progress/weight", token=tok,
            json={"weight": 170, "unit": "imperial"})
    data = r.json() if r.ok else {}
    kg = data.get("entry", {}).get("weight_kg") if r.ok else None
    ok = r.status_code == 200 and kg is not None and abs(kg - 77.11) < 0.05
    record("9_POST_/progress/weight_imperial_170_=>77.11kg", ok,
           f"{r.status_code} kg={kg}")

    # ===== 10) GET /progress/weight =====
    r = req("GET", "/progress/weight", token=tok)
    data = r.json() if r.ok else {}
    entries = data.get("entries", [])
    ok = (r.status_code == 200
          and len(entries) == 2
          and all("weight_display" in e for e in entries)
          and data.get("unit") == "metric")
    record("10_GET_/progress/weight_2_entries_display", ok,
           f"{r.status_code} count={len(entries)} unit={data.get('unit')}")

    # ===== 11) POST /progress/measurements ok =====
    r = req("POST", "/progress/measurements", token=tok,
            json={"unit": "metric",
                  "values": {"chest": 100, "left_arm": 36, "waist": 85}})
    data = r.json() if r.ok else {}
    vals = data.get("entry", {}).get("values_cm", {})
    ok = (r.status_code == 200
          and set(["chest", "left_arm", "waist"]).issubset(vals.keys())
          and data.get("xp", {}).get("xp_delta") == 10)
    record("11_POST_/progress/measurements_3fields_xp10", ok,
           f"{r.status_code} {data}")

    # ===== 12) POST measurements empty =====
    r = req("POST", "/progress/measurements", token=tok,
            json={"unit": "metric", "values": {}})
    ok = r.status_code == 400 and "at least one measurement" in r.text.lower()
    record("12_POST_measurements_empty_400", ok, f"{r.status_code} {r.text}")

    # ===== 13) GET /progress/measurements =====
    r = req("GET", "/progress/measurements", token=tok)
    data = r.json() if r.ok else {}
    entries = data.get("entries", [])
    ok = (r.status_code == 200
          and isinstance(entries, list) and len(entries) >= 1
          and isinstance(data.get("fields"), list)
          and data.get("unit")
          and all("values_display" in e for e in entries))
    record("13_GET_/progress/measurements_structure", ok,
           f"{r.status_code} entries={len(entries)}")

    # ===== 14) POST /progress/photos front =====
    r = req("POST", "/progress/photos", token=tok,
            json={"image": "data:image/jpeg;base64,AAAA", "pose": "front"})
    data = r.json() if r.ok else {}
    photo_id = data.get("entry", {}).get("id") if r.ok else None
    ok = (r.status_code == 200
          and data.get("entry", {}).get("pose") == "front"
          and data.get("xp", {}).get("xp_delta") == 15)
    record("14_POST_/progress/photos_front_xp15", ok,
           f"{r.status_code} pose={data.get('entry', {}).get('pose')}")

    # Add a side photo for GET filter
    req("POST", "/progress/photos", token=tok,
        json={"image": "data:image/jpeg;base64,AAAA", "pose": "side"})

    # ===== 15) POST photos invalid base64 =====
    r = req("POST", "/progress/photos", token=tok,
            json={"image": "not-a-base64", "pose": "front"})
    ok = r.status_code == 400 and "base64 data URL" in r.text
    record("15_POST_photos_invalid_base64_400", ok,
           f"{r.status_code} {r.text}")

    # ===== 16) POST photos invalid pose =====
    r = req("POST", "/progress/photos", token=tok,
            json={"image": "data:image/jpeg;base64,AAAA", "pose": "invalid"})
    ok = r.status_code == 400 and "Invalid pose" in r.text
    record("16_POST_photos_invalid_pose_400", ok, f"{r.status_code} {r.text}")

    # ===== 17) GET /progress/photos =====
    r = req("GET", "/progress/photos", token=tok)
    data = r.json() if r.ok else {}
    ok = r.status_code == 200 and len(data.get("photos", [])) >= 1
    record("17_GET_/progress/photos", ok,
           f"{r.status_code} count={len(data.get('photos', []))}")

    # ===== 18) GET /progress/photos?pose=front =====
    r = req("GET", "/progress/photos?pose=front", token=tok)
    data = r.json() if r.ok else {}
    photos = data.get("photos", []) if r.ok else []
    ok = (r.status_code == 200
          and len(photos) >= 1
          and all(p.get("pose") == "front" for p in photos))
    record("18_GET_/progress/photos?pose=front", ok,
           f"{r.status_code} count={len(photos)}")

    # ===== 19) DELETE photo / then re-DELETE =====
    if photo_id:
        r = req("DELETE", f"/progress/photos/{photo_id}", token=tok)
        ok = r.status_code == 200 and r.json().get("deleted") is True
        record("19a_DELETE_/progress/photos/{id}", ok,
               f"{r.status_code} {r.text}")
        r2 = req("DELETE", f"/progress/photos/{photo_id}", token=tok)
        record("19b_DELETE_photo_again_404", r2.status_code == 404,
               f"{r2.status_code} {r2.text}")
    else:
        record("19_DELETE_photo", False, "no photo id captured")

    # ===== 20) POST /progress/strength bench 80x5 PR =====
    r = req("POST", "/progress/strength", token=tok,
            json={"exercise": "bench press", "weight": 80, "reps": 5,
                  "unit": "metric"})
    data = r.json() if r.ok else {}
    ok = (r.status_code == 200
          and data.get("is_pr") is True
          and data.get("xp", {}).get("xp_delta") == 50)
    record("20_POST_/progress/strength_PR_80kg_xp50", ok,
           f"{r.status_code} {data}")

    # ===== 21) bench 70x8 not PR =====
    r = req("POST", "/progress/strength", token=tok,
            json={"exercise": "bench press", "weight": 70, "reps": 8,
                  "unit": "metric"})
    data = r.json() if r.ok else {}
    ok = (r.status_code == 200
          and data.get("is_pr") is False
          and data.get("xp", {}).get("xp_delta") == 10)
    record("21_POST_/progress/strength_notPR_70kg_xp10", ok,
           f"{r.status_code} {data}")

    # ===== 22) bench 85x3 PR =====
    r = req("POST", "/progress/strength", token=tok,
            json={"exercise": "bench press", "weight": 85, "reps": 3,
                  "unit": "metric"})
    data = r.json() if r.ok else {}
    ok = r.status_code == 200 and data.get("is_pr") is True
    record("22_POST_/progress/strength_PR_85kg", ok, f"{r.status_code} {data}")

    # ===== 23) GET /progress/strength =====
    r = req("GET", "/progress/strength", token=tok)
    data = r.json() if r.ok else {}
    entries = data.get("entries", [])
    prs = data.get("prs", [])
    bench_prs = [p for p in prs if p.get("exercise") == "bench press"]
    ok = (r.status_code == 200
          and len(entries) == 3
          and len(bench_prs) == 1
          and abs(bench_prs[0].get("weight_kg", 0) - 85) < 0.01)
    record("23_GET_/progress/strength_3entries_PR85", ok,
           f"{r.status_code} n={len(entries)} prs={prs}")

    # ===== 24) GET /progress/summary =====
    r = req("GET", "/progress/summary", token=tok)
    data = r.json() if r.ok else {}
    ok = (r.status_code == 200
          and data.get("weight_count", 0) >= 2
          and data.get("measurement_count", 0) >= 1
          and data.get("photo_count", -1) >= 0
          and data.get("strength_count") == 3
          and isinstance(data.get("insight"), str)
          and any(s in data.get("insight", "") for s in ["kg", "lb"]))
    record("24_GET_/progress/summary", ok, f"{r.status_code} {data}")

    # ===== 25) share-card/30 =====
    r = req("GET", "/progress/share-card/30", token=tok)
    data = r.json() if r.ok else {}
    keys_needed = {"days", "unit", "name", "photos_before", "photos_after",
                   "weight_before", "weight_after", "ready"}
    ok = r.status_code == 200 and keys_needed.issubset(data.keys())
    record("25_GET_/progress/share-card/30", ok,
           f"{r.status_code} keys={set(data.keys()) if r.ok else 'n/a'}")

    # ===== 26) share-card/45 invalid =====
    r = req("GET", "/progress/share-card/45", token=tok)
    record("26_GET_/progress/share-card/45_400", r.status_code == 400,
           f"{r.status_code} {r.text}")

    # ===== 27) /auth/me =====
    r = req("GET", "/auth/me", token=tok)
    record("27_GET_/auth/me_user", r.status_code == 200
           and r.json().get("email") == email,
           f"{r.status_code}")

    # ===== 28) /admin/metrics =====
    r = req("GET", "/admin/metrics", token=admin_tok)
    record("28_GET_/admin/metrics_admin_200",
           r.status_code == 200 and "total_users" in r.json(),
           f"{r.status_code}")

    # ===== 29) /me/level no auth =====
    r = req("GET", "/me/level")
    record("29_GET_/me/level_no_auth_401", r.status_code == 401,
           f"{r.status_code} {r.text}")

    # ===== 30) /progress/weight no auth =====
    r = req("GET", "/progress/weight")
    record("30_GET_/progress/weight_no_auth_401", r.status_code == 401,
           f"{r.status_code} {r.text}")

    print("\n================ SUMMARY ================")
    print(f"PASSED ({len(passed)}):")
    for n in passed:
        print(f"  + {n}")
    print(f"\nFAILED ({len(failed)}):")
    for n, d in failed:
        print(f"  - {n}  :: {d[:200]}")
    return len(failed) == 0


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
