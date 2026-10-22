"use client";

import "@livekit/components-styles";
import {
  BarVisualizer,
  DisconnectButton,
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
} from "@livekit/components-react";
import { useState } from "react";
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

function AgentStatus() {
  const { state, audioTrack } = useVoiceAssistant();
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-24 w-64">
        <BarVisualizer state={state} trackRef={audioTrack} barCount={7} />
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300" aria-live="polite">
        {STATE_TEXT[state] ?? state}
      </p>
    </div>
  );
}

export function VoiceCall() {
  const [clinic, setClinic] = useState<ClinicSlug>("sanjeevani");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the call.");
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
        className="flex flex-col items-center gap-6"
      >
        <AgentStatus />
        <RoomAudioRenderer />
        <DisconnectButton className="rounded-full bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700">
          End call
        </DisconnectButton>
      </LiveKitRoom>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Choose a demo clinic</legend>
        {DEMO_CLINICS.map((c) => (
          <label
            key={c.slug}
            className={`flex cursor-pointer flex-col rounded-lg border p-3 ${
              clinic === c.slug ? "border-teal-600 bg-teal-50 dark:bg-teal-950" : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="clinic"
                value={c.slug}
                checked={clinic === c.slug}
                onChange={() => setClinic(c.slug)}
              />
              <span className="font-medium">{c.name}</span>
            </span>
            <span className="ml-6 text-sm text-neutral-600 dark:text-neutral-400">
              {c.place} · {c.languages}
            </span>
          </label>
        ))}
      </fieldset>
      <button
        onClick={start}
        disabled={starting}
        className="rounded-full bg-teal-700 px-6 py-3 font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {starting ? "Starting…" : "Talk to the receptionist"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="text-xs text-neutral-500">
        Uses your microphone. Demo only: fictional clinics, no real appointments. Calls are not recorded. If the
        receptionist is switched off or outside its hours, you will hear a short message instead. The first call
        can take up to 20 seconds to connect.
      </p>
    </div>
  );
}
