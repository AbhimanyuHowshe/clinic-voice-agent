# Clinic AI Voice Agent — Progress Log

Record only verified results here. Do not mark an item done until it has actually been tested or confirmed.

## Current Status

- **Current phase:** Online demo. Agent on LiveKit Cloud (Mumbai), web app on Vercel at https://clinic-voiceagent.vercel.app (2026-10-23). Scope: website voice agent only; the phone line comes later. Demo stays on LiveKit + Sarvam + LangGraph (user decision, 2026-10-22).
- **Next tasks:**
  1. Check the new dashboard look and the doctor cards on Vercel, logged in (not yet seen by Claude; the local server was stopped for low memory before the user checked it).
  2. More real calls on the live site, on laptop and phone (Chrome / Safari), including a booking that shows on the dashboard.
  3. Latency improvements offered but **not started** (user to decide):
     - Move Supabase to Mumbai (needs the user to create the project).
     - Drop the extra availability call before confirm (~0.4 s).
     - A filler phrase while tools run.
     - Tune endpointing 1.2 s → ~0.9 s.
     - Try Bulbul v4 Flash.
  4. Later: `DEMO_ACCESS_CODE` on Vercel before sharing widely (user: "we will do it later").
  5. Phone line (Phase 9): the clinic keeps its own number and sets **call forwarding** once (busy / no answer) to an AI number from an Indian SIP provider. Needs KYC. When the agent is OFF, a forwarded call must not be told the clinic's own number; add a proper message or voicemail first.

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
  - Offline `uv run pytest`: **37 passed**, 17 skipped (8 live, 9 db).
  - Live `RUN_LIVE_TESTS=1 uv run pytest tests/test_receptionist.py`: **8 passed**. Covered: English and Hindi replies, an FAQ answered from data, no fee guessing, emergency → 112, no prescribing, and a full booking against FakeRepo (read-back, nothing booked before "yes", booked with a reference after "yes"). After fixing the judge wording on the booking test, the full suite passed once. Earlier history shows the judge can be flaky.
- **Web app** (`dashboard/`, Next.js 15.5.4): patient voice page, `/api/token`, staff login, and dashboard pages (overview with emergency OFF and quick pauses, appointments, agent controls, doctors, FAQs, calls, audit).
  - `npm run build`: **passed** (types and lint).
  - Local `next start` check: `/` returns 200; `/dashboard` redirects to `/login` when signed out; `/api/token` rejects unknown clinics (400) and returns a token for `sanjeevani`.
  - Found: `dashboard/.env.local` has an invalid `LIVEKIT_URL` (the placeholder repeated, as if several lines were pasted at once). `set_env.py` now rejects placeholders, pasted variable names and whitespace.
- Added `agent/Dockerfile` and `.dockerignore` for `lk agent create`. **Not built yet** (Docker Desktop not running).
- `scripts/create_staff.py` creates dashboard logins (sign-up is off).
- Not tested yet: dashboard pages against real data (no staff login yet), voice through the web app, `test_db.py`, deployment.

### 2026-10-22: Phone-number lookup replaces reference numbers; keys verified
- **User decision:** patients no longer need a reference number. To cancel or move an appointment they give the phone number used to book; the agent lists that number's upcoming appointments. **Scope for now: website voice agent only; the phone line (Phase 9) comes later.**
  - Migration `…05_phone_verification.sql` applied: `find_appointments_by_phone`, and `cancel_appointment` / `reschedule_appointment` now take an appointment id **and** require the same phone number. `find_appointment` (reference-based) was dropped. The `reference` column stays for staff in the dashboard. The agent no longer reads it out.
  - Trade-off: anyone who knows a patient's phone number can cancel or move their appointment. Acceptable for the demo. When phone calls are added, caller ID or an SMS code can harden this.
- **Two confirmation problems found by live tests, both fixed in code:**
  - Cancelling asked for confirmation twice. When the purpose is "cancel" and exactly one appointment matches, `find_appointments` now holds the cancellation itself, so a single "yes" confirms it.
  - On "yes", the model re-prepared the same booking, which reset the hold and blocked the confirm. Re-preparing an identical action now keeps the original hold. A changed request is still a new hold that needs its own "yes".
