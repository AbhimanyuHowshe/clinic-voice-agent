# Clinic Voice Agent

An AI receptionist for clinics. It talks with patients in Hindi, English, and Hinglish, answers approved clinic FAQs, and books, reschedules, and cancels appointments. Staff manage it from a web dashboard.

> **Status:** demo MVP built (2026-10-22): voice agent with real booking, staff dashboard and server-side agent controls. Not yet deployed. See [`progress.md`](progress.md) for what is verified and [`plan.md`](plan.md) for the roadmap. Fictional demo data only.

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
dashboard/    Next.js app: patient voice page + staff dashboard
supabase/     Database migrations, functions, RLS policies, demo seed
CLAUDE.md     Engineering rules for this project
plan.md       Phased development plan
progress.md   Verified progress log
```

## Setup

1. **Database:** `npx supabase db push --include-seed` (see [`supabase/README.md`](supabase/README.md)).
2. **Secrets:** in your own terminal, `cd agent && uv run python scripts/set_env.py`.
3. **Staff login:** `cd agent && uv run python scripts/create_staff.py`.
4. **Voice agent:** `cd agent && lk agent dev` (local) or `lk agent create --secrets-file .env .` (LiveKit Cloud). See [`agent/README.md`](agent/README.md).
5. **Web app:** `cd dashboard && npm install && npm run dev`, or deploy to Vercel. See [`dashboard/README.md`](dashboard/README.md).

### Environment variables

Each component has its own `.env.example` with placeholder values:

- `agent/.env.example` → copy to `agent/.env`
- `dashboard/.env.example` → copy to `dashboard/.env.local`

Fill in real values locally. **Never commit real keys.** `.gitignore` excludes every `.env` file except `.env.example`.

## Safety

This is an administrative receptionist, not a medical professional. It does not diagnose or prescribe, and it escalates clinical concerns to clinic staff. Do not use it with real patients until the release gate in `plan.md` is met.
