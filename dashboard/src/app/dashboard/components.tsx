import { formatDateTime } from "@/lib/time";
import { setAppointmentStatus } from "./actions";

export type EffectiveState = {
  available: boolean;
  reason: "available" | "manual_off" | "holiday" | "paused" | "outside_hours";
  local_time: string;
};

const REASON_TEXT: Record<EffectiveState["reason"], string> = {
  available: "Answering calls",
  manual_off: "Switched OFF manually",
  holiday: "Off: clinic holiday",
  paused: "Off: temporary pause",
  outside_hours: "Off: outside agent hours",
};

export function StatusBadge({ state }: { state: EffectiveState }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
        state.available
          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${state.available ? "bg-green-600" : "bg-amber-600"}`} />
      {REASON_TEXT[state.reason] ?? state.reason}
    </span>
  );
}

export type AppointmentRow = {
  id: string;
  reference: string;
  patient_name: string;
  patient_phone: string;
  starts_at: string;
  status: string;
  source: string;
  doctors: { name: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  booked: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  no_show: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function AppointmentsTable({ rows, timeZone }: { rows: AppointmentRow[]; timeZone: string }) {
  if (rows.length === 0)
    return (
      <div className="card text-center text-sm text-slate-500">No appointments.</div>
    );
  return (
    <div className="card overflow-x-auto p-0">
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Doctor</th>
            <th>Patient</th>
            <th>Phone</th>
            <th>Ref</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap">{formatDateTime(a.starts_at, timeZone)}</td>
              <td>{a.doctors?.name}</td>
              <td className="font-medium">{a.patient_name}</td>
              <td className="whitespace-nowrap">{a.patient_phone}</td>
              <td className="font-mono text-xs text-slate-500">{a.reference}</td>
              <td className="whitespace-nowrap">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[a.status] ?? STATUS_STYLE.cancelled}`}>
                  {a.status.replace("_", "-")}
                </span>
                <span className="ml-1.5 text-xs text-slate-400">{a.source}</span>
              </td>
              <td className="whitespace-nowrap">
                {a.status === "booked" && (
                  <div className="flex gap-1">
                    {(["completed", "no_show", "cancelled"] as const).map((s) => (
                      <form key={s} action={setAppointmentStatus}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value={s} />
                        <button className={s === "cancelled" ? "btn-danger" : "btn"}>
                          {s === "completed" ? "Done" : s === "no_show" ? "No-show" : "Cancel"}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