- **Keys:** added `scripts/check_keys.py`. It makes a real request to each service and prints only OK/FAIL, never the values. All 5 checks pass: agent Supabase, LiveKit and Sarvam; dashboard Supabase publishable key and LiveKit.
- **Tests:**
  - Offline: **39 passed**.
  - Database `RUN_DB_TESTS=1 uv run pytest tests/test_db.py`: **9 passed** against the real project. Covered: slots only from consulting hours; idempotent booking; **6 simultaneous bookings for one slot → exactly 1 succeeds**; invented/off-grid times and bad phones rejected; phone-verified cancel and reschedule; availability precedence including an overnight window, a pause, a holiday and manual OFF; booking refused when OFF; settings changes audited; appointment audit rows hold no patient details.
  - Live: **9 passed, twice in a row**. This adds a cancel-by-phone conversation (nothing cancelled before "yes"; cancelled after).

### 2026-10-22 (afternoon): Voice testing through the website, fixes from real calls
All fixes below came from the user's own calls on http://localhost:8000. Logs were read with patient names and numbers redacted. Commits `0aa9b3f` to `fb17260`.

**Times and slots**
- **Bug: slots were spoken in UTC** ("3:30 AM" for 9:00 AM IST). The real database returns UTC instants, and the fake test repo returned clinic time, so tests missed it. Fixed: slots are converted to clinic time, and the fake repo now returns UTC.
- "10 AM", "5:30 PM" and "9.30" are accepted (previously only 24-hour HH:MM).
- Free times are listed one by one (up to 8) or as "every 15 minutes from 9:00 AM to 12:45 PM, and from 5:00 PM to 7:45 PM", so a lunch break is not mistaken for free time.
- `check_availability` takes an optional time and answers YES/NO from the database with the two nearest free times. Real call: the agent said it had "noted" an already-booked 5 PM. No double booking happened; the database blocked it.

**Language**
- The reply language is sticky, and Hindi replies are written in Devanagari (the TTS reads it better).
- The greeting is English plus one Hindi sentence offering Hindi.
- The language changes only when the patient asks ("English please", "English mein baat karo", "हिंदी में बोलिए", or just "English") or speaks the other language in two clear messages in a row. Digits, "no/now", and yes/no and filler words never switch it.

**Confirmations (enforced in code)**
- A clear "no" discards the held action; confirm needs a clear yes in the latest message. Real call: "No, please cancel" led the model to hold the booking again. Nothing was booked.
- Re-preparing an identical action keeps the original hold. After a yes, a re-lookup says "confirm now" instead of asking again.

**Phone numbers**
- Spoken numbers are converted in code: digits, double/triple, English and Hindi digit words, and Devanagari numerals.
- Accent and STT variants are accepted ("Naini" = 9), with a close-match fallback for short replies while collecting.
- While a number is asked for or partly given, every "no"/"now"/"नो" is a 9, even a single one at the start. Real call: "nau nau nau" was transcribed as "No, no, no."
- Indian numbers must be exactly 10 digits. Digits given across several messages are joined in code. The agent asks only for the missing digits.
- Endpointing is 2.5 s / 4 s while collecting a number, and 1.2 s / 4 s otherwise.
- The read-back is grouped 3-3-4 ("9 9 9, 9 9 9, 9 9 9 9"), with TTS pace 0.9.
- The agent asks for "your 10-digit mobile number, slowly".
- Limit: STT still drops a digit in runs of one repeated digit (e.g. 9999999999); the agent then asks for the missing digit.

**Conversation flow**
- Cancel or move: the order is name → which doctor → phone. `find_appointments` requires the name and the doctor (or "any"), and filters by doctor.
- Booking: the agent asks which doctor or specialty and never picks one itself.
- `end_call` tool: the agent asks "anything else?" and hangs up after a clear goodbye (not while a change is unconfirmed).
- Silence: after 20 s it asks "are you still there?"; after 20 s more it says goodbye and hangs up.
- Tool calls and results are logged with patient names and phone numbers redacted.

**Dashboard**
- The user's Supabase-created login was not linked to a clinic, so the dashboard showed the bare "No clinic access" page. Linked it as admin of Sanjeevani.
- Overview shows the next 7 days; Appointments defaults to all upcoming (a booking for tomorrow was invisible before).
- **Live updates:** migration `…06_realtime.sql` adds appointments, call_logs, agent_settings and temporary_pauses to `supabase_realtime`. A `LiveRefresh` component refreshes the page on changes, with a 30 s fallback.
- Verified with a temporary staff login: own-clinic events received, the other clinic's not. **Not yet watched in a real browser.**
- RLS verified with a temporary staff login (deleted afterwards): staff see only their clinic's appointments, cannot read the audit log or flip agent settings, and anon is blocked.

