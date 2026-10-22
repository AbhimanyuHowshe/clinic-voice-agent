# Clinic AI Voice Agent — Progress Log

Record only verified results here. Do not mark an item done until it has actually been tested or confirmed.

## Current Status

- **Current phase:** Phases 2–6 built (2026-10-22); deployment (Phase 8) waits on user actions.
- **Next tasks:**
  1. The user fixes `agent/.env` and `dashboard/.env.local` with `scripts/set_env.py` (both currently hold invalid values; see Pending User Actions).
  2. Run `RUN_DB_TESTS=1 uv run pytest tests/test_db.py` (database functions: concurrency, idempotency, schedules).
  3. Create a staff login (`scripts/create_staff.py`), then click through the dashboard locally.
  4. Voice test through the web app (`npm run dev` + `lk agent dev`): book, reschedule, cancel, emergency OFF mid-call.
  5. Deploy: `lk cloud auth` + `lk agent create`, then Vercel.

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

### 2026-10-22: Live test fixes (commit `3aaaaf6`)
- **Test-harness race:** `on_enter`'s Hinglish greeting landed inside `session.run()`, so `judge()` graded the greeting, not the reply. Added `start_after_greeting()` to wait for the greeting to finish playing.
- **Real bug found after that:** the agent replied in Hindi to English messages, following its own Hinglish greeting. The prompt now follows the patient's latest message. In the following 7 runs, no judge flagged a Hindi reply to English.
- Added concrete phrasing for the acknowledgement and the read-back ("..., is that right?"). One run still said "I have noted...". That run used the older prompt; whether it recurs with the concrete phrasing is unverified.
- Live suite **not yet consistently green.** Over 4 runs: 7/7, 6/7, 5/7, 6/7. The failures were mostly the judge penalising the read-back question (the test intent is now reworded but **not rerun**) and sometimes not using the name "Rahul". The last run hit **Sarvam 429 rate limits**.
- The user wants to show the MVP to a client today. Paused live test runs to save Sarvam quota; the worker is running locally for the demo via the Agents Playground.

### 2026-10-22: Database, booking workflow, web app (commits `737e361`, `822da6c`)
- **Google Sheets sync** added to `plan.md` as Phase 10, deferred until after the demo (user decision).
- **Supabase migrations applied** to the linked project with `npx supabase db push` (4 migrations, no errors), and the **demo seed applied** with `--include-seed`. Contents:
  - Tables from CLAUDE.md plus `doctor_schedules` and `clinic_holidays`. `appointments` has a GiST **exclusion constraint** so two live bookings for one doctor cannot overlap, even under concurrency.
  - Functions: `agent_effective_state` (manual OFF > holiday > pause > schedule; clinic time zone; overnight windows), `available_slots` (only from consulting hours, minus holidays, past times and booked slots), `book_appointment` (idempotency key, rechecks agent availability, returns `slot_taken` on a race), `find/cancel/reschedule_appointment` (6-digit reference + phone, idempotent).
  - RLS: `anon` gets nothing; staff read their own clinic; admins change config; any staff member can pause the agent; booking functions are `service_role` only. Audit triggers on config and appointments, with patient name and phone removed from audit rows.
  - **Not verified yet:** the functions have not been called, because Supabase rejects the key in `agent/.env` ("Invalid API key"). `tests/test_db.py` (9 tests) is written and waiting.
- **LangGraph workflow** (`agent/clinic/workflow.py`): agent node (ChatSarvam with tools) ⇄ ToolNode. Tools: `check_availability`, `prepare_booking`, `prepare_cancellation`, `prepare_reschedule`, `confirm_pending_action`, `escalate_to_staff`. Rules enforced in code: confirm only runs in a later patient turn than the prepare; slots must come from the database; availability is rechecked before every change; one idempotency key per pending booking, kept after a failed write. FAQs and doctors are loaded from Supabase into the prompt at call start.
- **Bug found and fixed:** in LLMAdapter's `messages` stream mode, tool results (e.g. "Held, NOT booked yet…") were **spoken aloud**. The graph now streams only the model's text through `get_stream_writer()` with `stream_mode="custom"`.
- **Bug found and fixed:** the model replied in Hinglish to English messages. The agent node now detects the language of the latest patient message (Devanagari → Hindi; 2+ common romanized Hindi words → Hinglish; else English) and pins it for that turn.
- `receptionist.py` changes:
  - The clinic is chosen from the room name `clinic-<slug>-<random>`.
  - When the agent is unavailable, it speaks the fallback message (plus the staff number in `transfer` mode) and hangs up.
  - A recheck every 60 s applies `ongoing_call_policy`: `finish` blocks changes, `end` says goodbye.
  - Each call is logged with outcome and actions only.
- **Tests:**
  - Offline `uv run pytest`: **37 passed**, 9 skipped (live/db).
  - Live `RUN_LIVE_TESTS=1 uv run pytest tests/test_receptionist.py`: **8 passed**. Covered: English and Hindi replies, an FAQ answered from data, no fee guessing, emergency → 112, no prescribing, and a full booking against FakeRepo (read-back, nothing booked before "yes", booked with a reference after "yes"). After fixing the judge wording on the booking test, the full suite passed once. Earlier history shows the judge can be flaky.
