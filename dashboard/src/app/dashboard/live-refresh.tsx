"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["appointments", "call_logs", "agent_settings", "temporary_pauses"] as const;
// Fallback in case the live connection drops (e.g. laptop sleep, network change).
const POLL_MS = 30_000;

/** Re-renders the dashboard when the voice agent or another staff member changes data. */
export function LiveRefresh() {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // Several rows often change together (e.g. a booking plus its call log): refresh once.
    const refresh = () => {
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => router.refresh(), 300);
    };

    let channel = supabase.channel("dashboard-live");
    for (const table of TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }

    supabase.auth.getSession().then(({ data }) => {
      // Realtime needs the user's token so RLS can decide which rows to send.
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe((status) => setLive(status === "SUBSCRIBED"));
    });

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);

    return () => {
      clearInterval(poll);
      if (pending.current) clearTimeout(pending.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500" title={live ? "Updates appear instantly" : `Refreshing every ${POLL_MS / 1000} s`}>
      <span className={`h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-neutral-400"}`} />
      {live ? "Live" : "Auto-refresh"}
    </span>
  );
}
