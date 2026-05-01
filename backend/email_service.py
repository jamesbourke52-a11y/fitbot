"""
FitLux email service.

- Resend transactional emails
- 4-email drip sequence (Day 1, 3, 7, 14)
- Welcome + payment-confirmation transactional templates
- Background scheduler that runs every ~30 min
- Tracks every send in `email_log` collection (no duplicates)
- Unsubscribe support via signed token
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import resend  # type: ignore
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

GOLD = "#D4A54C"
BG = "#0A0A0A"
SURFACE = "#141414"
TEXT = "#F5F5F5"
MUTED = "#A1A1AA"


def _enabled() -> bool:
    return bool(os.environ.get("RESEND_API_KEY"))


def _configure() -> None:
    api_key = os.environ.get("RESEND_API_KEY") or ""
    resend.api_key = api_key


def _unsubscribe_token(user_id: str) -> str:
    secret = os.environ.get("JWT_SECRET", "secret")
    return hashlib.sha256(f"{user_id}:{secret}".encode()).hexdigest()[:32]


def _unsubscribe_url(user_id: str) -> str:
    base = os.environ.get("APP_URL", "https://fitlux.app").rstrip("/")
    return f"{base}/api/email/unsubscribe?u={user_id}&t={_unsubscribe_token(user_id)}"


def _layout(title: str, body_html: str, user_id: str) -> str:
    """Wrap content in the standard FitLux email shell."""
    unsubscribe = _unsubscribe_url(user_id)
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:{BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:{TEXT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:{SURFACE};border-radius:18px;border:1px solid #1F1F23;">
      <tr><td style="padding:28px 28px 8px 28px;">
        <div style="font-size:11px;letter-spacing:3px;color:{GOLD};font-weight:800;">FITLUX</div>
        <h1 style="margin:8px 0 0 0;font-size:22px;color:{TEXT};font-weight:800;">{title}</h1>
      </td></tr>
      <tr><td style="padding:18px 28px 28px 28px;font-size:15px;line-height:24px;color:{TEXT};">
        {body_html}
      </td></tr>
      <tr><td style="padding:0 28px 28px 28px;border-top:1px solid #1F1F23;">
        <div style="margin-top:18px;font-size:11px;line-height:18px;color:{MUTED};">
          You're receiving this because you signed up for FitLux. Don't want emails?
          <a href="{unsubscribe}" style="color:{GOLD};text-decoration:none;">Unsubscribe</a>.<br>
          FitLux · support@fitlux.app
        </div>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>"""


def _btn(href: str, text: str) -> str:
    return (
        f'<a href="{href}" style="display:inline-block;background:{GOLD};color:#0A0A0A;'
        f'text-decoration:none;font-weight:800;padding:13px 22px;border-radius:999px;">{text}</a>'
    )


# ---------------- Templates ----------------

def tpl_welcome(name: str, user_id: str) -> tuple[str, str]:
    app_url = os.environ.get("APP_URL", "https://fitlux.app")
    body = f"""
    <p>Welcome to FitLux{', ' + name if name else ''} 💪</p>
    <p>Your AI-powered fitness journey starts now. Here's what's waiting in the app:</p>
    <ul style="padding-left:18px;">
      <li>A custom plan built around your goals & schedule</li>
      <li>120+ supplement picks across 6 categories</li>
      <li>An AI coach you can ask anything, anytime</li>
    </ul>
    <p style="margin-top:24px;">{_btn(app_url, 'Open the app')}</p>
    <p style="color:{MUTED};font-size:13px;margin-top:18px;">Tip: complete your first quiz today to unlock your AI plan.</p>
    """
    return ("Welcome to FitLux", _layout("Welcome to FitLux", body, user_id))