**Other**
- The web app moved to port **8000** (`npm run dev` / `npm start`), because port 3000 is used by another local project.
- `scripts/check_keys.py` tests each credential and prints only OK/FAIL. **All 5 OK** after the user fixed the keys.
- Database tests `RUN_DB_TESTS=1 uv run pytest tests/test_db.py`: **9 passed**. Covered: 6 concurrent bookings → 1 succeeds; idempotency; schedule, pause, holiday and overnight boundaries; phone-verified cancel/reschedule; audit without patient details.
- A shell heredoc had silently turned regex `\b` and `\1` into control characters. Fixed, and all agent files were scanned clean. Use Write/Edit or script files, not heredocs, for code containing backslashes.

**Tests at end of day:** offline **128 passed**. The live Sarvam suite has 16 tests. Every live test passed at least once after its last related change, but they were run in subsets: Sarvam rate limits (429) hit when the full suite was repeated back to back. Some live failures were the LLM judge misreading correct replies; the intents were reworded.

**Measured latency** (from the user's calls and timing scripts):
- Wait after the patient stops speaking: median 1.2 s (a setting; up to 4 s).
- Sarvam LLM first token: ≈ 120 ms.
- Supabase RPC: ≈ 400 ms each, because the project is in **Seoul** (`ap-northeast-2`, confirmed with `supabase projects list`).
- Turns with a database tool call: +≈ 1.5 s.

**Pricing estimate** (not a bill; check sarvam.ai/api-pricing):
- Sarvam STT ₹0.49/min, Bulbul v3 TTS ₹3 per 1,000 characters, sarvam-105b ≈ ₹15/1M input tokens (third-party figure).
- LiveKit Build is free up to 1,000 agent-min/month; Ship is $50/month plus $0.01/min.
- Total ≈ ₹1.8 per call-minute in the demo, ≈ ₹2.7 after the free LiveKit minutes.

**Questions answered, no changes made** (user asked not to change the plan):
- Sarvam has no single speech-to-speech model; its voice stack is STT → LLM → TTS.
- Sarvam Conversations (managed platform, from ≈ ₹3/min with telephony) could use this dashboard and database through webhooks. It would replace the LangGraph code-level guards unless they are rebuilt in webhooks. An untested comparison was given.
- Dropping LiveKit: possible via Sarvam's platform or a custom transport. Not recommended for the demo.

### 2026-10-23: Online launch; doctor cards; new dashboard look
**Launch**
- GitHub: `AbhimanyuHowshe/clinic-voice-agent` (pushed with the user's go-ahead).
- Vercel blocked the first build: "Vulnerable version of Next.js detected" (CVE-2025-66478). Upgraded Next 15.5.4 → 15.5.28 and React 19.1.0 → 19.1.10 (`a4440a3`). Remaining `npm audit` items (bundled postcss, sharp) need Next 16; deferred.
- Vercel: https://clinic-voiceagent.vercel.app, Root Directory `dashboard`, 5 env vars set by the user. No `DEMO_ACCESS_CODE` for now (user decision). Verified by Claude: home 200, `/dashboard` → `/login` (307), login 200, `/api/token` returns a token for `sanjeevani` pointing at the LiveKit Cloud URL, unknown clinic → 400.
- LiveKit Cloud: the user ran `lk cloud auth` in their own PowerShell (it needs an interactive terminal). Deployed with `lk agent create --region ap-south --secrets-file .env --ignore-empty-secrets .` → agent `CA_buFJVUxGVFc7`, worker registered in "India South". `LIVEKIT_*` are injected by LiveKit Cloud and skipped from the secrets file. `agent/livekit.toml` (no secrets) committed (`d4eb132`).
- **First real call on the cloud agent worked** (user, 2026-10-23): it checked Dr. Kavita Rao for Friday and correctly said no slots (she works Tue/Thu/Sat 11:00–15:00 in the seed data), offering Saturday 11:00. Database `available_slots` confirmed 0 for that day.

**Dashboard**
- Appointments page lists **every doctor** as a card: specialty, working days, a green "Today: 11:00–15:00" / red "Not working today" / grey "Not taking bookings" badge for the chosen day, and the number booked. Clicking a card (or the new doctor dropdown) filters the table. Added because the user read "0 appointments" as "free today".
- New look across the dashboard: soft background, white cards with shadows, a sticky header with a logo mark, the active menu item underlined (`nav-links.tsx`), coloured status badges in tables, three stat cards on Overview, Inter font (`next/font/google`).
- Checks: `tsc --noEmit` and `eslint` clean. **Not visually checked by Claude** (pages need the user's login).

**Answered, no changes:** a phone line would not make calls smoother (8 kHz phone audio, extra hop); forwarding cost on Indian unlimited plans is usually nil, plus the SIP number's rent and per-minute fee (not verified).

### 2026-10-24: India clinic is now Dr. Singh Dental Clinic, Ujjain
- **Source:** drgovindsingh.com (home, about, doctors, services and contact pages, read 2026-10-24). No fees or per-doctor timings are published there, so the agent has no fees to quote.
- **The `sanjeevani` row is reused** (user choice): its slug, ID, staff logins and dashboard all stay the same. The name, phone (+91 7771818143), Ujjain address and FAQs (14, all from the site) are replaced. Harbourside (Australia) is unchanged.
- **Doctors:** Dr. Govind Singh and Dr. Preeti Singh (Dentist), Mon–Sat 11:00–19:00, which are the clinic hours. **The 30-minute slots are a demo assumption.** The old fictional doctors (Sharma, Mehta, Rao) are set to `active = false`, not deleted, because old appointments reference them.
- **Fixed welcome line:** the new `clinics.greeting` column (migration `20261024000001_clinic_greeting.sql`). When it is set, the agent speaks it word for word with `session.say`; when it is null, the model greets as before. Ujjain: "Namaste! Welcome to Dr. Govind Singh's Dental Clinic, Ujjain. How may I help you today? आप हिंदी में भी बात कर सकते हैं।"
- The system prompt no longer calls every clinic "a fictional demo clinic".
- Picker on the call page: "Dr. Singh Dental Clinic, Ujjain, India".
- **Checks:** `uv run pytest`: 128 passed, 25 skipped. Live: `-k "greeting or constructs or faq"`: 4 passed, including the new `test_fixed_greeting_is_spoken_verbatim`. Dashboard `tsc` and `eslint` are clean.
- **Applied 2026-10-24** (user said "do it"):
  - `npx supabase db push --linked --include-seed` applied the migration, but only updated the seed hash and did not re-run it. The seed was then run with `npx supabase db query --linked -f supabase/seed.sql`.
  - Verified in the database: the name, phone and greeting are set, there are 14 FAQs, both Singhs are active with 30-minute slots, the three old doctors are inactive, and Mon 2026-10-26 has 16 slots. No future bookings were left with the deactivated doctors.
  - `lk agent deploy` reported "Completed deployment of agent to production".
  - Pushed to `main` for Vercel.
  - **No voice call has been made on the new setup yet.**

### 2026-10-25: New home page design
- `page.tsx`: top bar with a logo and a **Staff login** button (→ `/login`), a hero headline with phrases to try (English, Hindi, Hinglish), four feature cards, a "Clinic staff?" banner with an "Open staff dashboard" button, and a footer with the 112 emergency note.
- `voice-call.tsx`: the call card has a heading, clinic choices with a highlight ring, and a large "Start voice call" button with a mic icon. During a call it shows the clinic name and a round visualizer that pulses while the agent speaks. The demo note now says test bookings are not passed to the clinic (it used to say "fictional clinics").
- Checks: `tsc --noEmit` and `eslint` are clean. Pushed 2026-10-25 (user go-ahead). **Not visually checked in a browser by Claude.**
- The Hindi example phrase names Dr. Govind Singh (user request).
- Mobile pass: on phones the call card now sits right under the headline (example phrases come after it). Smaller heading and padding, a full-width End call button and banner button, and a header that fits 320 px. Desktop layout is unchanged (the card is in the right column). Not checked on a real phone by Claude.
- **Staff sign-up discussed, then cancelled for now** (user, 2026-10-25). Options discussed: vendor-created first admin plus invite links (safest), self sign-up with owner approval, and fully open sign-up. Staff logins are still created with `scripts/create_staff.py`.

### 2026-10-25: Old Sanjeevani doctors and bookings removed
- At the user's request, deleted from the live database: all 4 appointments of the Ujjain clinic (`sanjeevani`; all were old test bookings with Dr. Anjali Sharma, none still booked) and the three old doctors (Sharma, Rao, Mehta). Their schedules were removed with them (cascade).
- Verified: the clinic now has only Dr. Govind Singh and Dr. Preeti Singh (6 working days each) and 0 appointments. Harbourside is untouched (it had no bookings).
- **Kept:** 10 `audit_logs` rows from when the old doctors were created or changed, plus the new delete entries. The audit trail was left intact on purpose.
- Code: the tool description example is now "Dr. Govind Singh" or "dentist"; the smoke script and a code comment were updated. The test fixtures still use their own fictional doctors (test data only). `pytest`: 128 passed, 25 skipped. Agent redeployed and pushed to `main`.
- "Dr. Singh" or "dentist" matches both doctors, so the agent asks which one.

## In Progress

- Nothing running locally. The agent runs on LiveKit Cloud; the web app on Vercel. The local dev server was stopped by Claude Code for low memory on 2026-10-23.
- **Do not run the local agent while testing the live site**: both register with the same LiveKit project, so calls could go to the laptop.

## Pending User Actions

- **Test a real call to the Ujjain clinic** on the live site: check the greeting, the FAQs and a booking with Dr. Govind Singh.

- **Free memory before local testing:** the laptop has 7.7 GB, often with under 0.7 GB free.
- **Decide on latency work** (see Current Status). Moving Supabase to Mumbai needs a new project created by the user.
- **Rotate the LiveKit API key** (exposed in a Claude session on 2026-10-21). After rotating, update Vercel's `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` (the cloud agent gets its own automatically).
- Vercel Hobby is for non-commercial use; a paid client demo may need Pro.
- Optional: upgrade local Node to 22 (supabase-js warns on Node 20).
- Done 2026-10-23: `lk cloud auth`; GitHub push; Vercel import and env vars.

## Open Questions

- **CRM / practice-management integration** (asked 2026-10-21): there is none, and no CRM is in the plan. Supabase is the system of record. The suggested approach is a sync layer from Supabase to an external system added after the core booking flow works, targeting clinic booking software (e.g. Cliniko, Halaxy, HotDoc, Practo) rather than a sales CRM. API access and terms are not verified. Waiting for the user to name a target system.

## Not Yet Done

- Live dashboard updates not watched in a real browser yet (verified by script only).
- Voice: interruptions are not specifically tested. The silence timeout and hang-up were only tried by the user, not by automated tests. Live tests run in text mode, not audio.
- Deployment: agent code changes need `lk agent deploy` from `agent/` (Vercel redeploys on every push to `main`). Only one real call tested on the cloud agent so far; phone browsers not yet tested.
- Voicemail fallback is not implemented (it plays the closed message). There is no live call transfer: `transfer` mode speaks the staff number.
- No "type your number" fallback on the call screen (offered; the user chose only the ask wording).
- No non-Indian TTS voice for the Australian clinic yet.
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

- The Supabase project is in `ap-northeast-2` (Seoul; confirmed 2026-10-22). Each RPC from India takes ≈ 400 ms, the largest network cost in booking turns. It was kept for the India and Australia demo; moving to Mumbai is the main latency option. A real client deployment would get its own project in the client's region. The migrations are in the repo, so this means re-linking and running `supabase db push`.
- Sarvam STT and TTS support only Indian (`*-IN`) language codes, with no `en-AU`. Australian speech will be transcribed as `en-IN`, which needs testing for accuracy. The live API rejects `amelia` (and presumably `sophia`) and offers only Indian voices, so the Australian clinic needs a different TTS provider. See Scope in plan.md.

- `SARVAM_API_KEY` and `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` are confirmed working with the installed SDKs (smoke test and worker registration, 2026-10-21). The Supabase and dashboard variable names are still provisional.
- `sarvam-105b` is unusable for voice (about 8 s to first token, empty replies at small `max_tokens`). Use `sarvam-105b-conversations`.
- STT returns Hinglish speech in Devanagari script (`transcribe` mode). `codemix` and `translit` modes are untested.
- In dev mode the first call waits about 2 s for a worker process (no warmed process). VAD ran 0.5 s slower than realtime once at session start on the development laptop.
- With no clinic data, the LLM invents facts (opening hours) unless the prompt forbids it. FAQ answers are now grounded in `clinic_faqs`.
- Sarvam STT is weakest on numbers made of one repeated digit (drops a digit) and on accented digit words ("Naini"). Code compensates partly; the read-back is the safety net.
- Sarvam LLM rate limits (HTTP 429) were hit when running the full live suite twice in a row. A 429 during a real call would stall the agent's reply.
- Changing the Sarvam STT language mid-call reconnects its WebSocket (could drop the first words), so the STT stays on auto-detect.
- The local dev setup is memory-heavy for this laptop. Claude Code stopped the agent and website once on 2026-10-22 because memory ran out.

## Secrets Handling

- Claude does not read, print, or access `.env` files, API keys, or other secrets. The user fills in real values locally.
- Only `.env.example`, with placeholder values, is created or edited by Claude.
