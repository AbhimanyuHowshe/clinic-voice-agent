"""Check that the configured credentials work, without printing any of them.

Run from agent/:  uv run python scripts/check_keys.py
Prints OK or FAIL per service, plus a short reason. Values are never shown.
"""

import asyncio
import os
import re
import sys
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

AGENT_DIR = Path(__file__).resolve().parent.parent
DASHBOARD_ENV = AGENT_DIR.parent / "dashboard" / ".env.local"
load_dotenv(AGENT_DIR / ".env")


def shape(name: str, value: str | None, pattern: str) -> str | None:
    if not value:
        return f"{name} is empty"
    if "your-" in value or "=" in value or any(c.isspace() for c in value):
        return f"{name} looks like a placeholder or several pasted lines"
    if not re.fullmatch(pattern, value):
        return f"{name} has an unexpected format"
    return None


def report(label: str, problem: str | None) -> bool:
    print(f"{'OK  ' if problem is None else 'FAIL'}  {label}" + (f": {problem}" if problem else ""))
    return problem is None


async def check_supabase(url: str | None, key: str | None) -> str | None:
    if p := shape("SUPABASE_URL", url, r"https://[a-z0-9]+\.supabase\.co/?") or shape("SUPABASE_SERVICE_ROLE_KEY", key, r"\S{20,}"):
        return p
    from supabase import acreate_client

    try:
        db = await acreate_client(url, key)
        await db.table("clinics").select("slug").limit(1).execute()
    except Exception as e:  # message may include server text, never the key
        return f"request failed ({type(e).__name__})"
    return None


async def check_anon(url: str | None, key: str | None) -> str | None:
    if p := shape("NEXT_PUBLIC_SUPABASE_URL", url, r"https://[a-z0-9]+\.supabase\.co/?") or shape("NEXT_PUBLIC_SUPABASE_ANON_KEY", key, r"\S{20,}"):
        return p
    import httpx

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{url.rstrip('/')}/auth/v1/settings", headers={"apikey": key})
    return None if r.status_code == 200 else f"Supabase answered HTTP {r.status_code}"


async def check_livekit(url: str | None, key: str | None, secret: str | None) -> str | None:
    if p := shape("LIVEKIT_URL", url, r"wss://[a-z0-9-]+\.livekit\.cloud/?") or shape("LIVEKIT_API_KEY", key, r"\S{6,}") or shape("LIVEKIT_API_SECRET", secret, r"\S{20,}"):
        return p
    from livekit import api

    lk = api.LiveKitAPI(url=url.replace("wss://", "https://"), api_key=key, api_secret=secret)
    try:
        await lk.room.list_rooms(api.ListRoomsRequest())
    except Exception as e:
        return f"request failed ({type(e).__name__})"
    finally:
        await lk.aclose()
    return None


async def check_sarvam(key: str | None) -> str | None:
    if p := shape("SARVAM_API_KEY", key, r"\S{10,}"):
        return p
    import httpx

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.sarvam.ai/v1/chat/completions",
            headers={"api-subscription-key": key},
            json={"model": "sarvam-105b-conversations", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5},
        )
    return None if r.status_code == 200 else f"Sarvam answered HTTP {r.status_code}"


async def main() -> None:
    e = os.environ
    d = dotenv_values(DASHBOARD_ENV) if DASHBOARD_ENV.exists() else {}
    results = [
        report("agent: Supabase secret key", await check_supabase(e.get("SUPABASE_URL"), e.get("SUPABASE_SERVICE_ROLE_KEY"))),
        report("agent: LiveKit", await check_livekit(e.get("LIVEKIT_URL"), e.get("LIVEKIT_API_KEY"), e.get("LIVEKIT_API_SECRET"))),
        report("agent: Sarvam", await check_sarvam(e.get("SARVAM_API_KEY"))),
        report("dashboard: Supabase publishable key", await check_anon(d.get("NEXT_PUBLIC_SUPABASE_URL"), d.get("NEXT_PUBLIC_SUPABASE_ANON_KEY"))),
        report("dashboard: LiveKit", await check_livekit(d.get("LIVEKIT_URL"), d.get("LIVEKIT_API_KEY"), d.get("LIVEKIT_API_SECRET"))),
    ]
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
