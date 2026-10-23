import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { localDate, localDayRange } from "@/lib/time";
import { pauseAgent, setManualEnabled } from "./actions";
import { AppointmentsTable, StatusBadge, type AppointmentRow, type EffectiveState } from "./components";

export default async function Overview() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const tz = staff.clinic.timezone;
  const today = localDayRange(localDate(new Date(), tz), tz);
  const weekEnd = new Date(new Date(today.start).getTime() + 7 * 24 * 3600 * 1000).toISOString();

  const [{ data: state }, { data: settings }, { data: upcoming }, { data: calls }] = await Promise.all([
    supabase.rpc("agent_effective_state", { p_clinic_id: staff.clinic.id }),
    supabase.from("agent_settings").select("manual_enabled").eq("clinic_id", staff.clinic.id).single(),
    supabase
      .from("appointments")
      .select("id, reference, patient_name, patient_phone, starts_at, status, source, doctors(name)")
      .gte("starts_at", today.start)
      .lt("starts_at", weekEnd)
      .eq("status", "booked")
      .order("starts_at"),
    supabase.from("call_logs").select("id", { count: "exact" }).eq("follow_up_done", false).not("callback_phone", "is", null),
  ]);

  const effective = state as EffectiveState | null;
  const rows = (upcoming ?? []) as unknown as AppointmentRow[];
  const todayEnd = new Date(today.end).getTime();
  const booked = rows.filter((a) => new Date(a.starts_at).getTime() < todayEnd).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4 border-l-4 border-l-teal-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">AI receptionist</h1>
            {effective && (
              <p className="text-xs text-neutral-500">Clinic time {effective.local_time.replace("T", " ")}</p>
            )}
          </div>
          {effective && <StatusBadge state={effective} />}
        </div>
        <div className="flex flex-wrap gap-2">
          {staff.role === "admin" && (
            <form action={setManualEnabled}>
              <input type="hidden" name="enabled" value={settings?.manual_enabled ? "false" : "true"} />
              <button className={settings?.manual_enabled ? "btn-danger" : "btn-primary"}>
                {settings?.manual_enabled ? "Emergency OFF" : "Turn ON"}
              </button>
            </form>
          )}
          {[30, 60, 120].map((m) => (
            <form key={m} action={pauseAgent}>
              <input type="hidden" name="minutes" value={m} />
              <input type="hidden" name="reason" value="Quick pause from overview" />
              <button className="btn">Pause {m < 60 ? `${m} min` : `${m / 60} h`}</button>
            </form>
          ))}
          <Link href="/dashboard/agent" className="btn">
            Schedules &amp; settings
          </Link>
        </div>
        <p className="text-xs text-neutral-500">
          Emergency OFF overrides every schedule. New calls hear the fallback message; calls already in progress
          follow the &ldquo;ongoing calls&rdquo; setting.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Booked today", value: booked, accent: "from-teal-500 to-cyan-500", href: "/dashboard/appointments" },
          { label: "Next 7 days", value: rows.length, accent: "from-indigo-500 to-violet-500", href: "/dashboard/appointments" },
          { label: "Call-backs waiting", value: calls?.length ?? 0, accent: "from-amber-500 to-orange-500", href: "/dashboard/calls" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="card relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
            <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.accent}`} />
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">{s.value}</p>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Upcoming appointments (next 7 days)</h2>
          <Link href="/dashboard/appointments" className="text-sm text-teal-700 underline dark:text-teal-400">
            All appointments
          </Link>
        </div>
        <AppointmentsTable rows={rows} timeZone={tz} />
      </section>
    </div>
  );
}
