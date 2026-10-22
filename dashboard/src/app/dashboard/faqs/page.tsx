import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { deleteFaq, saveFaq } from "../actions";

export default async function Faqs() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "admin";
  const supabase = await createClient();
  const { data, error } = await supabase.from("clinic_faqs").select("*").order("question");
  if (error) throw new Error(error.message);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">FAQs</h1>
        <p className="text-sm text-neutral-500">
          The receptionist answers clinic questions only from active FAQs; anything else goes to staff. Changes apply
          to new calls.
        </p>
      </div>

      {(data ?? []).map((f) => (
        <form key={f.id} action={saveFaq} className={`card flex flex-col gap-2 ${f.active ? "" : "opacity-60"}`}>
          <input type="hidden" name="id" value={f.id} />
          <fieldset disabled={!isAdmin} className="contents">
            <input name="question" defaultValue={f.question} required className="input font-medium" />
            <textarea name="answer" defaultValue={f.answer} required rows={2} className="input" />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={f.active} /> Active
              </label>
              {isAdmin && <button className="btn">Save</button>}
              {isAdmin && (
                <button formAction={deleteFaq} className="btn-danger">
                  Delete
                </button>
              )}
            </div>
          </fieldset>
        </form>
      ))}

      {isAdmin && (
        <form action={saveFaq} className="card flex flex-col gap-2">
          <h2 className="font-semibold">Add FAQ</h2>
          <input name="question" placeholder="Question" required className="input" />
          <textarea name="answer" placeholder="Approved answer" required rows={2} className="input" />
          <input type="hidden" name="active" value="on" />
          <div>
            <button className="btn-primary">Add</button>
          </div>
        </form>
      )}
    </div>
  );
}
