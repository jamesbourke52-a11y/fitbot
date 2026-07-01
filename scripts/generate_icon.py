"""One-shot: generate the FitLux app icon (1024x1024 PNG)."""
import asyncio
import os
import base64
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")

PROMPT = (
    "A premium app icon design for a fitness app called FitLux. "
    "Square 1:1 format, 1024x1024 pixels. "
    "Style: modern, minimal, luxurious, high-end. "
    "Design: a stylized gold dumbbell viewed from a 3/4 perspective, "
    "rendered in metallic champagne gold (#D4A54C) with subtle gradient "
    "and soft rim lighting. The dumbbell is centered on a deep matte "
    "black background (#0A0A0A). Behind the dumbbell, a very subtle "
    "concentric circle glow in gold at low opacity, giving a spotlight "
    "feel. No text. No letters. No words. Icon must read cleanly at "
    "tiny thumbnail size (48px). Corners are full-bleed (icon fills "
    "the entire square, no rounded padding — the OS will round it). "
    "Sharp, iconic, luxury sport branding, similar to what a $200/mo "
    "boutique gym would use. Photorealistic 3D render with soft studio lighting."
)

async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise SystemExit("EMERGENT_LLM_KEY missing from /app/backend/.env")

    chat = LlmChat(
        api_key=api_key,
        session_id="fitlux-icon-gen-v1",
        system_message="You are an expert app icon designer.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )

    print("[icon] requesting generation from Nano Banana…")
    text, images = await chat.send_message_multimodal_response(UserMessage(text=PROMPT))
    print(f"[icon] llm text: {text[:120] if text else '(none)'}")
    if not images:
        raise SystemExit("No image returned")

    out_paths = [
        "/app/frontend/assets/images/icon.png",
        "/app/frontend/assets/images/adaptive-icon.png",
        "/app/frontend/assets/images/splash-icon.png",
    ]
    img_bytes = base64.b64decode(images[0]["data"])
    for p in out_paths:
        with open(p, "wb") as f:
            f.write(img_bytes)
        print(f"[icon] wrote {p} ({len(img_bytes)} bytes)")

if __name__ == "__main__":
    asyncio.run(main())