- **Web app** (`dashboard/`, Next.js 15.5.4): patient voice page, `/api/token`, staff login, and dashboard pages (overview with emergency OFF and quick pauses, appointments, agent controls, doctors, FAQs, calls, audit).
  - `npm run build`: **passed** (types and lint).
  - Local `next start` check: `/` returns 200; `/dashboard` redirects to `/login` when signed out; `/api/token` rejects unknown clinics (400) and returns a token for `sanjeevani`.
  - Found: `dashboard/.env.local` has an invalid `LIVEKIT_URL` (the placeholder repeated, as if several lines were pasted at once). `set_env.py` now rejects placeholders, pasted variable names and whitespace.
- Added `agent/Dockerfile` and `.dockerignore` for `lk agent create`. **Not built yet** (Docker Desktop not running).
- `scripts/create_staff.py` creates dashboard logins (sign-up is off).
- Not tested yet: dashboard pages against real data (no staff login yet), voice through the web app, `test_db.py`, deployment.

## In Progress

- Waiting on the user's credential fixes to run `tests/test_db.py` and the dashboard against real data.

## Pending User Actions

- **Fix `agent/.env` and `dashboard/.env.local`** with `cd agent && uv run python scripts/set_env.py`, in your own terminal, pasting one value at a time.
  - Supabase rejects the current `SUPABASE_SERVICE_ROLE_KEY` ("Invalid API key").
  - `dashboard/.env.local` has a broken `LIVEKIT_URL`.
  - `python-dotenv` can't parse line 12 of `agent/.env`. The script rewrites the known lines, but check the file for leftover junk.
- **Rotate the LiveKit API key** (exposed in a Claude session on 2026-10-21).
- **Run `lk cloud auth`** (opens a browser) for `lk agent dev/create/deploy`.
- **Run `vercel login`**, or import the repo in the Vercel dashboard (Root Directory `dashboard`).
- **Push to GitHub:** commits on `main` are local only. Waiting for the user's go-ahead.
- **Confirm the Supabase region** (Mumbai vs Seoul, recorded inconsistently).
- Optional: upgrade local Node to 22 (supabase-js 2.118 warns on Node 20; the build still passes).

## Open Questions

- **CRM / practice-management integration** (asked 2026-10-21): there is none, and no CRM is in the plan. Supabase is the system of record. The suggested approach is a sync layer from Supabase to an external system added after the core booking flow works, targeting clinic booking software (e.g. Cliniko, Halaxy, HotDoc, Practo) rather than a sales CRM. API access and terms are not verified. Waiting for the user to name a target system.

## Not Yet Done

- Database functions have not been run against the real project (`test_db.py` is blocked on the key).
- Dashboard not clicked through with a real staff login. No automated UI or RLS tests yet: the RLS policies are written but untested from an `authenticated` session.
- Voice: no test through the web app yet. Interruptions, silence and timeouts are untested. Hindi and Hinglish are only tested in text.
- Deployment: the agent image is not built; nothing is on LiveKit Cloud or Vercel yet.
- Voicemail fallback is not implemented (it plays the closed message). There is no live call transfer: `transfer` mode speaks the staff number.
- A turn-detector model is not enabled. No non-Indian TTS voice for the Australian clinic yet.
- `/api/token` has no rate limit: anyone with the URL can start sessions, up to the LiveKit plan caps.
- Phase 9 (telephony) and Phase 10 (Google Sheets) are not started.

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
| langchain-sarvam | 0.1.2 (live-tested 2026-10-21; tool calls through LangGraph 2026-10-22) |
| tzdata | 2025.2 (needed for zoneinfo on Windows) |
| next / react | 15.5.4 / 19.1.0 |
| @supabase/supabase-js / @supabase/ssr | 2.118.0 / 0.12.7 |
| livekit-server-sdk / livekit-client / @livekit/components-react | 2.19.2 / 2.23.0 / 2.9.24 |
| sarvamai | 0.1.37 |
| openai (transitive) | 3.35.1 |
| onnxruntime (transitive) | 1.31.0 |
| supabase | 2.33.0 |
| pytest / pytest-asyncio | 9.1.1 / 1.4.0 |
| Supabase CLI (npx) | 2.121.0 |

## Environment Variables

Clinic time zones now come from the `clinics` table (`CLINIC_TIMEZONE` was removed).

| Variable | Where | Purpose |
|----------|-------|---------|
| `LIVEKIT_URL` | agent, dashboard (server) | LiveKit Cloud project URL |
| `LIVEKIT_API_KEY` | agent, dashboard (server) | LiveKit API key |
| `LIVEKIT_API_SECRET` | agent, dashboard (server) | LiveKit API secret |
| `SARVAM_API_KEY` | agent | Sarvam AI API key |
| `SUPABASE_URL` | agent | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | agent | Server-only Supabase secret key; never sent to a browser |
| `DEFAULT_CLINIC_SLUG` | agent | Clinic for rooms not created by the web app (default `sanjeevani`) |
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
