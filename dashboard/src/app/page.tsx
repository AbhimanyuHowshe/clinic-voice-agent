import Link from "next/link";
import { VoiceCall } from "./voice-call";

// Read DEMO_ACCESS_CODE per request, so it can be changed in Vercel without code changes.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-8 px-4 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold">AI Clinic Receptionist</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Ask about the clinic, or book, move or cancel an appointment — by voice.
        </p>
      </header>
      <VoiceCall needsCode={Boolean(process.env.DEMO_ACCESS_CODE?.trim())} />
      <Link href="/dashboard" className="text-sm text-teal-700 underline dark:text-teal-400">
        Staff dashboard
      </Link>
    </main>
  );
}
