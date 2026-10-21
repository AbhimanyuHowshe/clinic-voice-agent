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
- [ ] Set up LiveKit Cloud.
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
- [ ] Configure Sarvam STT.
- [ ] Configure Sarvam TTS.
- [ ] Configure a compatible LLM. (Use `sarvam-105b-conversations`.)
- [ ] Create a basic receptionist prompt.
- [ ] Enable Hindi, English, and Hinglish tests.
- [ ] Test interruptions, silence, and timeouts.
- [ ] Run a browser-based voice session.
- [ ] Deploy the agent to LiveKit Cloud (`lk agent deploy`) as soon as a minimal agent works.
- [ ] Scaffold the Next.js app with a public patient voice page and a server-side LiveKit token route.
- [ ] Deploy the Next.js app to Vercel from GitHub (auto-deploy on push to `main`).
- [ ] Verify a voice conversation works end to end on the public URL, not only locally.

**Deliverable:** patient and receptionist can converse through a browser, running online.

**Acceptance criteria:**

- Spoken input is recognized.
- Agent responses are audible.
- Errors produce understandable fallback responses.
- Secrets are never exposed to the browser.

## Phase 2 — LangChain and LangGraph Integration

- [ ] Add compatible LangChain packages.
- [ ] Add LangGraph.
- [ ] Implement the graph state schema.
- [ ] Define receptionist intent routing.
- [ ] Create FAQ, booking, cancellation, rescheduling, and handoff paths.
- [ ] Define structured tool inputs and outputs.
- [ ] Connect graph output to the LiveKit voice pipeline.
- [ ] Verify streaming and conversational latency.
- [ ] Add retry and error-handling rules.
- [ ] Test graph transitions and incomplete requests.

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

- [ ] Create migrations for clinics, profiles, doctors, and FAQs.
- [ ] Create appointment tables.
- [ ] Create agent settings and schedule tables.
- [ ] Create pause and audit-log tables.
- [ ] Configure authentication.
- [ ] Configure Row Level Security.
- [ ] Implement secure backend functions.
- [ ] Add validation and error handling.
- [ ] Add database tests.

**Deliverable:** persistent clinic data and secure backend operations.

## Phase 4 — Appointment Booking

- [ ] Define appointment duration and availability rules.
- [ ] Implement real slot lookup.
- [ ] Implement conflict-safe booking.
- [ ] Require patient confirmation.
- [ ] Add booking confirmation references.
- [ ] Implement rescheduling.
- [ ] Implement cancellation.
- [ ] Add appropriate patient verification.
- [ ] Add idempotency or equivalent retry protection.
- [ ] Test simultaneous booking attempts.

**Deliverable:** end-to-end appointment booking through the voice agent.

## Phase 5 — Admin Dashboard

- [ ] Initialize Next.js and TypeScript.
- [ ] Create staff login.
- [ ] Create dashboard overview.
- [ ] Create appointment calendar and list.
- [ ] Create doctor management.
- [ ] Create clinic FAQ management.
- [ ] Create call history and follow-up views.
- [ ] Create agent control page.
- [ ] Create schedule and pause management.
- [ ] Add role-based access.
- [ ] Add loading, error, and empty states.
- [ ] Test responsive layouts.

**Deliverable:** staff can manage clinic operations from a browser.

## Phase 6 — Agent Controls and Scheduling

- [ ] Implement manual ON/OFF.
- [ ] Implement scheduled operating hours.
- [ ] Implement breaks and holidays.
- [ ] Implement temporary pause intervals.
- [ ] Define manual override precedence.
- [ ] Implement server-side effective-state calculation.
- [ ] Enforce the state on session entry.
- [ ] Recheck the state before important actions.
- [ ] Define behavior for calls already in progress.
- [ ] Implement configurable fallback handling.
- [ ] Audit changes made by staff.
- [ ] Test time-zone and schedule boundaries.

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

## Implementation Priorities

1. Verify LiveKit and Sarvam compatibility.
2. Get a minimal browser voice agent working.
3. Integrate LangChain and LangGraph.
4. Build the Supabase schema and booking tools.
5. Build the admin dashboard.
6. Implement and test agent availability controls.
7. Deploy the MVP.
8. Add telephone support.

## Release Gate

Do not use the system for unsupervised real-patient operations until appointment integrity, authorization, scheduling, escalation, and privacy controls have been tested.
