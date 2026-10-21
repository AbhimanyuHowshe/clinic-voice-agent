# Voice Agent

Python service built on LiveKit Agents. It handles real-time voice sessions, uses Sarvam AI for speech-to-text and text-to-speech, and runs the receptionist workflow as a LangGraph graph.

Not yet implemented. Dependencies are pinned in `pyproject.toml` and locked in `uv.lock`. Tested versions are listed in `../progress.md`.

## Setup

Requires Python 3.11–3.13 and [uv](https://docs.astral.sh/uv/).

```
cd agent
uv sync            # creates .venv and installs pinned dependencies
uv run pytest      # offline compatibility tests (no API keys needed)
```

Configuration: copy `.env.example` to `.env` and fill in real values locally.
