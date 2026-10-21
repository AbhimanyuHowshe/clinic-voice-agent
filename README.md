# Clinic Voice Agent

An AI receptionist for clinics. It talks with patients in Hindi, English, and Hinglish, answers approved clinic FAQs, and books, reschedules, and cancels appointments. Staff manage it from a web dashboard.

> **Status:** early setup (Phase 0). Nothing is runnable yet. See [`progress.md`](progress.md) for verified progress and [`plan.md`](plan.md) for the roadmap.

## Stack

| Part | Technology |
|------|------------|
| Real-time voice | LiveKit Agents (Python), LiveKit Cloud |
| Speech and language | Sarvam AI (STT, TTS, LLM), LangChain, LangGraph |
| Database and auth | Supabase (PostgreSQL, Auth, Row Level Security) |
| Staff dashboard | Next.js, React, TypeScript (hosted on Vercel) |

## Repository layout

```
agent/        Python voice agent (LiveKit Agents + LangGraph workflow)
dashboard/    Next.js staff dashboard
supabase/     Database migrations and policies
CLAUDE.md     Engineering rules for this project
plan.md       Phased development plan
progress.md   Verified progress log
```

## Setup

Setup instructions will be added as each component is built and tested.

### Environment variables

Each component has its own `.env.example` with placeholder values:

- `agent/.env.example` → copy to `agent/.env`
- `dashboard/.env.example` → copy to `dashboard/.env.local`

Fill in real values locally. **Never commit real keys.** `.gitignore` excludes every `.env` file except `.env.example`.

## Safety

This is an administrative receptionist, not a medical professional. It does not diagnose or prescribe, and it escalates clinical concerns to clinic staff. Do not use it with real patients until the release gate in `plan.md` is met.
