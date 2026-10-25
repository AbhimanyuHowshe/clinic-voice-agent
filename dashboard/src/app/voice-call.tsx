"use client";

import "@livekit/components-styles";
import {
  BarVisualizer,
  DisconnectButton,
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
} from "@livekit/components-react";
import { useEffect, useState } from "react";
import { DEMO_CLINICS, type ClinicSlug } from "@/lib/clinics";

type Connection = { serverUrl: string; token: string };

const STATE_TEXT: Record<string, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting…",
  "pre-connect-buffering": "Connecting…",
  initializing: "Receptionist is joining…",
  idle: "Receptionist is joining…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
  failed: "Connection failed",
};

const MIC_ICON = "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm7 9a7 7 0 0 1-14 0m7 7v2";

function AgentStatus({ clinicName }: { clinicName: string }) {
  const { state, audioTrack } = useVoiceAssistant();
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm font-medium text-slate-500">On call with {clinicName}</p>
      <div className="relative grid h-40 w-40 place-items-center">
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full bg-teal-400/20 ${state === "speaking" ? "animate-ping" : ""}`}
        />
        <div className="relative grid h-36 w-36 place-items-center rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 shadow-lg">
          <div className="h-16 w-24 [--lk-fg:white] [--lk-va-bar-bg:rgba(255,255,255,0.35)]">
            <BarVisualizer state={state} trackRef={audioTrack} barCount={5} />
          </div>
        </div>
      </div>
      <p className="text-base font-medium text-slate-700 dark:text-slate-200" aria-live="polite">
        {STATE_TEXT[state] ?? state}
      </p>
    </div>
  );
}

const CODE_KEY = "demo-access-code";

export function VoiceCall({ needsCode }: { needsCode: boolean }) {
  const [clinic, setClinic] = useState<ClinicSlug>("sanjeevani");
  const [code, setCode] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    // Remember the demo code in this browser so clients only type it once.
    try {
      setCode(localStorage.getItem(CODE_KEY) ?? "");
    } catch {}
  }, []);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the call.");
      try {
        if (needsCode) localStorage.setItem(CODE_KEY, code);
      } catch {}
      setConnection({ serverUrl: data.serverUrl, token: data.token });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the call.");
    } finally {
      setStarting(false);
    }
  }

  if (connection) {
    return (
      <LiveKitRoom
        serverUrl={connection.serverUrl}
        token={connection.token}
        connect
        audio
        video={false}
        onDisconnected={() => setConnection(null)}
        onError={(e) => setError(e.message)}
        className="flex flex-col items-center gap-6 py-4"
      >
        <AgentStatus clinicName={DEMO_CLINICS.find((c) => c.slug === clinic)?.name ?? "the clinic"} />
        <RoomAudioRenderer />
        <DisconnectButton className="rounded-full bg-red-600 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-red-700">
          End call
        </DisconnectButton>
      </LiveKitRoom>
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">Talk to the receptionist</h2>
        <p className="mt-1 text-sm text-slate-500">Pick a clinic, allow the microphone, and start speaking.</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Choose a clinic</legend>
        {DEMO_CLINICS.map((c) => (
          <label
            key={c.slug}
            className={`flex cursor-pointer flex-col rounded-xl border p-3.5 transition ${
              clinic === c.slug
                ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/20 dark:bg-teal-950"
                : "border-slate-200 hover:border-teal-300 dark:border-slate-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="clinic"
                value={c.slug}
                checked={clinic === c.slug}
                onChange={() => setClinic(c.slug)}
                className="accent-teal-600"
              />
              <span className="font-medium">{c.name}</span>
            </span>
            <span className="ml-6 text-sm text-slate-500 dark:text-slate-400">
              {c.place} · {c.languages}
            </span>
          </label>
        ))}
      </fieldset>
      {needsCode && (
        <label className="flex flex-col gap-1 text-sm">
          Demo access code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            className="input"
            placeholder="Shared by the clinic team"
          />
        </label>
      )}
      <button
        onClick={start}
        disabled={starting || (needsCode && !code.trim())}
        className="group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:from-teal-700 hover:to-cyan-700 disabled:opacity-60"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 transition group-hover:scale-110">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <path d={MIC_ICON} />
          </svg>
        </span>
        {starting ? "Connecting…" : "Start voice call"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="text-xs leading-relaxed text-slate-500">
        Uses your microphone. Demo only: bookings made here are test bookings and are not passed to the clinic.
        Calls are not recorded. If the
        receptionist is switched off or outside its hours, you will hear a short message instead. The first call
        can take up to 20 seconds to connect.
      </p>
    </div>
  );
}
