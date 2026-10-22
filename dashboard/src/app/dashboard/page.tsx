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

  const [{ data: state }, { data: settings }, { data: todays }, { data: calls }] = await Promise.all([
    supabase.rpc("agent_effective_state", { p_clinic_id: staff.clinic.id }),
    supabase.from("agent_settings").select("manual_enabled").eq("clinic_id", staff.clinic.id).single(),
    supabase
      .from("appointments")
      .select("id, reference, patient_name, patient_phone, starts_at, status, source, doctors(name)")
      .gte("starts_at", today.start)
      .lt("starts_at", today.end)
      .order("starts_at"),
    supabase.from("call_logs").select("id", { count: "exact" }).eq("follow_up_done", false).not("callback_phone", "is", null),
  ]);

  const effective = state as EffectiveState | null;
  const booked = (todays ?? []).filter((a) => a.status === "booked").length;

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-col gap-4">
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

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-sm text-neutral-500">Booked today</p>
          <p className="text-3xl font-semibold">{booked}</p>
        </div>
        <Link href="/dashboard/calls" className="card hover:bg-neutral-50 dark:hover:bg-neutral-900">
          <p className="text-sm text-neutral-500">Call-backs waiting</p>
          <p className="text-3xl font-semibold">{calls?.length ?? 0}</p>
        </Link>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Today&apos;s appointments</h2>
        <AppointmentsTable rows={(todays ?? []) as unknown as AppointmentRow[]} timeZone={tz} />
      </section>
    </div>
  );
}
