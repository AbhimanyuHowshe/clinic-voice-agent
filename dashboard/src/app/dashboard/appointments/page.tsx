import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { localDate, localDayRange, shortTime, weekdayName } from "@/lib/time";
import { AppointmentsTable, type AppointmentRow } from "../components";

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  active: boolean;
  doctor_schedules: { weekday: number; start_time: string; end_time: string }[];
};

type Row = AppointmentRow & { doctor_id: string };

function shift(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Tue, Thu, Sat" — the doctor's working days, Monday first. */
function workingDays(d: Doctor) {
  const days = [...new Set(d.doctor_schedules.map((h) => h.weekday))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  return days.length ? days.map((n) => weekdayName(n).slice(0, 3)).join(", ") : "No hours set";
}

export default async function Appointments({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; status?: string; doctor?: string }>;
}) {
  const staff = await requireStaff();
  const tz = staff.clinic.timezone;
  const params = await searchParams;
  // No day selected: show everything from today onwards. A day narrows it to that day.
  const pickedDay = /^\d{4}-\d{2}-\d{2}$/.test(params.day ?? "") ? params.day! : null;
  const day = pickedDay ?? localDate(new Date(), tz);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  const dayLabel = pickedDay
    ? new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
        new Date(`${pickedDay}T00:00:00Z`),
      )
    : "Today";
  const status = ["booked", "cancelled", "completed", "no_show"].includes(params.status ?? "") ? params.status : null;
  const range = localDayRange(day, tz);

  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select("id, reference, patient_name, patient_phone, starts_at, status, source, doctor_id, doctors(name)")
    .gte("starts_at", range.start)
    .order("starts_at")
    .limit(200);
  if (pickedDay) query = query.lt("starts_at", range.end);
  if (status) query = query.eq("status", status);
  const [appts, docs] = await Promise.all([
    query,
    supabase
      .from("doctors")
      .select("id, name, specialty, active, doctor_schedules(weekday, start_time, end_time)")
      .order("name"),
  ]);
  if (appts.error) throw new Error(appts.error.message);
  if (docs.error) throw new Error(docs.error.message);
  const all = (appts.data ?? []) as unknown as Row[];
  const doctors = (docs.data ?? []) as Doctor[];
  const doctor = doctors.some((d) => d.id === params.doctor) ? params.doctor! : null;
  const rows = doctor ? all.filter((r) => r.doctor_id === doctor) : all;

  const link = (p: { day?: string | null; doctor?: string | null }) => {
    const q = new URLSearchParams();
    const d = p.day === undefined ? pickedDay : p.day;
    const doc = p.doctor === undefined ? doctor : p.doctor;
    if (d) q.set("day", d);
    if (status) q.set("status", status);
    if (doc) q.set("doctor", doc);
    const s = q.toString();
    return `/dashboard/appointments${s ? `?${s}` : ""}`;
  };
  const card = "rounded-xl border px-4 py-3 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
  const on = "border-teal-500 bg-teal-50 ring-2 ring-teal-500/20 dark:bg-teal-950";
  const off = "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Appointments</h1>
          <p className="text-sm text-neutral-500">
            {pickedDay ? `Showing ${pickedDay}` : "Showing all upcoming appointments"}
            {pickedDay && (
              <Link href={link({ day: null })} className="ml-2 text-teal-700 underline dark:text-teal-400">
                Show all upcoming
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn" href={link({ day: shift(day, -1) })}>
            ← Prev
          </Link>
          <form className="flex flex-wrap gap-2">
            <input type="date" name="day" defaultValue={pickedDay ?? ""} className="input" />
            <select name="doctor" defaultValue={doctor ?? ""} className="input">
              <option value="">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={status ?? ""} className="input">
              <option value="">All statuses</option>
              <option value="booked">Booked</option>
              <option value="completed">Completed</option>
              <option value="no_show">No-show</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className="btn">Show</button>
          </form>
          <Link className="btn" href={link({ day: shift(day, 1) })}>
            Next →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={link({ doctor: null })} className={`${card} ${doctor ? off : on}`}>
          <p className="font-medium">All doctors</p>
          <p className="text-xs text-neutral-500">
            {all.filter((r) => r.status === "booked").length} booked {pickedDay ? `on ${dayLabel}` : "upcoming"}
          </p>
        </Link>
        {doctors.map((d) => {
          const booked = all.filter((r) => r.doctor_id === d.id && r.status === "booked").length;
          const hours = d.doctor_schedules
            .filter((h) => h.weekday === weekday)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map((h) => `${shortTime(h.start_time)}–${shortTime(h.end_time)}`)
            .join(", ");
          return (
            <Link key={d.id} href={link({ doctor: d.id })} className={`${card} ${doctor === d.id ? on : off} w-60`}>
              <p className="font-medium">{d.name}</p>
              <p className="text-xs text-neutral-500">{d.specialty}</p>
              <p className="mt-2">
                {!d.active ? (
                  <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    Not taking bookings
                  </span>
                ) : hours ? (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                    {dayLabel}: {hours}
                  </span>
                ) : (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                    Not working {pickedDay ? `on ${dayLabel}` : "today"}
                  </span>
                )}
              </p>
              <p className="mt-2 text-xs text-neutral-500">Works {workingDays(d)}</p>
              <p className="text-xs text-neutral-500">
                {booked} booked {pickedDay ? `on ${dayLabel}` : "upcoming"}
              </p>
            </Link>
          );
        })}
      </div>

      <AppointmentsTable rows={rows} timeZone={tz} />
    </div>
  );
}
