import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, shortTime, weekdayName } from "@/lib/time";
import {
  addAgentWindow,
  addHoliday,
  deleteAgentWindow,
  deleteHoliday,
  deletePause,
  pauseAgent,
  saveAgentSettings,
  setManualEnabled,
} from "../actions";
import { StatusBadge, type EffectiveState } from "../components";

const DAYS = [1, 2, 3, 4, 5, 6, 0];

export default async function AgentControls() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "admin";
  const tz = staff.clinic.timezone;
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [{ data: state }, { data: s }, { data: windows }, { data: pauses }, { data: holidays }] = await Promise.all([
    supabase.rpc("agent_effective_state", { p_clinic_id: staff.clinic.id }),
    supabase.from("agent_settings").select("*").eq("clinic_id", staff.clinic.id).single(),
    supabase.from("agent_schedules").select("*").order("weekday").order("start_time"),
    supabase.from("temporary_pauses").select("*").gte("ends_at", now).order("starts_at"),
    supabase.from("clinic_holidays").select("*").gte("day", now.slice(0, 10)).order("day"),
  ]);
  if (!s) throw new Error("Agent settings not found");

  return (
    <div className="flex flex-col gap-6">
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Agent controls</h1>
          <p className="text-sm text-neutral-500">
            Precedence: emergency OFF → holiday → temporary pause → schedule (if enabled). Enforced by the server for
            every new call and before every booking change.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {state && <StatusBadge state={state as EffectiveState} />}
          {isAdmin && (
            <form action={setManualEnabled}>
              <input type="hidden" name="enabled" value={s.manual_enabled ? "false" : "true"} />
              <button className={s.manual_enabled ? "btn-danger" : "btn-primary"}>
                {s.manual_enabled ? "Emergency OFF" : "Turn ON"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Behaviour</h2>
        <form action={saveAgentSettings} className="grid gap-4 sm:grid-cols-2">
          <fieldset disabled={!isAdmin} className="contents">
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="schedule_enabled" defaultChecked={s.schedule_enabled} />
              Only answer during the agent hours below
            </label>
            <label className="flex flex-col gap-1 text-sm">
              When unavailable
              <select name="fallback_mode" defaultValue={s.fallback_mode} className="input">
                <option value="closed_message">Play the closed message</option>
                <option value="transfer">Closed message + give the staff number</option>
                <option value="voicemail">Voicemail (not available yet: plays the message)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Staff / transfer number
              <input name="transfer_number" defaultValue={s.transfer_number ?? ""} className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Closed message (spoken to callers)
              <textarea name="fallback_message" defaultValue={s.fallback_message} rows={2} className="input" />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Calls already in progress when the agent turns off
              <select name="ongoing_call_policy" defaultValue={s.ongoing_call_policy} className="input">
                <option value="finish">Let them finish, but block booking changes</option>
                <option value="end">Say goodbye and end the call (within a minute)</option>
              </select>
            </label>
            {isAdmin && (
              <div>
                <button className="btn-primary">Save</button>
              </div>
            )}
          </fieldset>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Agent hours</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Clinic time ({tz}). An end time earlier than the start runs overnight into the next day.
          {!s.schedule_enabled && " Currently ignored: schedule is not enabled."}
        </p>
        <table className="table">
          <tbody>
            {(windows ?? []).map((w) => (
              <tr key={w.id}>
                <td>{weekdayName(w.weekday)}</td>
                <td>
                  {shortTime(w.start_time)} – {shortTime(w.end_time)}
                  {w.end_time < w.start_time && " (overnight)"}
                </td>
                <td className="text-right">
                  {isAdmin && (
                    <form action={deleteAgentWindow}>
                      <input type="hidden" name="id" value={w.id} />
                      <button className="btn-danger">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isAdmin && (
          <form action={addAgentWindow} className="mt-3 flex flex-wrap items-end gap-2">
            <select name="weekday" className="input">
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {weekdayName(d)}
                </option>
              ))}
            </select>
            <input type="time" name="start_time" required className="input" />
            <input type="time" name="end_time" required className="input" />
            <button className="btn">Add hours</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Temporary pauses</h2>
        {(pauses ?? []).length === 0 && <p className="text-sm text-neutral-500">No current or upcoming pauses.</p>}
        <table className="table">
          <tbody>
            {(pauses ?? []).map((p) => (
              <tr key={p.id}>
                <td>
                  {formatDateTime(p.starts_at, tz)} → {formatDateTime(p.ends_at, tz)}
                </td>
                <td>{p.reason}</td>
                <td className="text-right">
                  {isAdmin && (
                    <form action={deletePause}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn-danger">End / remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={pauseAgent} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="minutes" value="0" />
          <label className="flex flex-col gap-1 text-xs">
            From
            <input type="datetime-local" name="starts_at" required className="input" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Until
            <input type="datetime-local" name="ends_at" required className="input" />
          </label>
          <input name="reason" placeholder="Reason (e.g. staff meeting)" className="input" />
          <button className="btn">Schedule pause</button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Holidays</h2>
        <p className="mb-3 text-xs text-neutral-500">No bookings and no agent on these clinic days.</p>
        <table className="table">
          <tbody>
            {(holidays ?? []).map((h) => (
              <tr key={h.id}>
                <td>{h.day}</td>
                <td>{h.reason}</td>
                <td className="text-right">
                  {isAdmin && (
                    <form action={deleteHoliday}>
                      <input type="hidden" name="id" value={h.id} />
                      <button className="btn-danger">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isAdmin && (
          <form action={addHoliday} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="date" name="day" required className="input" />
            <input name="reason" placeholder="Reason (e.g. Diwali)" className="input" />
            <button className="btn">Add holiday</button>
          </form>
        )}
      </section>
    </div>
  );
}
