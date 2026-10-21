# Voice Agent

Python service built on LiveKit Agents. It handles real-time voice sessions, uses Sarvam AI for speech-to-text and text-to-speech, and runs the receptionist workflow as a LangGraph graph.

Phase 1 status: `receptionist.py` is a minimal voice receptionist (Sarvam STT → `sarvam-105b-conversations` → Sarvam TTS) with no clinic data or tools yet. Dependencies are pinned in `pyproject.toml` and locked in `uv.lock`. Tested versions are listed in `../progress.md`.

## Setup

Requires Python 3.11–3.13 and [uv](https://docs.astral.sh/uv/).

```
cd agent
uv sync            # creates .venv and installs pinned dependencies
uv run pytest      # offline compatibility tests (no API keys needed)
```

Configuration: copy `.env.example` to `.env` and fill in real values locally.

## Run the agent

```
uv run python receptionist.py console   # talk via your local mic and speakers (no browser)
lk agent dev                             # or: uv run python receptionist.py dev (deprecated)
```

With the worker running, open https://agents-playground.livekit.io, sign in to the LiveKit project and connect. The agent auto-joins new rooms.

## Tests

```
uv run pytest                                            # offline; live tests are skipped
RUN_LIVE_TESTS=1 uv run pytest tests/test_receptionist.py # real Sarvam LLM calls (costs credits)
```