def tpl_day1(name: str, user_id: str) -> tuple[str, str]:
    app_url = os.environ.get("APP_URL", "https://fitlux.app")
    cta = _btn(app_url, "See todays workout")
    body = f"""
    <p>Hey{' ' + name if name else ''} — day 1 is the hardest, so let's get it.</p>
    <p>Your AI plan splits the week into Push / Pull / Legs / Core blocks. Today's job is simple:</p>
    <ol style="padding-left:18px;">
      <li>Open the <strong>Workouts</strong> tab</li>
      <li>Pick today's session</li>
      <li>Tap any move to see the demo video</li>
    </ol>
    <p style="margin-top:24px;">{cta}</p>
    """
    return ("Day 1 — let's hit it", _layout("Day 1 — let's hit it", body, user_id))


def tpl_day3(name: str, user_id: str) -> tuple[str, str]:
    app_url = os.environ.get("APP_URL", "https://fitlux.app")
    body = f"""
    <p>{('Hey ' + name + ', three') if name else 'Three'} days in. Most people quit on day 4 — here's how to make it stick:</p>
    <p><strong>1. Pin your schedule.</strong> Open the Home tab, tap a reminder and set the exact time you'll work out. The app pings you.</p>
    <p><strong>2. Hit your protein.</strong> Aim for 1.6 g per kg of body weight. The Shop has the highest-rated whey on Amazon if you need it.</p>
    <p><strong>3. Ask the coach.</strong> Stuck on form? Plateaued? Open the Coach tab and just type your question.</p>
    <p style="margin-top:24px;">{_btn(app_url, 'Tweak my schedule')}</p>
    """
    return ("3 days in — make it stick", _layout("3 days in — make it stick", body, user_id))


def tpl_day7(name: str, user_id: str) -> tuple[str, str]:
    app_url = os.environ.get("APP_URL", "https://fitlux.app")
    body = f"""
    <p>One week, done. {'Big up' if not name else 'Big up, ' + name}.</p>
    <p>This is the moment we look at the boring stuff — sleep, hydration, soreness — because they're the real progress drivers.</p>
    <p>Quick check-in:</p>
    <ul style="padding-left:18px;">
      <li>How many of your scheduled workouts did you actually hit?</li>
      <li>Are you getting 7+ hours of sleep?</li>
      <li>Drinking your water? (Home tab tracks this)</li>
    </ul>
    <p>Open the Coach tab and tell it your honest score. It'll adjust your plan.</p>
    <p style="margin-top:24px;">{_btn(app_url, 'Talk to the coach')}</p>
    """
    return ("Week 1 check-in", _layout("Week 1 check-in", body, user_id))


def tpl_day14(name: str, user_id: str) -> tuple[str, str]:
    app_url = os.environ.get("APP_URL", "https://fitlux.app")
    share_subj = "Try FitLux"
    share_body = f"I've been using this fitness app and it's actually good — try it out: {app_url}"
    share_url = f"mailto:?subject={share_subj}&body={share_body}"
    cta = _btn(share_url, "Share with a friend")
    body = f"""
    <p>Two weeks in. {('You ' if name else 'You')}'re officially out of the danger zone — research says habits start sticking around day 18.</p>
    <p>If FitLux is helping, here's a question: <strong>who else needs this?</strong></p>
    <p>Got a friend who's been "starting Monday" for the last six months? Send them the app. They get 20% off their first month, you might even pick up some commission once we launch the affiliate program publicly.</p>
    <p style="margin-top:24px;">{cta}</p>
    """
    return ("Week 2 — share the gains", _layout("Week 2 — share the gains", body, user_id))


def tpl_payment(name: str, plan: str, user_id: str) -> tuple[str, str]:
    plan_label = "Yearly (365 days)" if plan == "yearly" else "Monthly (30 days)"
    body = f"""
    <p>Thanks for upgrading to FitLux Premium{', ' + name if name else ''}.</p>
    <p>Your plan: <strong>{plan_label}</strong>. Access is active immediately.</p>
    <p>This is the receipt — keep it for your records.</p>
    <p style="color:{MUTED};font-size:13px;">If anything looks off, reply to this email or contact support@fitlux.app and we'll sort it.</p>
    """
    return ("Payment confirmed — FitLux Premium", _layout("Payment confirmed", body, user_id))


# ---------------- Send + tracking ----------------

