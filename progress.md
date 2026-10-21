# Clinic AI Voice Agent — Progress Log

Record only verified results here. Do not mark an item done until it has actually been tested or confirmed.

## Current Status

- **Current phase:** Phase 1 — Minimal Voice Agent
- **Next task (resume 2026-10-22):**
  1. Fix the one failing live test, `test_receptionist_reply[en]` (see the 2026-10-21 voice test entry below), then rerun the live suite twice.
  2. The user runs `lk cloud auth` once (it opens a browser), then retests by voice with `lk agent dev` and the Agents Playground: check the name prompt, whether the agent still cuts the patient off, interruptions and silence.
  3. Deploy with `lk agent deploy`, then scaffold the Next.js voice page.

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

### 2026-10-21: Phase 1 minimal voice agent
- Added `agent/receptionist.py`: `AgentServer` with a Silero VAD prewarm, and an `AgentSession` using Sarvam STT (`saaras:v4`, language `unknown`), `sarvam.LLM` (`sarvam-105b-conversations`) and Sarvam TTS (`bulbul:v3`, `priya`, `hi-IN`). It has a receptionist prompt (reply in the patient's language, never invent clinic facts, no diagnosis or prescribing, 112 for emergencies) and `record=False`. Written against the installed 1.8.8 source.
- `agent/tests/test_receptionist.py`: **6 passed, twice in a row** with `RUN_LIVE_TESTS=1`. These are text-mode `AgentSession.run` tests against the real Sarvam LLM, graded by `judge()`. They cover an English reply, a Hindi reply, no made-up timings or fees, emergency → 112, and no prescribing. The first run failed "no-prescribing": the agent refused but didn't suggest seeing a doctor. Fixed in the prompt. Live tests are skipped by default; the offline suite gives 10 passed, 6 skipped.
- `uv run python receptionist.py dev` **registered a worker with LiveKit Cloud** (region "India South", protocol 18). Not yet tested: a real room session with audio. The `dev` subcommand is deprecated in favour of `lk agent dev` (lk CLI 2.18.8 is installed).
- Not done yet: a spoken conversation, interruption, silence and timeout testing, a turn-detector model (VAD plus STT endpointing for now), and deployment.

### 2026-10-21: First spoken test (Agents Playground)
- The user spoke to the agent through the Agents Playground with the worker running via `receptionist.py dev`. The job was received and the session ran (room `console-6b7a3b3c`).
- `lk agent dev` failed with `api-key is required`. The `lk` CLI does not read `agent/.env` and has no configured project. The user needs to run `lk cloud auth`.
- User feedback: **the agent did not ask for their name.** The Phase 1 prompt had no such rule.
- Log findings:
  - "transcript arrives after turn has been committed": Sarvam's transcript arrived after the 0.5 s endpoint, so the agent may reply before hearing the whole sentence. Set `turn_handling={"endpointing": {"min_delay": 0.8}}`. **Not yet re-verified by voice.**
  - "no warmed process available": in dev mode the first call waits about 2 s while a process starts. "VAD inference is slower than realtime" (0.5 s) appeared once at session start on this laptop.
- Prompt changes: acknowledge the request, then ask the patient's name and use it. For appointments, ask one question at a time (doctor or service, then day and time) and repeat the details back. Removed "offer to note the request", because nothing is saved yet, so it was a false promise. The agent must not say anything is booked, noted or saved.
- Added `test_receptionist_asks_name_then_uses_it` (two turns).
- **Live tests: 6 passed, 1 failed (two runs).** The failure is `test_receptionist_reply[en]` ("I'd like to see a doctor next week"). The reply asks for name and doctor, but the judge says it doesn't acknowledge the request, and in one run it answered in Hindi instead of English. Possible causes: the Hinglish greeting pulls later replies toward Hindi, or the judge's wording is too strict. Investigate before changing the test. Offline suite: 10 passed, 7 skipped.

## In Progress

- **Phase 1 prompt fix (WIP, commit `9b47765`).** `test_receptionist_reply[en]` fails. The reply to "I'd like to see a doctor next week" asks for name and doctor without acknowledging the request, and once it answered in Hindi. The other 6 live tests pass.

## Pending User Actions

- **Rotate the LiveKit API key.** Real credentials had been pasted into `dashboard/.env.example`; they were never committed, but a Claude session saw them. Put the new values only in `agent/.env` and `dashboard/.env.local`.
- **Fix line 12 of `agent/.env`**, which `python-dotenv` cannot parse.
- **Run `lk cloud auth`** (it opens a browser). Both `lk agent dev` and `lk agent deploy` need it.
- **Push to GitHub:** 8 commits on `main` are local only (up to `9b47765`). Waiting for the user's go-ahead.
- **Confirm the Supabase region.** This log records it as Mumbai (user report), but `plan.md` and Known Limitations say Seoul (`ap-northeast-2`). Check `supabase projects list`.

## Open Questions

- **CRM / practice-management integration** (asked 2026-10-21): there is none, and no CRM is in the plan. Supabase is the system of record. The suggested approach is a sync layer from Supabase to an external system added after the core booking flow works, targeting clinic booking software (e.g. Cliniko, Halaxy, HotDoc, Practo) rather than a sales CRM. API access and terms are not verified. Waiting for the user to name a target system.

## Not Yet Done

- Supabase: no connection test from code yet, no migrations, and free-tier quotas not checked.
- Phase 1: voice retest after the endpointing and prompt changes; interruption, silence and timeout tests; Hindi and Hinglish tested by speech (so far only text tests); `lk agent deploy`; the Next.js voice page and token route; Vercel deployment.
- A turn-detector model is not enabled; turn-taking relies on VAD plus STT endpointing.
- No TTS for the Australian clinic yet (Sarvam has no non-Indian voice).

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
- Sarvam STT and TTS support only Indian (`*-IN`) language codes, with no `en-AU`. Australian speech will be transcribed as `en-IN`, which needs testing for accuracy. The live API rejects `amelia` (and presumably `sophia`) and offers only Indian voices, so the Australian clinic needs a different TTS provider. See Scope in plan.md.

- `SARVAM_API_KEY` and `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` are confirmed working with the installed SDKs (smoke test and worker registration, 2026-10-21). The Supabase and dashboard variable names are still provisional.
- `sarvam-105b` is unusable for voice (about 8 s to first token, empty replies at small `max_tokens`). Use `sarvam-105b-conversations`.
- STT returns Hinglish speech in Devanagari script (`transcribe` mode). `codemix` and `translit` modes are untested.
- In dev mode the first call waits about 2 s for a worker process (no warmed process). VAD ran 0.5 s slower than realtime once at session start on the development laptop.
- With no clinic data, the LLM invents facts (opening hours) unless the prompt forbids it. FAQ answers must be grounded in `clinic_faqs` (Phase 2/3).

## Secrets Handling

- Claude does not read, print, or access `.env` files, API keys, or other secrets. The user fills in real values locally.
- Only `.env.example`, with placeholder values, is created or edited by Claude.
