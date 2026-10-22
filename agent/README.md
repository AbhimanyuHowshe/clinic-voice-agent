# Voice Agent

Python service built on LiveKit Agents:

```
patient speech → Sarvam STT (saaras:v4) → LangGraph workflow → Sarvam TTS (bulbul:v3) → patient
                                            │
                                            ├─ ChatSarvam (sarvam-105b-conversations) with tools
                                            └─ Supabase Postgres functions (slots, booking, cancel, reschedule)
```

- `receptionist.py` — LiveKit entrypoint. Picks the clinic from the room name (`clinic-<slug>-<random>`,
  otherwise `DEFAULT_CLINIC_SLUG`), checks the server-side availability before talking, logs the call
  (no transcript), and rechecks availability every 60 s during the call.
- `clinic/workflow.py` — the LangGraph graph, tools, and prompt. Bookings, cancellations and reschedules
  are two-step: a `prepare_*` tool validates against real data, and `confirm_pending_action` only runs in a
  later patient turn (after the read-back). Tool results are never spoken.
- `clinic/repository.py` — Supabase access (service-role key, server-only). All writes go through the
  Postgres functions in `../supabase/migrations`.

## Setup

Requires Python 3.11–3.13 and [uv](https://docs.astral.sh/uv/).

```
cd agent
uv sync
uv run python scripts/set_env.py      # fills .env (hidden prompts); run it in your own terminal
uv run python scripts/create_staff.py # creates a dashboard login linked to a clinic
```

## Run locally

```
lk agent dev                           # needs `lk cloud auth` once; or: uv run python receptionist.py dev
uv run python receptionist.py console  # local mic/speakers, no browser
```

Then open the web app (`../dashboard`, `npm run dev`) or https://agents-playground.livekit.io. Playground
rooms use `DEFAULT_CLINIC_SLUG`.

## Deploy to LiveKit Cloud

```
lk cloud auth                                  # once, opens a browser
lk agent create --secrets-file .env .          # first deploy: builds the Dockerfile in this folder
lk agent deploy .                              # later deploys
lk agent logs                                  # check it started
```

The image contains no secrets (`.dockerignore` excludes `.env`); LiveKit Cloud injects them.

## Tests

```
uv run pytest                                              # offline: workflow guards, graph routing, parsing
RUN_LIVE_TESTS=1 uv run pytest tests/test_receptionist.py   # real Sarvam LLM through the graph (costs credits)
RUN_DB_TESTS=1 uv run pytest tests/test_db.py               # real Supabase functions (temporary test clinic)
```

Run live test files one at a time to avoid Sarvam 429 rate limits.