async def _record(db: AsyncIOMotorDatabase, user_id: str, kind: str, status: str,
                  email_id: Optional[str], error: Optional[str] = None) -> None:
    await db.email_log.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id, "kind": kind, "status": status,
        "email_id": email_id, "error": error,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })


async def already_sent(db: AsyncIOMotorDatabase, user_id: str, kind: str) -> bool:
    return bool(await db.email_log.find_one(
        {"user_id": user_id, "kind": kind, "status": "sent"}
    ))


async def is_unsubscribed(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    user = await db.users.find_one({"id": user_id}, {"unsubscribed": 1})
    return bool(user and user.get("unsubscribed"))


async def send(db: AsyncIOMotorDatabase, *, user_id: str, email: str, kind: str,
               subject: str, html: str) -> bool:
    """Send a single email, recording success/failure. Skips when:
       - Resend not configured (no API key)
       - User unsubscribed
       - Same kind already sent to this user."""
    if not _enabled():
        logger.info(f"[email:{kind}] skipped — RESEND_API_KEY not set")
        return False
    if await is_unsubscribed(db, user_id):
        await _record(db, user_id, kind, "skipped_unsubscribed", None)
        return False
    if kind != "payment" and await already_sent(db, user_id, kind):
        return False
    _configure()
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    params = {"from": sender, "to": [email], "subject": subject, "html": html}
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        await _record(db, user_id, kind, "sent", result.get("id"))
        logger.info(f"[email:{kind}] sent to {email} id={result.get('id')}")
        return True
    except Exception as e:
        await _record(db, user_id, kind, "failed", None, str(e))
        logger.error(f"[email:{kind}] failed for {email}: {e}")
        return False


# ---------------- Public helpers (called from routes) ----------------

async def send_welcome(db, user: dict) -> None:
    subject, html = tpl_welcome(user.get("name", ""), user["id"])
    await send(db, user_id=user["id"], email=user["email"], kind="welcome",
               subject=subject, html=html)


async def send_payment_confirmation(db, user: dict, plan: str) -> None:
    subject, html = tpl_payment(user.get("name", ""), plan, user["id"])
    await send(db, user_id=user["id"], email=user["email"], kind=f"payment-{plan}",
               subject=subject, html=html)


# ---------------- Drip scheduler ----------------

# (kind, days_after_signup, template_factory)
DRIP_SEQUENCE = [
    ("drip-day1",  1,  tpl_day1),
    ("drip-day3",  3,  tpl_day3),
    ("drip-day7",  7,  tpl_day7),
    ("drip-day14", 14, tpl_day14),
]


async def _process_user_drips(db, user: dict) -> None:
    if not user.get("created_at"):
        return
    try:
        signup_at = datetime.fromisoformat(user["created_at"])
    except Exception:
        return
    now = datetime.now(timezone.utc)
    days_since = (now - signup_at).days
    for kind, when, factory in DRIP_SEQUENCE:
        if days_since < when:
            continue
        if await already_sent(db, user["id"], kind):
            continue
        subject, html = factory(user.get("name", ""), user["id"])
        await send(db, user_id=user["id"], email=user["email"],
                   kind=kind, subject=subject, html=html)
        # Resend sandbox + free tier rate-limit: 2 req/s safely.
        await asyncio.sleep(0.5)


async def drip_sweep(db) -> dict:
    """Process every user; called by a periodic background loop."""
    if not _enabled():
        return {"skipped": True, "reason": "RESEND_API_KEY not set"}
    cursor = db.users.find(
        {"role": {"$nin": ["admin", "reviewer"]}, "unsubscribed": {"$ne": True}},
        {"id": 1, "email": 1, "name": 1, "created_at": 1, "_id": 0},
    )
    seen = 0
    async for user in cursor:
        seen += 1
        await _process_user_drips(db, user)
    return {"processed": seen}


async def drip_loop(db, interval_seconds: int = 1800) -> None:
    """Background task: check pending drips every 30 minutes."""
    while True:
        try:
            await drip_sweep(db)
        except Exception as e:
            logger.error(f"drip_loop error: {e}")
        await asyncio.sleep(interval_seconds)
