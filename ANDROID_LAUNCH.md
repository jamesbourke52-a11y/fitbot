# FitLux — Android Launch Playbook 🤖

Streamlined plan to ship FitLux to the Google Play Store. iOS is parked until
you've validated the app with real Android users and revenue.

---

## ⏱ Timeline

| Week | Task | Status |
|---|---|---|
| 0 (now) | App config, icons, legal pages, EAS build setup | ✅ done |
| 1 | Create Play Console account + register app + upload first build | 👤 you |
| 2 | Internal testing (2-5 friends), fix bugs | 👤 you |
| 3 | Open / Closed beta — grow to 20+ testers, polish | 👤 you |
| 4 | Submit for production review — goes live in ~3 days | 👤 you |

---

## 🏷 App identity (already wired in `app.json`)

| Field | Value |
|---|---|
| Name | **FitLux** |
| Package name | `com.fitlux.app` |
| Version | 1.0.0 |
| versionCode | 1 |
| Primary color | `#D4A54C` (gold) |
| Background | `#0A0A0A` |
| Permissions | INTERNET, ACCESS_NETWORK_STATE, VIBRATE, POST_NOTIFICATIONS |

---

## 📝 Step 1 — Google Play Console account (10 min)

1. Go to **https://play.google.com/console/signup**
2. Choose **"An organization"** (better for tax/branding) or **"Myself"** (faster, no docs required)
3. Pay the **one-off $25 registration fee**
4. Complete identity verification (upload ID + selfie) — takes ~48 hrs to approve
5. Once approved → **Create App**
   - App name: **FitLux**
   - Default language: English (UK)
   - App or Game: **App**
   - Free or Paid: **Free** (with in-app subscription)
   - Declarations: confirm Developer Program Policies + US export laws ✅

---

## 🛠 Step 2 — Build the Android binary with EAS (20 min)

```bash
# Install EAS CLI once
npm install -g eas-cli

# Log in — creates an Expo account if you don't have one (free)
eas login

cd /app/frontend

# First-time setup — creates a project ID and writes it into app.json
eas init --id com.fitlux.app

# Configure Android credentials (EAS will generate a keystore for you — let it)
eas credentials -p android

# Build a production Android App Bundle (.aab) to upload to Play Console
eas build --platform android --profile production
```

The build runs on EAS's servers (~15 min) and gives you a `.aab` file URL
when done.

⚠️ **Keystore safety** — EAS stores your signing keystore. **DO NOT lose it**
or you'll never be able to update the app. EAS will back it up automatically,
but also run `eas credentials -p android` → "Download" to save a local copy
somewhere safe (iCloud/Dropbox).

---

## 🚀 Step 3 — Upload & configure the Play listing

### 3a. Upload the .aab
Play Console → **Testing → Internal testing → Create new release** → upload the
`.aab` you built → review → **Save → Next → Release**.

Then add your email as an internal tester → accept the invite link on your
Android phone → install the app → confirm everything works.

### 3b. Store listing

**Paste these into Play Console → "Main store listing"**:

- **App name**: FitLux
- **Short description (80 chars)**:
  > AI-powered fitness app — personalised plan, workouts, coach, premium supplements.
- **Full description**:
  > FitLux is the all-in-one premium fitness app for people who want a smart, personalised plan — without paying for a personal trainer.
  >
  > 🤖 **AI-built plan in 30 seconds**
  > Take a quick onboarding quiz about your goals, schedule and experience. Our Claude AI engine designs a complete weekly plan: training split, nutrition targets, hydration and recovery — all tailored to your work hours so it actually fits your life.
  >
  > 💪 **Workout library**
  > Curated demo videos for every move in your plan, organised into Push / Pull / Legs / Core blocks. Tap any exercise to see how it's done.
  >
  > 📅 **Editable schedule**
  > Daily reminders for wake-up, workout, meals, hydration and sleep. Drag, edit or reset — make it yours.
  >
  > 💬 **AI coach chat**
  > Stuck on form? Plateau? Confused about supplements? Ask FitLux Coach anything, anytime.
  >
  > 🛒 **Supplement shop**
  > 120 hand-picked best-sellers across 6 categories — protein, men's & women's training wear, weights, calisthenics gear, and adaptogens like ashwagandha, lion's mane and shilajit. All products link directly to Amazon for trusted shipping.
  >
  > 💎 **Premium subscription**
  > $6.99 / month or $67.10 / year (20% off yearly). Cancel anytime. No hidden fees.
  >
  > Built by a real lifter for real lifters. Whether you're cutting, bulking or just trying to stay consistent, FitLux is the system that makes it easy.
  >
  > ✱ FitLux is a participant in the Amazon Services LLC Associates Program. We earn from qualifying purchases made through links in the Shop section.
  >
  > Privacy: https://fitlux.fitness/privacy
  > Terms: https://fitlux.fitness/terms

