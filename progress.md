# Clinic AI Voice Agent — Progress Log

Record only verified results here. Do not mark an item done until it has actually been tested or confirmed.

## Current Status

- **Current phase:** Phase 0 — Project Setup and Compatibility
- **Next task:** Verify current LiveKit Agents, Sarvam (STT/TTS/LLM), LangChain, and LangGraph compatibility and record versions. Account setup (LiveKit Cloud, Sarvam, Supabase) is done by the user.

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

## In Progress

_None._

## Not Yet Done (Phase 0)

- LiveKit Cloud, Sarvam AI, and Supabase accounts and API access not set up or verified (the user does this; Claude never handles the keys).
- SDK and package compatibility not yet verified; no dependency versions recorded.
- Free-tier quotas not yet confirmed.

## Verified Dependency Versions

_None recorded yet._

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

- Environment variable names are provisional until checked against the installed SDKs.

## Secrets Handling

- Claude does not read, print, or access `.env` files, API keys, or other secrets. The user fills in real values locally.
- Only `.env.example`, with placeholder values, is created or edited by Claude.
