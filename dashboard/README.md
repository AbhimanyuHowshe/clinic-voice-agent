# Web App (patient voice page + staff dashboard)

Next.js 15 (App Router, TypeScript, Tailwind).

| Route | Who | What |
|---|---|---|
| `/` | public | Pick a demo clinic and talk to the AI receptionist in the browser |
| `/api/token` | public (POST) | Mints a 15-minute LiveKit token for a `clinic-<slug>-<random>` room |
| `/login` | staff | Email + password (Supabase Auth; public sign-up is off) |
| `/dashboard` | staff | Agent status, emergency OFF, quick pauses, today's appointments |
| `/dashboard/appointments` | staff | Appointments by day; mark done / no-show / cancel |
| `/dashboard/agent` | admin edits | Fallback, ongoing-call policy, agent hours (overnight allowed), pauses, holidays |
| `/dashboard/doctors`, `/faqs` | admin edits | Doctors, consulting hours, approved FAQs |
| `/dashboard/calls` | staff | Call outcomes and call-back follow-ups (no transcripts stored) |
| `/dashboard/audit` | admin | Audit log of changes |

Security: the app has no service-role key. Every dashboard query runs as the signed-in user under Row
Level Security; admin-only changes are enforced by RLS policies, not just hidden in the UI.

## Run locally

```
npm install
npm run dev        # http://localhost:3000 (Node 22+ recommended; supabase-js warns on Node 20)
npm run build      # type-check + production build
```

Environment: `.env.local` (see `.env.example`). Create staff logins with `agent/scripts/create_staff.py`.

## Deploy to Vercel

1. Import the GitHub repo in Vercel and set **Root Directory** to `dashboard`.
2. Add the five variables from `.env.example` (Production and Preview).
3. Deploy. In Supabase → Authentication → URL Configuration, add the Vercel URL as the Site URL.

Vercel Hobby is non-commercial only; check the terms before showing it to paying prospects.