- **Icon**: upload `/app/frontend/assets/images/icon.png` (1024×1024)
- **Feature graphic** (1024×500): I'll generate this when you're ready
- **Phone screenshots** (min 2, recommended 4-8, 1080×1920 portrait): capture from the running app (see below)
- **Video** (optional YouTube URL of 30-sec demo — big conversion boost)
- **App category**: Health & Fitness
- **Tags**: fitness, workout, gym, AI coach, nutrition, supplement
- **Contact email**: support@fitlux.fitness
- **Website**: https://fitlux.fitness
- **Privacy policy URL** (required): `https://fitlux.fitness/privacy`

### 3c. Content rating
Play Console → **Content rating** → run the IARC questionnaire. Honest answers:
- No violence / sexual content / profanity
- References to medical / health information: **mild** (the AI coach gives supplement + nutrition suggestions)
- Digital purchases: **Yes** (subscriptions)

Expected rating: **PEGI 3 / Everyone**.

### 3d. Target audience and content
- Age groups: **18 and over** (matches your terms of service age gate)
- Do you want Designed for Families? **No**

### 3e. Data safety (important — Google is strict here)

Tick:
- **Personal info** → Email, Name — Collected, Shared with Stripe/Resend/Anthropic — Required — "Account management", "App functionality"
- **Financial info** → Purchase history — Collected — Required — "Account management"
- **App activity** → App interactions, In-app search history — Collected — Optional — "Analytics", "Personalization"
- **App info and performance** → Crash logs, Diagnostics — Collected — Required — "App functionality"
- Data is encrypted in transit: ✅
- You can request data deletion: ✅ (via privacy@fitlux.fitness)
- **No** ads personalization, **No** selling data to third parties

### 3f. Ads declaration
- Does your app contain ads? **No**
- (Amazon affiliate links are NOT considered ads — they are product links)

---

## 📸 Step 4 — Screenshots (30 min)

Play Store requires at least 2, but use 6-8 for best conversion.
Required size: **1080×1920 portrait** (16:9).

Easiest way:
1. Install the FitLux APK on your Android device (from the internal test track)
2. Open each screen → take a screenshot (Power + Volume Down)
3. Optionally add a caption overlay in Canva (free) — adds ~30% conversion

**Recommended screen order**:
1. **Home schedule** — caption: "Your day, planned"
2. **AI plan summary** — caption: "AI plan in 30 seconds"
3. **Workouts library** — caption: "Demo videos for every move"
4. **Coach chat** — caption: "Ask anything, get answers"
5. **Shop** — caption: "Premium supplements curated"
6. **Paywall** — caption: "Less than a coffee a week"

Upload these in Play Console → Main store listing → Phone screenshots.

---

## ⏭ Step 5 — Promotion tracks

Play Console now supports progressive release tracks. Recommended path:

1. **Internal testing** (already done in step 3a) — up to 100 testers, instant, no review
2. **Closed testing** → invite 20+ friends/influencers by email → publish
3. **Open testing** → anyone with the link can join → gets a "Try the beta" banner on Play Store (great for warmup)
4. **Production** → goes to review → 3 business days → live worldwide

### Region targeting
On the Production track, select countries:
- **Tier 1**: UK, IE, DE, FR, IT, NL, ES, SE, PL, CA (where your Amazon tag works — maximum revenue per user)
- **Tier 2**: All other English-speaking / Europe countries

---

## ⚠️ Things to DOUBLE-CHECK before submitting

- [ ] Privacy policy URL returns 200 OK at `https://fitlux.fitness/privacy`
- [ ] Terms URL returns 200 OK at `https://fitlux.fitness/terms`
- [ ] Open the app on Android, sign up, hit paywall, complete checkout with a Stripe test card — end-to-end works
- [ ] Reviewer credentials (`amazon-review@fitlux.com` / `Review@FitLux2026`) still work — paste them into Play Console → "App content" → "Testing sign-in credentials" so Google's reviewer can get past the paywall

---

## 🤖 What I'll handle when you're ready

- Generate the **feature graphic** (1024×500 Play Store banner) — gold dumbbell + tagline
- Draft the 30-sec **YouTube demo video script** (or help you record one with OBS)
- Build a `.aab` for you — you just paste your EAS credentials
- Help fix any review rejections (they happen, don't panic)

---

## 🍎 When you want to add iOS later

The current `app.json` already has iOS config wired. To add later:
1. Buy Apple Developer account ($99/yr)
2. `eas build --platform ios --profile production`
3. Upload to TestFlight
4. Submit to App Store Review
5. **Deal with Apple's StoreKit requirement** — they likely won't allow Stripe for in-app subscriptions. Options:
   - Build a StoreKit paywall for iOS only (keeps Stripe on Android)
   - OR only sell subscriptions through fitlux.fitness website, and let the iOS app have a "sign in" screen only (the "reader app" exemption)

Don't worry about this now. Ship Android first, see what works, come back to iOS.
