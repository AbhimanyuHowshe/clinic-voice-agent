"""Live smoke test for Sarvam TTS, STT and LLM.

Loads SARVAM_API_KEY from agent/.env (never printed), then:
  1. Synthesizes demo sentences with the LiveKit Sarvam TTS plugin and saves WAV files.
  2. Transcribes each WAV back with the LiveKit Sarvam STT plugin (round trip).
  3. Streams a reply from ChatSarvam (LangChain) and checks tool calling.

Usage: uv run python scripts/smoke_sarvam.py [output_dir]
"""

import asyncio
import os
import sys
import time
from pathlib import Path

import aiohttp
from dotenv import load_dotenv
from langchain_core.tools import tool
from livekit.plugins import sarvam

AGENT_DIR = Path(__file__).resolve().parent.parent

SAMPLES = [
    ("hi_priya", "hi-IN", "priya", "नमस्ते, मैं क्लिनिक की रिसेप्शनिस्ट हूँ। मैं आपकी क्या मदद कर सकती हूँ?"),
    ("hinglish_priya", "hi-IN", "priya", "Namaste! Kya aap kal subah Dr. Sharma ke saath appointment book karna chahenge?"),
    ("en_priya", "en-IN", "priya", "Hello, thank you for calling the clinic. How can I help you today?"),
    ("en_amelia", "en-IN", "amelia", "G'day, thanks for calling the clinic. Would you like to book an appointment for Tuesday?"),
    ("en_sophia", "en-IN", "sophia", "G'day, thanks for calling the clinic. Would you like to book an appointment for Tuesday?"),
]


def _err(e: Exception) -> str:
    return f"{type(e).__name__}: {str(e)[:200]}"


async def run_speech(out_dir: Path, session: aiohttp.ClientSession) -> bool:
    ok = True
    stt = sarvam.STT(language="unknown", model="saaras:v4", http_session=session)
    for name, lang, speaker, text in SAMPLES:
        tts = sarvam.TTS(
            target_language_code=lang, model="bulbul:v3", speaker=speaker, http_session=session
        )
        try:
            t0 = time.perf_counter()
            frame = await tts.synthesize(text).collect()
            tts_s = time.perf_counter() - t0
            wav = out_dir / f"{name}.wav"
            wav.write_bytes(frame.to_wav_bytes())
            print(f"[TTS ok]  {name}: {frame.duration:.1f}s audio in {tts_s:.2f}s -> {wav.name}")
        except Exception as e:
            print(f"[TTS FAIL] {name}: {_err(e)}")
            ok = False
            continue
        try:
            t0 = time.perf_counter()
            ev = await stt.recognize(frame)
            alt = ev.alternatives[0] if ev.alternatives else None
            print(
                f"[STT ok]  {name}: ({time.perf_counter() - t0:.2f}s, lang={alt.language if alt else '?'}) "
                f"{alt.text if alt else '<empty>'}"
            )
        except Exception as e:
            print(f"[STT FAIL] {name}: {_err(e)}")
            ok = False
    return ok


async def run_llm() -> bool:
    from langchain_sarvam import ChatSarvam

    ok = True
    chat = ChatSarvam(model="sarvam-105b")
    prompt = [
        ("system", "You are a polite clinic receptionist. Reply in one short sentence, in the patient's language."),
        ("human", "Namaste, clinic kitne baje khulta hai?"),
    ]
    try:
        t0 = time.perf_counter()
        first, chunks, text = None, 0, ""
        async for chunk in chat.astream(prompt):
            if chunk.content:
                first = first or time.perf_counter() - t0
                chunks += 1
                text += chunk.content
        print(f"[LLM ok]  stream: {chunks} chunks, first token {first or 0:.2f}s, total {time.perf_counter() - t0:.2f}s")
        print(f"          reply: {text.strip()[:300]}")
        if chunks < 2:
            print("[LLM WARN] reply arrived in fewer than 2 chunks; streaming may not be incremental")
    except Exception as e:
        print(f"[LLM FAIL] stream: {_err(e)}")
        ok = False

    @tool
    def check_availability(doctor: str, date: str) -> str:
        """Check available appointment slots for a doctor on a date (YYYY-MM-DD)."""
        return "[]"

    try:
        msg = await chat.bind_tools([check_availability]).ainvoke(
            [
                ("system", "You are a clinic receptionist. Use tools to check availability. Today is 2026-10-21."),
                ("human", "Is Dr. Sharma free tomorrow?"),
            ]
        )
        calls = getattr(msg, "tool_calls", [])
        if calls:
            print(f"[TOOL ok] {calls[0]['name']}({calls[0]['args']})")
        else:
            print(f"[TOOL FAIL] no tool call; replied: {str(msg.content)[:200]}")
            ok = False
    except Exception as e:
        print(f"[TOOL FAIL] {_err(e)}")
        ok = False
    return ok


async def main() -> int:
    load_dotenv(AGENT_DIR / ".env")
    if not os.environ.get("SARVAM_API_KEY") or "your-" in os.environ["SARVAM_API_KEY"]:
        print("SARVAM_API_KEY missing or still a placeholder in agent/.env")
        return 2
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else AGENT_DIR / "smoke_output"
    out_dir.mkdir(parents=True, exist_ok=True)

    async with aiohttp.ClientSession() as session:
        speech_ok = await run_speech(out_dir, session)
    llm_ok = await run_llm()
    print(f"\nAudio saved in: {out_dir}")
    print("RESULT:", "PASS" if speech_ok and llm_ok else "FAIL")
    return 0 if speech_ok and llm_ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
