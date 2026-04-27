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

## Smart enhancement
The reminder timeline is recomputed every quiz submission from the user's wake time
+ work hours, so the workout slot fits the user's actual life — they see, e.g.,
"07:30 Morning workout" or "18:00 Post-work workout" automatically.

## Deferred
- WhatsApp reminders (Twilio) — user opted to defer
- Emergent Google social login
