import Link from "next/link";
import { VoiceCall } from "./voice-call";

// Read DEMO_ACCESS_CODE per request, so it can be changed in Vercel without code changes.
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "Answers questions",
    text: "Timings, address, doctors and treatments, from the clinic's approved information only.",
    icon: "M8 10h8M8 14h5m-9 6 3-3h9a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v13Z",
  },
  {
    title: "Books real slots",
    text: "Checks the doctor's live availability and confirms only after you say yes.",
    icon: "M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 9 2 2 4-4",
  },
  {
    title: "Moves or cancels",
    text: "Finds your appointment by mobile number and changes it safely.",
    icon: "M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.4 2M18.5 9A7 7 0 0 0 6.1 7",
  },
  {
    title: "Hands over to staff",
    text: "Urgent or unusual requests go to the clinic team for a call back.",
    icon: "M16 11a4 4 0 1 0-8 0m8 0a4 4 0 0 1-8 0m8 0v1a4 4 0 0 1-4 4m-4-5v1a4 4 0 0 0 4 4m0 0v4m-4 0h8",
  },
];

const TRY_SAYING = [
  "Clinic timings kya hai?",
  "I want to book a root canal consultation tomorrow.",
  "डॉक्टर गोविंद सिंह से मिलना है।",
  "Mera appointment cancel karna hai.",
];

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Soft background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-gradient-to-b from-teal-100/80 via-cyan-50/60 to-transparent dark:from-teal-950/60 dark:via-slate-950/40" />
      <div aria-hidden className="pointer-events-none absolute -top-24 right-[-10rem] -z-10 h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-800/20" />
      <div aria-hidden className="pointer-events-none absolute top-40 left-[-8rem] -z-10 h-80 w-80 rounded-full bg-teal-300/30 blur-3xl dark:bg-teal-800/20" />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:py-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-md">
            <Icon d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm7 9a7 7 0 0 1-14 0m7 7v2" />
          </span>
          <span className="truncate text-sm font-semibold tracking-tight sm:text-base">Clinic AI Receptionist</span>
        </div>
        <Link
          href="/login"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-3 py-2 text-sm sm:px-4 font-medium text-slate-700 shadow-sm backdrop-blur transition hover:border-teal-500 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-teal-300"
        >
          <Icon d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" className="h-4 w-4" />
          Staff login
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="grid gap-6 py-4 sm:gap-8 sm:py-8 lg:grid-cols-2 lg:items-center lg:gap-x-10 lg:gap-y-6 lg:py-14">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-teal-600/10 px-3 py-1 text-xs font-medium text-teal-800 dark:text-teal-300">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-teal-500" />
              Live demo · speak in Hindi, English or Hinglish
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:mt-5 sm:text-5xl">
              Your clinic&apos;s receptionist,{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                available by voice
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-base text-slate-600 sm:mt-4 sm:text-lg dark:text-slate-300">
              Ask about the clinic, or book, move or cancel an appointment just by talking. No app, no waiting on hold.
            </p>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/90 p-5 shadow-xl shadow-teal-900/5 backdrop-blur sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 dark:border-slate-800 dark:bg-slate-900/90">
            <VoiceCall needsCode={Boolean(process.env.DEMO_ACCESS_CODE?.trim())} />
          </div>

          <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Try saying</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {TRY_SAYING.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                >
                  “{t}”
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <Icon d={f.icon} />
              </span>
              <h2 className="mt-3 font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 flex flex-col items-stretch justify-between gap-4 rounded-2xl bg-gradient-to-r from-teal-700 to-cyan-700 p-5 text-white shadow-lg sm:mt-12 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">Clinic staff?</h2>
            <p className="mt-1 text-sm text-teal-50/90">
              See bookings as they arrive, manage doctors and FAQs, and switch the receptionist on or off.
            </p>
          </div>
          <Link
            href="/login"
            className="shrink-0 rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-teal-800 shadow transition hover:bg-teal-50 sm:py-2.5"
          >
            Open staff dashboard →
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-800">
        Demo AI receptionist · not a medical service · in an emergency call 112
      </footer>
    </div>
  );
}
