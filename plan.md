# Clinic AI Voice Agent — Development Plan

## Goal

Build a cloud-hosted clinic receptionist using LiveKit Agents, Sarvam AI, LangChain, LangGraph, Supabase, and Next.js.

Prioritize a working browser voice prototype, real appointment booking, and dependable staff controls. Use free-tier services wherever practical.

## Hosting Approach (decided 2026-10-21)

Everything runs online from Phase 1 onward, and each phase is deployed as it is built.

- **Voice agent:** LiveKit Cloud agent hosting. The free Build plan includes 1,000 agent minutes and 5,000 WebRTC minutes per month, up to 5 concurrent agent sessions, and a 1 GB build limit. Usage stops at the cap rather than being billed. Idle agents may cold-start with a 10–20 s delay.
- **Web app:** a single Next.js app on Vercel. It contains the public patient voice page (`/`) and the authenticated staff dashboard (`/dashboard`).
- **Database and auth:** Supabase free tier.
- **Caveat:** Vercel's free Hobby plan is for non-commercial use only. It is fine for development and testing, but real clinic use needs Vercel Pro or a host that allows commercial use on its free plan. Decide before the Phase 8 pilot.

## Scope: Demo (decided 2026-10-21)

The project is a **demo** for prospective clients in **India and Australia**. It is not a live clinic deployment.

- Use fictional clinics, doctors, FAQs and patients only. No real patient data.
- Seed two demo clinics: one in India (`Asia/Kolkata`, Hindi/English/Hinglish) and one in Australia (`Australia/Sydney`, English). This shows per-clinic time zones and languages.
- **Voice for Australia:** Sarvam focuses on Indian languages and accents. Its English voices are expected to sound Indian-accented. Test how it sounds in Phase 1. Tested 2026-10-21: the live API offers only Indian voices (`amelia`/`sophia` are rejected), so add an alternative English TTS for that clinic through a LiveKit plugin. Verify the options before choosing.
- **Region:** the Supabase project is in Seoul (`ap-northeast-2`), between India and Australia. Keep it for the demo. Place the LiveKit agent region close to the database (check which regions LiveKit Cloud offers).
- **Vercel Hobby:** showing the demo to paying prospects may count as commercial use under Hobby's terms. Check the terms before sharing it with clients, or use a host that allows commercial use.
- A real client deployment would need its own project in the client's region, plus a review of the client's privacy obligations. For India that means the DPDP Act; for Australia, the Privacy Act and the Australian Privacy Principles for health information.

## Phase 0 — Project Setup and Compatibility

- [x] Initialize the Git repository.
- [x] Create the project directory structure.
- [x] Create `.gitignore`, `.env.example`, and `README.md`.
- [x] Set up LiveKit Cloud. (A worker registered on 2026-10-21, region India South.)
- [x] Set up Sarvam AI API access. (Live smoke test passed 2026-10-21.)
- [x] Set up Supabase. (Done 2026-10-21; the project is in Seoul, which is acceptable for the India and Australia demo. See Scope.)
- [x] Verify current LiveKit Agents SDK versions. (1.8.8)
- [x] Verify Sarvam STT and TTS compatibility. (Live round trip passed 2026-10-21.)
- [x] Verify LangChain and LangGraph package compatibility. (An offline test streams through `LLMAdapter`.)
- [x] Verify supported LLM streaming integration. (`sarvam-105b-conversations` streams live with tool calls; `sarvam-105b` is too slow for voice.)
- [ ] Confirm free-tier quotas and deployment restrictions. (LiveKit Build plan and Vercel Hobby checked 2026-10-21; see Hosting Approach. Supabase still to check.)
- [x] Record exact tested dependency versions. (See progress.md; update after the live tests.)

**Deliverable:** repository initialized with verified API access and a documented development environment.

## Phase 1 — Minimal Voice Agent

