import Link from "next/link";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { localDate, localDayRange } from "@/lib/time";
import { AppointmentsTable, type AppointmentRow } from "../components";

function shift(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function Appointments({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; status?: string }>;
}) {
  const staff = await requireStaff();
  const tz = staff.clinic.timezone;
  const params = await searchParams;
  // No day selected: show everything from today onwards. A day narrows it to that day.
  const pickedDay = /^\d{4}-\d{2}-\d{2}$/.test(params.day ?? "") ? params.day! : null;
  const day = pickedDay ?? localDate(new Date(), tz);
  const status = ["booked", "cancelled", "completed", "no_show"].includes(params.status ?? "") ? params.status : null;
  const range = localDayRange(day, tz);

  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select("id, reference, patient_name, patient_phone, starts_at, status, source, doctors(name)")
    .gte("starts_at", range.start)
    .order("starts_at")
    .limit(200);
  if (pickedDay) query = query.lt("starts_at", range.end);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const link = (d: string) => `/dashboard/appointments?day=${d}${status ? `&status=${status}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Appointments</h1>
          <p className="text-sm text-neutral-500">
            {pickedDay ? `Showing ${pickedDay}` : "Showing all upcoming appointments"}
            {pickedDay && (
              <Link href="/dashboard/appointments" className="ml-2 text-teal-700 underline dark:text-teal-400">
                Show all upcoming
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn" href={link(shift(day, -1))}>
            ← Prev
          </Link>
          <form className="flex gap-2">
            <input type="date" name="day" defaultValue={pickedDay ?? ""} className="input" />
            <select name="status" defaultValue={status ?? ""} className="input">
              <option value="">All statuses</option>
              <option value="booked">Booked</option>
              <option value="completed">Completed</option>
              <option value="no_show">No-show</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className="btn">Show</button>
          </form>
          <Link className="btn" href={link(shift(day, 1))}>
            Next →
          </Link>
        </div>
      </div>
      <AppointmentsTable rows={(data ?? []) as unknown as AppointmentRow[]} timeZone={tz} />
    </div>
  );
}
