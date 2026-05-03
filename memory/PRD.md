# FitLux — Premium Personal Fitness App

## Overview
Premium dark/gold mobile fitness app: Expo Router + FastAPI + MongoDB.
Users complete a 13-step quiz, get an AI plan (Claude Sonnet 4.5) tailored around
their work hours and chosen workout style, with a structured workout schedule
where every exercise has a tap-to-play demo video.

## Stack
- Frontend: Expo Router, RN, TypeScript, expo-video, AsyncStorage, lucide-react-native
- Backend: FastAPI, Motor (Mongo), bcrypt + PyJWT
- AI: Claude Sonnet 4.5 via emergentintegrations + Emergent Universal LLM Key
- Workout demo videos: curated free MP4s from Mixkit CDN

## Features
- JWT email/password auth (Bearer header)
- 13-step onboarding quiz: body, goal, activity, days/week, **workout style**, diet, wake/sleep, **work schedule, work hours**
- AI-generated plan + structured workout schedule (Push/Pull/Legs · Calisthenics · Home · Mixed)
- Each workout day: 4-5 exercises with sets×reps, form tip, demo video
- Work-aware reminder timeline (workout auto-routed to morning if ≥90 min before work, else post-work)
- Daily home dashboard: water tracker, calorie tracker, schedule
- AI chat coach (Claude with full plan context)
- Shop: 6 supplement products with Buy Now external links
- Profile + sign out

## Endpoints (/api)
auth/register, auth/login, auth/me, quiz/submit, plan, tracker/today, tracker/water,
tracker/calories, tracker/reset, coach/chat, coach/history, products

## Admin
admin@fitlux.com / Admin@12345
Additional admin emails auto-promoted from ADMIN_EMAILS env (currently jamesbourke52@gmail.com).
In-app Admin Dashboard at /admin: metrics · promo code CRUD · influencer payouts · earnings feed.

## Progress tracking + gamification (v1.1)
- **Progress tab** (bottom nav slot #3): Overview · Body · Photos · Strength
- **Body weight log**: metric/imperial toggle per user, trend chart (SVG), insight line
- **Body measurements**: 11 body parts (neck, shoulders, chest, L/R arm, waist, hips, L/R thigh, L/R calf) with history
- **Progress photos**: front/side/back poses, base64 storage, horizontal gallery per pose, upload via `expo-image-picker`
- **Strength PRs**: auto-detects new PRs per exercise, logs reps + weight
- **Summary + insights** endpoint computes "Δ over N days" text
- **Share card** at 30/60/90 days: before/after photos + weight delta, shareable via native share sheet
- **Level system** (8 ranks: Rookie → Novice → Athlete → Warrior → Beast → Titan → Legend → EXTREME):
  - XP earned: workout +25, measurement +10, photo +15, PR +50, daily login +5
  - User picks starting rank in `/level-up` screen (mapped to min-XP of that rank)
  - XP bar + next-rank progress shown on Progress → Overview card
- Moved Profile out of bottom tabs → now a tappable avatar in the Home header.
- Backend: `/app/backend/progress_service.py` + new endpoints under `/api/progress/*`, `/api/me/level`, `/api/me/prefs`, `/api/levels`. 30/30 tests pass.

## Email (Resend)
Backend: `/app/backend/email_service.py` — 4 drip emails (Day 1/3/7/14) + Welcome
+ Payment receipt. Background sweep every 30 min via `drip_loop`, idempotent
via `email_log` collection, signed unsubscribe link.

Set `RESEND_API_KEY` and `SENDER_EMAIL` in `/app/backend/.env` to enable
sending; without the key all sends are skipped (no-op).

Admin tab "Emails" shows recent log + manual "run drip sweep now" button.

## App Store / Play Store
- Bundle id: `com.fitlux.app` (iOS + Android)
- Version 1.0.0 / build 1 / versionCode 1
- App icon, adaptive icon, splash icon, favicon — all generated to `assets/images/`
- In-app `/privacy` and `/terms` screens (linked from Profile tab)
- EAS config at `/app/frontend/eas.json` for build + submit
- Full App-Store + Play-Store submission pack at `/app/APP_STORE_SUBMISSION.md`
  (descriptions, keywords, screenshots checklist, action items)

## Pricing (current)
- Monthly subscription: $6.99 / 30 days
- Yearly subscription: $67.10 / 365 days (≈ 20% off vs monthly)
- Default influencer promo code: 20% discount, €1 commission per signup

## Amazon Associates
Shop screen includes prominent affiliate disclosure banner at the top (before any
links) and long-form disclosure inside every product detail modal, meeting the
Amazon Associates Program Operating Agreement requirements for identification
as a participant.

Tracking ID: `jamesbourke52-20` (active in CA, DE, ES, FR, IT, NL, PL, SE, UK).
Catalog: 120 curated best-sellers across 6 categories
(Protein/Drinks/Snacks · Men's Wear · Women's Wear · Gym Equipment ·
Health Supplements · Calisthenics) — all served via Amazon search URLs so
listings stay current; defined in /app/backend/products_catalog.py.

## Smart enhancement
The reminder timeline is recomputed every quiz submission from the user's wake time
+ work hours, so the workout slot fits the user's actual life — they see, e.g.,
"07:30 Morning workout" or "18:00 Post-work workout" automatically.

## Deferred
- WhatsApp reminders (Twilio) — user opted to defer
- Emergent Google social login