- [x] Set up the Python environment. (uv, `agent/pyproject.toml`)
- [x] Install LiveKit Agents.
- [x] Configure Sarvam STT.
- [x] Configure Sarvam TTS.
- [x] Configure a compatible LLM. (`sarvam-105b-conversations`.)
- [x] Create a basic receptionist prompt. (Name and appointment questions added; one live test still fails: English reply language and acknowledgement.)
- [ ] Enable Hindi, English, and Hinglish tests.
- [ ] Test interruptions, silence, and timeouts.
- [x] Run a browser-based voice session. (Agents Playground, 2026-10-21; feedback logged in progress.md.)
- [ ] Deploy the agent to LiveKit Cloud (`lk agent deploy`) as soon as a minimal agent works.
- [x] Scaffold the Next.js app with a public patient voice page and a server-side LiveKit token route.
- [ ] Deploy the Next.js app to Vercel from GitHub (auto-deploy on push to `main`).
- [ ] Verify a voice conversation works end to end on the public URL, not only locally.

**Deliverable:** patient and receptionist can converse through a browser, running online.

**Acceptance criteria:**

- Spoken input is recognized.
- Agent responses are audible.
- Errors produce understandable fallback responses.
- Secrets are never exposed to the browser.

## Phase 2 — LangChain and LangGraph Integration

- [x] Add compatible LangChain packages.
- [x] Add LangGraph.
- [x] Implement the graph state schema.
- [x] Define receptionist intent routing.
- [x] Create FAQ, booking, cancellation, rescheduling, and handoff paths.
- [x] Define structured tool inputs and outputs.
- [x] Connect graph output to the LiveKit voice pipeline.
- [ ] Verify streaming and conversational latency. (Text tests: first token 0.26–0.96 s through the graph; not measured by voice.)
- [x] Add retry and error-handling rules.
- [x] Test graph transitions and incomplete requests.

Suggested initial graph:

```
START
  |
  v
Classify Request
  |
  +--> FAQ -----------------> Respond
  |
  +--> Booking -------------> Collect Details
  |                              |
  |                              v
  |                         Check Availability
  |                              |
  |                              v
  |                         Confirm with Patient
  |                              |
  |                              v
  |                         Create Appointment
  |
  +--> Reschedule ----------> Verify and Update
  |
  +--> Cancellation --------> Verify and Cancel
  |
  +--> Human Handoff -------> Escalate

END
```

**Deliverable:** a stateful receptionist workflow connected to real-time voice.

## Phase 3 — Supabase and Backend

- [x] Create migrations for clinics, profiles, doctors, and FAQs.
- [x] Create appointment tables.
- [x] Create agent settings and schedule tables.
- [x] Create pause and audit-log tables.
- [x] Configure authentication.
- [x] Configure Row Level Security.
- [x] Implement secure backend functions.
- [x] Add validation and error handling.
- [ ] Add database tests. (Written in `agent/tests/test_db.py`; not run yet — Supabase key invalid.)

**Deliverable:** persistent clinic data and secure backend operations.

## Phase 4 — Appointment Booking

- [x] Define appointment duration and availability rules.
- [x] Implement real slot lookup.
- [x] Implement conflict-safe booking.
- [x] Require patient confirmation.
- [x] Add booking confirmation references.
- [x] Implement rescheduling.
- [x] Implement cancellation.
- [x] Add appropriate patient verification.
- [x] Add idempotency or equivalent retry protection.
- [ ] Test simultaneous booking attempts. (Written in `test_db.py`; not run yet.)

**Deliverable:** end-to-end appointment booking through the voice agent.

## Phase 5 — Admin Dashboard

- [x] Initialize Next.js and TypeScript.
- [x] Create staff login.
- [x] Create dashboard overview.
- [x] Create appointment calendar and list.
- [x] Create doctor management.
- [x] Create clinic FAQ management.
- [x] Create call history and follow-up views.
- [x] Create agent control page.
- [x] Create schedule and pause management.
- [x] Add role-based access.
- [x] Add loading, error, and empty states.
- [ ] Test responsive layouts. (Tailwind layout is mobile-friendly; not checked on a phone.)

**Deliverable:** staff can manage clinic operations from a browser.

