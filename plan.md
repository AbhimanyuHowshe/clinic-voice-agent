# Clinic AI Voice Agent — Development Plan

## Goal

Build a cloud-hosted clinic receptionist using LiveKit Agents, Sarvam AI, LangChain, LangGraph, Supabase, and Next.js.

Prioritize a working browser voice prototype, real appointment booking, and dependable staff controls. Use free-tier services wherever practical.

## Phase 0 — Project Setup and Compatibility

- [x] Initialize the Git repository.
- [x] Create the project directory structure.
- [x] Create `.gitignore`, `.env.example`, and `README.md`.
- [ ] Set up LiveKit Cloud.
- [ ] Set up Sarvam AI API access.
- [ ] Set up Supabase.
- [ ] Verify current LiveKit Agents SDK versions.
- [ ] Verify Sarvam STT and TTS compatibility.
- [ ] Verify LangChain and LangGraph package compatibility.
- [ ] Verify supported LLM streaming integration.
- [ ] Confirm free-tier quotas and deployment restrictions.
- [ ] Record exact tested dependency versions.

**Deliverable:** repository initialized with verified API access and a documented development environment.

## Phase 1 — Minimal Voice Agent

- [ ] Set up the Python environment.
- [ ] Install LiveKit Agents.
- [ ] Configure Sarvam STT.
- [ ] Configure Sarvam TTS.
- [ ] Configure a compatible LLM.
- [ ] Create a basic receptionist prompt.
- [ ] Enable Hindi, English, and Hinglish tests.
- [ ] Test interruptions, silence, and timeouts.
- [ ] Run a browser-based voice session.

**Deliverable:** patient and receptionist can converse through a browser.

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
