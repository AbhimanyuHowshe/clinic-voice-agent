import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { setFollowUpDone } from "../actions";

const OUTCOME: Record<string, string> = {
  in_progress: "In progress",
  completed: "Completed",
  rejected_unavailable: "Agent unavailable",
  escalated: "Needs staff",
  error: "Error",
};

export default async function Calls() {
  const staff = await requireStaff();
  const tz = staff.clinic.timezone;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("call_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Calls</h1>
        <p className="text-sm text-neutral-500">
          Last 100 voice sessions. No recordings or transcripts are stored — only the outcome and actions taken.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Started</th>
              <th>Outcome</th>
              <th>Actions</th>
              <th>Staff follow-up</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap">{formatDateTime(c.started_at, tz)}</td>
                <td>{OUTCOME[c.outcome] ?? c.outcome}</td>
                <td>{(c.actions as string[]).join(", ") || "—"}</td>
                <td>
                  {c.escalation_reason || c.callback_phone ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {c.escalation_reason}
                        {c.callback_phone && <span className="ml-1 font-mono">· call {c.callback_phone}</span>}
                      </span>
                      <form action={setFollowUpDone}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="done" value={c.follow_up_done ? "false" : "true"} />
                        <button className={c.follow_up_done ? "btn" : "btn-primary"}>
                          {c.follow_up_done ? "Done ✓ (undo)" : "Mark done"}
                        </button>
                      </form>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data ?? []).length === 0 && <p className="text-sm text-neutral-500">No calls yet.</p>}
      </div>
    </div>
  );
}
