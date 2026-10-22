import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";

export default async function Audit() {
  const staff = await requireStaff();
  if (staff.role !== "admin") {
    return <p className="text-sm text-neutral-500">Only clinic admins can view the audit log.</p>;
  }
  const supabase = await createClient();
  const [{ data, error }, { data: people }] = await Promise.all([
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("profiles").select("id, full_name"),
  ]);
  if (error) throw new Error(error.message);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Audit log</h1>
        <p className="text-sm text-neutral-500">
          Last 200 changes. &ldquo;AI agent&rdquo; means a change made by the voice receptionist; patient details are
          not copied here.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Change</th>
              <th>New values</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap">{formatDateTime(a.created_at, staff.clinic.timezone)}</td>
                <td>{a.actor ? names.get(a.actor) || "Staff" : "AI agent / system"}</td>
                <td className="whitespace-nowrap">
                  {a.action} {a.table_name}
                </td>
                <td className="max-w-md truncate font-mono text-xs" title={JSON.stringify(a.new_data)}>
                  {a.new_data ? JSON.stringify(a.new_data) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
