# Clinic AI Voice Agent — Progress Log

Record only verified results here. Do not mark an item done until it has actually been tested or confirmed.

## Current Status

- **Current phase:** Phase 0 — Project Setup and Compatibility
- **Next task:** Build the minimal Phase 1 voice agent (Sarvam STT → `sarvam-105b-conversations` → Sarvam TTS) and run it in a LiveKit room. The live Sarvam smoke test passed on 2026-10-21.

## Completed

### 2026-10-21
- Created `CLAUDE.md` (project instructions).
- Created `plan.md` (development plan, Phases 0–9).
- Created `progress.md` (this file).
- Created `.gitignore`: excludes `.env` and `.env.*` (except `.env.example`), key and credential files, Python and Node build artifacts, Supabase local state, and call recordings and transcripts.
- Added `.claude/settings.json` with permission deny rules that stop Claude Code from reading or editing `.env` variants, `secrets/`, `*.pem`, `*.key`, and credential JSON files, and from dumping environment variables. `.env.example` is still allowed. The JSON is valid; the rules take effect after Claude Code restarts.
- Initialized the Git repository on branch `main` (git 2.43.0).
- Initial commit `3468479` pushed to https://github.com/AbhimanyuHowshe/clinic-voice-agent (`main` tracks `origin/main`).
- Created the directory structure: `agent/`, `dashboard/`, `supabase/migrations/`, each with a short README.
- Created root `README.md` and `.gitattributes` (stores files with LF line endings, which stops the CRLF warnings).
- Created `agent/.env.example` and `dashboard/.env.example` with placeholders only.
- Verified with `git check-ignore` that `agent/.env` and `dashboard/.env.local` are ignored and `agent/.env.example` is tracked.

- Decided on online hosting from Phase 1: the agent on LiveKit Cloud and one Next.js app (patient voice page and staff dashboard) on Vercel. Added a Hosting Approach section and deployment tasks to `plan.md`.
- Checked from vendor docs: the LiveKit Cloud Build (free) plan includes agent deployment, 1,000 agent minutes and 5,000 WebRTC minutes per month, 5 concurrent agent sessions, a hard usage cap, and 10–20 s cold starts. Vercel Hobby is non-commercial only. Sarvam plugin details were later corrected from the installed code; see the compatibility check below.

- User reported (not yet verified by a connection test): Supabase project `clinic-voice-agent` created on the Free plan in the Mumbai region with Data API on, public schema, automatic RLS on, and "Automatically expose new tables" off. Keys entered in `agent/.env` and `dashboard/.env.local`, and a new LiveKit API key created because the old secret could not be revealed.
- Created `agent/.env` and `dashboard/.env.local` from the examples (`git check-ignore` confirms both are ignored). Restored placeholders in `agent/.env.example` after real LiveKit values had been typed into it; they were never committed.
- Ran `npx supabase init` (CLI 2.121.0): this created `supabase/config.toml` (local `enable_signup` set to `false`) and `supabase/.gitignore`. Linked to project ref `sjjvrgiijdoqlezvplcm`. `supabase projects list` shows it as ACTIVE_HEALTHY with Postgres 17.
- Because "Automatically expose new tables" is off, migrations must include explicit `GRANT`s for the `anon`, `authenticated` and `service_role` roles.

- Scope changed: the project is a demo for prospective clients in India and Australia. It uses fictional data only. `plan.md` has a new Scope section.

### 2026-10-21: Phase 0 compatibility check (offline)
- Python 3.13.13 with uv 0.11.8. Created `agent/pyproject.toml` (exact pins) and `agent/uv.lock`, and installed into `agent/.venv`, which git ignores. `requires-python` is `>=3.11,<3.14` because `livekit-plugins-turn-detector` 1.8.8 needs onnxruntime ≥1.30, which has no build for Python 3.10.
- Checked the publishers: `livekit-plugins-sarvam` and `livekit-plugins-langchain` come from LiveKit, `langchain-sarvam` from Sarvam AI, and `httpx2` (a sarvam plugin dependency) from the pydantic/httpx project.
- Read from the installed sources:
  - **Sarvam STT:** models `saaras:v3` and `saaras:v4` (the default; `saarika:v2.5` and `saaras:v2.5` are sunset). Modes are transcribe, translate, verbatim, translit and **codemix**, which may suit Hinglish. Language codes are Indian `*-IN` codes plus `unknown` for auto-detect. **There is no `en-AU`.**
  - **Sarvam TTS:** models `bulbul:v2`, `bulbul:v3` (the default), `bulbul:v3-beta` and `bulbul:v4-flash`. Target languages are Indian `*-IN` codes only. `bulbul:v3` includes voices labelled "International" (`amelia`, `sophia`); whether they suit Australian clients is untested.
  - **Sarvam LLM** (`sarvam.LLM`, built on OpenAI-compatible LiveKit code): models `sarvam-105b` (the default), `sarvam-105b-conversations`, `gemma4` and `glm5.2`. `sarvam-30b` is **not** in this version.
  - **LangGraph adapter:** `livekit.plugins.langchain.LLMAdapter(graph, config=, context=, subgraphs=, stream_mode="messages"|"custom")`. Tool execution happens inside the graph, not in LiveKit.
  - **`langchain_sarvam.ChatSarvam`:** supports `bind_tools`, `with_structured_output` and async streaming, and reads `SARVAM_API_KEY`.
