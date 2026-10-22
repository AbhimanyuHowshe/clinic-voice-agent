import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { shortTime, weekdayName } from "@/lib/time";
import { addDoctorHours, deleteDoctorHours, saveDoctor, setDoctorActive } from "../actions";

const DAYS = [1, 2, 3, 4, 5, 6, 0];

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  slot_minutes: number;
  active: boolean;
  doctor_schedules: { id: string; weekday: number; start_time: string; end_time: string }[];
};

export default async function Doctors() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "admin";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctors")
    .select("id, name, specialty, slot_minutes, active, doctor_schedules(id, weekday, start_time, end_time)")
    .order("name");
  if (error) throw new Error(error.message);
  const doctors = (data ?? []) as Doctor[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Doctors</h1>
        <p className="text-sm text-neutral-500">
          The receptionist only offers slots inside these consulting hours ({staff.clinic.timezone}).
        </p>
      </div>

      {doctors.map((d) => (
        <section key={d.id} className={`card ${d.active ? "" : "opacity-60"}`}>
          <form action={saveDoctor} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={d.id} />
            <fieldset disabled={!isAdmin} className="contents">
              <label className="flex flex-col gap-1 text-xs">
                Name
                <input name="name" defaultValue={d.name} required className="input" />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Specialty
                <input name="specialty" defaultValue={d.specialty} className="input" />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Slot (min)
                <input name="slot_minutes" type="number" min={5} max={120} defaultValue={d.slot_minutes} className="input w-24" />
              </label>
              <input type="hidden" name="active" value={d.active ? "on" : "off"} />
              {isAdmin && <button className="btn">Save</button>}
            </fieldset>
          </form>
          {isAdmin && (
            <form action={setDoctorActive} className="mt-2">
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="active" value={d.active ? "false" : "true"} />
              <button className={d.active ? "btn-danger" : "btn"}>
                {d.active ? "Stop taking bookings" : "Resume bookings"}
              </button>
            </form>
          )}

          <h3 className="mb-1 mt-4 text-sm font-medium">Consulting hours</h3>
          <ul className="flex flex-wrap gap-2">
            {[...d.doctor_schedules]
              .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
              .map((h) => (
                <li key={h.id} className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-800">
                  {weekdayName(h.weekday).slice(0, 3)} {shortTime(h.start_time)}–{shortTime(h.end_time)}
                  {isAdmin && (
                    <form action={deleteDoctorHours}>
                      <input type="hidden" name="id" value={h.id} />
                      <button className="text-red-600" aria-label="Remove hours">
                        ×
                      </button>
                    </form>
                  )}
                </li>
              ))}
          </ul>
          {isAdmin && (
            <form action={addDoctorHours} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="doctor_id" value={d.id} />
              <select name="weekday" className="input">
                {DAYS.map((n) => (
                  <option key={n} value={n}>
                    {weekdayName(n)}
                  </option>
                ))}
              </select>
              <input type="time" name="start_time" required className="input" />
              <input type="time" name="end_time" required className="input" />
              <button className="btn">Add hours</button>
            </form>
          )}
        </section>
      ))}

      {isAdmin && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Add doctor</h2>
          <form action={saveDoctor} className="flex flex-wrap items-end gap-2">
            <input name="name" placeholder="Dr. Full Name" required className="input" />
            <input name="specialty" placeholder="Specialty" className="input" />
            <input name="slot_minutes" type="number" min={5} max={120} defaultValue={15} className="input w-24" />
            <button className="btn-primary">Add</button>
          </form>
        </section>
      )}
    </div>
  );
}