## Phase 6 — Agent Controls and Scheduling

- [x] Implement manual ON/OFF.
- [x] Implement scheduled operating hours.
- [x] Implement breaks and holidays.
- [x] Implement temporary pause intervals.
- [x] Define manual override precedence.
- [x] Implement server-side effective-state calculation.
- [x] Enforce the state on session entry.
- [x] Recheck the state before important actions.
- [x] Define behavior for calls already in progress.
- [x] Implement configurable fallback handling.
- [x] Audit changes made by staff.
- [ ] Test time-zone and schedule boundaries. (Written in `test_db.py`; not run yet.)

**Deliverable:** reliable, server-enforced agent availability.

## Phase 7 — End-to-End Testing and Safety

- [ ] Test browser voice sessions.
- [ ] Test multilingual conversations.
- [ ] Test FAQ grounding.
- [ ] Test booking, rescheduling, and cancellation.
- [ ] Test failed and duplicate booking requests.
- [ ] Test staff permissions.
- [ ] Test manual shutdown and scheduled pauses.
- [ ] Test human escalation.
- [ ] Test provider outages and timeouts.
- [ ] Review sensitive-data handling.
- [ ] Review database policies and secrets.
- [ ] Estimate usage costs against free-tier limits.

**Deliverable:** tested MVP ready for controlled pilot evaluation.

## Phase 8 — Deployment

- [ ] Deploy the voice agent using a supported LiveKit workflow.
- [ ] Deploy the Next.js dashboard.
- [ ] Configure production environment variables.
- [ ] Apply database migrations.
- [ ] Verify authentication and RLS in production.
- [ ] Verify server-side schedule enforcement.
- [ ] Test error reporting and operational monitoring.
- [ ] Document deployment and rollback procedures.

**Deliverable:** deployed browser-based clinic receptionist.

## Phase 9 — Telephone Integration

- [ ] Select a compatible telephony provider.
- [ ] Verify Indian phone number support and costs.
- [ ] Connect inbound calls to LiveKit.
- [ ] Configure receptionist transfer and closed-hours behavior.
- [ ] Test call failures and disconnections.
- [ ] Review consent, privacy, and retention requirements.

**Deliverable:** telephone-based clinic receptionist.

## Phase 10 — Google Sheets Sync (deferred until after the demo; decided 2026-10-22)

The client runs their work in Google Sheets. Supabase stays the source of truth; Sheets is a synced working view for the client.

- [ ] Get the client's current Sheet layout (tabs, column headers, sample rows).
- [ ] Supabase → Sheets: write appointment changes to the Sheet after the database commit succeeds; retry on failure and run a periodic full refresh to repair drift.
- [ ] Sheets → Supabase: Apps Script edit trigger calls a validated Supabase function; rejected edits are flagged in a Status column.
- [ ] Ownership rules:
  - FAQs, prices, services: Sheet → Supabase.
  - Doctor timings, holidays, breaks: Sheet → Supabase (validated).
  - Appointments: two-way, with Supabase winning on conflict.
  - Agent ON/OFF: Sheet → Supabase (validated, audited).
  - Call logs and audit records: Supabase → Sheet, read-only.
- [ ] Protect header rows; use dropdowns and date validation to limit typing errors.
- [ ] Never sync secrets; keep Google credentials in environment variables only.
- [ ] Tests: conflicting Sheet edits, malformed rows, Sheets API failures, retries and idempotency.

**Deliverable:** client keeps working in Google Sheets while bookings stay concurrency-safe in Supabase.

## Implementation Priorities

1. Verify LiveKit and Sarvam compatibility.
2. Get a minimal browser voice agent working.
3. Integrate LangChain and LangGraph.
4. Build the Supabase schema and booking tools.
5. Build the admin dashboard.
6. Implement and test agent availability controls.
7. Deploy the MVP.
8. Add telephone support.
9. Add Google Sheets sync for the client (after the demo).

## Release Gate

Do not use the system for unsupervised real-patient operations until appointment integrity, authorization, scheduling, escalation, and privacy controls have been tested.