- `agent/tests/test_compat.py`: **10 passed** (`uv run pytest tests`). These are offline tests with no network or keys. They show that a LangGraph graph streams tokens through `LLMAdapter`, that the adapter rejects unsupported stream modes, and that the Sarvam STT, TTS, LLM and `ChatSarvam` constructors accept the planned models, languages and voices.
- **Not yet verified:** live calls to Sarvam (STT, TTS, LLM streaming and tool calling) with a real key, and a real LiveKit room session.

### 2026-10-21: Live Sarvam smoke test
- `uv run python scripts/smoke_sarvam.py`: **PASS** (after the fixes below). Offline tests: **10 passed**.
  - TTS `bulbul:v3`: `priya` (hi-IN, en-IN) and `shubh` (en-IN) synthesized in 0.5–1.2 s.
  - STT `saaras:v4`, language `unknown`: English round trip exact (0.20 s, detected `en-IN`). The romanized Hinglish sentence came back **in Devanagari** (detected `hi-IN`, 0.30 s). Try `mode="codemix"` or `translit` if the graph needs Latin script.
  - LLM `sarvam-105b-conversations` via `ChatSarvam`: streamed 5 chunks, first token 0.32 s. Tool call `check_availability(doctor="Dr. Sharma", date="2026-10-22")` correct, so it resolved "tomorrow".
- Findings and fixes:
  - **`sarvam-105b` is a reasoning model and is unsuitable for voice.** With `max_tokens=150` it returned empty content (`finish_reason=length`); `reasoning_effort="low"` still returned empty at 1,000 tokens. Without that setting it took about 8.2 s to the first token (about 600 output tokens). `sarvam-105b-conversations` answered in 0.14–0.32 s. Switched the smoke test and offline tests to it.
  - **The `amelia` voice is rejected by the live API** (400, "Speaker 'amelia' is not recognized" for `bulbul:v3`), even though the plugin lists it. The API's valid speakers are Indian names only, so **Sarvam has no non-Indian English voice. The Australian demo clinic needs a different TTS.** Replaced the sample with `shubh`.
  - The Hindi STT "failure" in the first run was a Windows console `UnicodeEncodeError` (cp1252 cannot print Devanagari), not an API error. The script now sets UTF-8 on stdout.
  - With no clinic data, the LLM **made up opening hours** ("subah 9 baje"). FAQ answers must be grounded in `clinic_faqs` with an explicit "I don't know" rule (Phase 2).
  - `python-dotenv` warns it cannot parse line 12 of `agent/.env`. The user must fix that line (Claude does not read `.env`).
- Security: real LiveKit credentials had been pasted into the tracked `dashboard/.env.example` (never committed; `git log -S` finds nothing). Restored the placeholders. The values were exposed in a Claude session, so the user should rotate that LiveKit API key.

## In Progress

_None._

## Not Yet Done (Phase 0)

- LiveKit Cloud, Sarvam AI, and Supabase accounts and API access not set up or verified (the user does this; Claude never handles the keys).
- SDK and package compatibility not yet verified; no dependency versions recorded.
- Free-tier quotas not yet confirmed.

## Verified Dependency Versions

Installed and checked offline on 2026-10-21 with Python 3.13.13 on Windows 11. Live API checks are still pending.

| Package | Version |
|---|---|
| livekit-agents | 1.8.8 |
| livekit-plugins-sarvam | 1.8.8 |
| livekit-plugins-langchain | 1.8.8 |
| livekit-plugins-silero | 1.8.8 |
| livekit-plugins-turn-detector | 1.8.8 |
| livekit-plugins-openai (transitive) | 1.8.8 |
| livekit (rtc) | 1.1.20 |
| livekit-api | 1.2.2 |
| langgraph | 1.2.16 |
| langchain-core | 1.6.12 |
| langchain-sarvam | 0.1.2 (live-tested 2026-10-21) |
| sarvamai | 0.1.37 |
| openai (transitive) | 3.35.1 |
| onnxruntime (transitive) | 1.31.0 |
| supabase | 2.33.0 |
| pytest / pytest-asyncio | 9.1.1 / 1.4.0 |
| Supabase CLI (npx) | 2.121.0 |

## Environment Variables

Provisional names, to be confirmed against the SDKs in Phase 0–1:

| Variable | Where | Purpose |
|----------|-------|---------|
| `LIVEKIT_URL` | agent, dashboard (server) | LiveKit Cloud project URL |
| `LIVEKIT_API_KEY` | agent, dashboard (server) | LiveKit API key |
| `LIVEKIT_API_SECRET` | agent, dashboard (server) | LiveKit API secret |
| `SARVAM_API_KEY` | agent | Sarvam AI API key |
| `SUPABASE_URL` | agent | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | agent | Server-only Supabase key; never sent to a browser |
| `CLINIC_TIMEZONE` | agent | Default clinic time zone (`Asia/Kolkata`) |
| `NEXT_PUBLIC_SUPABASE_URL` | dashboard (public) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dashboard (public) | Supabase anon key, restricted by RLS |

## Known Limitations

- The Supabase project is in `ap-northeast-2` (Seoul). Since the project became a demo for both India and Australia (2026-10-21), it stays there: Seoul sits between the two. A real client deployment would get its own project in the client's region. The migrations are in the repo, so this means re-linking and running `supabase db push`.
- Sarvam STT and TTS support only Indian (`*-IN`) language codes, with no `en-AU`. Australian speech will be transcribed as `en-IN`, which needs testing for accuracy. Voices may sound Indian-accented; `amelia` and `sophia` are labelled International but are untested. See Scope in plan.md.

- Environment variable names are provisional until checked against the installed SDKs.

## Secrets Handling

- Claude does not read, print, or access `.env` files, API keys, or other secrets. The user fills in real values locally.
- Only `.env.example`, with placeholder values, is created or edited by Claude.
