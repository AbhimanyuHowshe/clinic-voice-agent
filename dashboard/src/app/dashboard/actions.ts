"use server";

// Staff actions. Each runs as the signed-in user, so Row Level Security decides what is
// allowed (members read; admins change configuration). Inputs are validated here as well.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { zonedToUtc } from "@/lib/time";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

function str(form: FormData, key: string, max = 2000) {
  const value = String(form.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`${key} is too long`);
  return value;
}

function id(form: FormData, key = "id") {
  const value = str(form, key, 64);
  if (!UUID.test(value)) throw new Error("Invalid id");
  return value;
}

function weekday(form: FormData) {
  const n = Number(form.get("weekday"));
  if (!Number.isInteger(n) || n < 0 || n > 6) throw new Error("Invalid weekday");
  return n;
}

function time(form: FormData, key: string) {
  const value = str(form, key, 5);
  if (!TIME.test(value)) throw new Error("Times must be HH:MM");
  return value;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function admin() {
  const staff = await requireStaff();
  if (staff.role !== "admin") throw new Error("Only clinic admins can change this.");
  return { staff, supabase: await createClient() };
}

/**
 * Runs an action; on failure, returns to the page the form was on with ?error=<message>,
 * because production builds hide thrown server-action messages from the browser.
 */
async function guarded(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    unstable_rethrow(e);
    const referer = (await headers()).get("referer");
    const path = referer ? new URL(referer).pathname : "/dashboard";
    const message = e instanceof Error ? e.message : "Something went wrong.";
    redirect(`${path}?error=${encodeURIComponent(message.slice(0, 200))}`);
  }
}

function done(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

// --- session -------------------------------------------------------------------------

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// --- agent controls ------------------------------------------------------------------

export async function setManualEnabled(form: FormData) {
  await guarded(async () => {
    const { staff, supabase } = await admin();
    const enabled = str(form, "enabled") === "true";
    const { error } = await supabase
      .from("agent_settings")
      .update({ manual_enabled: enabled, updated_by: staff.userId })
      .eq("clinic_id", staff.clinic.id);
    check(error);
    done("/dashboard", "/dashboard/agent");
  });
}

export async function saveAgentSettings(form: FormData) {
  await guarded(async () => {
    const { staff, supabase } = await admin();
    const fallbackMode = str(form, "fallback_mode");
    const policy = str(form, "ongoing_call_policy");
    if (!["closed_message", "transfer", "voicemail"].includes(fallbackMode)) throw new Error("Invalid fallback");
    if (!["finish", "end"].includes(policy)) throw new Error("Invalid policy");
    const transfer = str(form, "transfer_number", 20).replace(/[^\d+]/g, "");
    if (transfer && !/^\+?\d{8,15}$/.test(transfer)) throw new Error("Transfer number is not valid");
    const message = str(form, "fallback_message", 500);
    if (!message) throw new Error("Fallback message is required");

    const { error } = await supabase
      .from("agent_settings")
      .update({
        schedule_enabled: form.get("schedule_enabled") === "on",
        fallback_mode: fallbackMode,
        fallback_message: message,
        transfer_number: transfer || null,
        ongoing_call_policy: policy,
        updated_by: staff.userId,
      })
      .eq("clinic_id", staff.clinic.id);
    check(error);
    done("/dashboard", "/dashboard/agent");
  });
}

export async function addAgentWindow(form: FormData) {
  await guarded(async () => {
    const { staff, supabase } = await admin();
    const start = time(form, "start_time");
    const end = time(form, "end_time");
    if (start === end) throw new Error("Start and end must differ (an end before the start runs overnight).");
    const { error } = await supabase
      .from("agent_schedules")
      .insert({ clinic_id: staff.clinic.id, weekday: weekday(form), start_time: start, end_time: end });
    check(error);
    done("/dashboard", "/dashboard/agent");
  });
}

export async function deleteAgentWindow(form: FormData) {
  await guarded(async () => {
    const { supabase } = await admin();
    check((await supabase.from("agent_schedules").delete().eq("id", id(form))).error);
    done("/dashboard", "/dashboard/agent");
  });
}

/** Any staff member may pause the agent; only admins may delete pauses. */
export async function pauseAgent(form: FormData) {
  await guarded(async () => {
    const staff = await requireStaff();
    const supabase = await createClient();
    const minutes = Number(form.get("minutes"));
    const reason = str(form, "reason", 200);
    let starts: Date;
    let ends: Date;
    if (minutes > 0) {
      if (!Number.isInteger(minutes) || minutes > 7 * 24 * 60) throw new Error("Invalid duration");
      starts = new Date();
      ends = new Date(starts.getTime() + minutes * 60_000);
    } else {
      starts = zonedToUtc(str(form, "starts_at", 16), staff.clinic.timezone);
      ends = zonedToUtc(str(form, "ends_at", 16), staff.clinic.timezone);
    }
    if (ends <= starts) throw new Error("The pause must end after it starts.");
    const { error } = await supabase.from("temporary_pauses").insert({
      clinic_id: staff.clinic.id,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      reason,
      created_by: staff.userId,
    });
    check(error);
    done("/dashboard", "/dashboard/agent");
  });
}

export async function deletePause(form: FormData) {
  await guarded(async () => {
    const { supabase } = await admin();
    check((await supabase.from("temporary_pauses").delete().eq("id", id(form))).error);
    done("/dashboard", "/dashboard/agent");
  });
}

export async function addHoliday(form: FormData) {
  await guarded(async () => {
    const { staff, supabase } = await admin();
    const day = str(form, "day", 10);
    if (!DAY.test(day)) throw new Error("Invalid date");
    const { error } = await supabase
      .from("clinic_holidays")
      .insert({ clinic_id: staff.clinic.id, day, reason: str(form, "reason", 200) });
    check(error);
    done("/dashboard", "/dashboard/agent");
  });
}

export async function deleteHoliday(form: FormData) {
  await guarded(async () => {
    const { supabase } = await admin();
    check((await supabase.from("clinic_holidays").delete().eq("id", id(form))).error);
    done("/dashboard", "/dashboard/agent");
  });
}

// --- appointments --------------------------------------------------------------------

export async function setAppointmentStatus(form: FormData) {
  await guarded(async () => {
    await requireStaff();
    const supabase = await createClient();
    const status = str(form, "status");
    if (!["cancelled", "completed", "no_show"].includes(status)) throw new Error("Invalid status");
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id(form));
    check(error);
    done("/dashboard", "/dashboard/appointments");
  });
}

// --- doctors -------------------------------------------------------------------------

export async function saveDoctor(form: FormData) {
  await guarded(async () => {
    const { staff, supabase } = await admin();
    const name = str(form, "name", 120);
    const specialty = str(form, "specialty", 120) || "General Physician";
    const slot = Number(form.get("slot_minutes"));
    if (name.length < 2) throw new Error("Name is required");
    if (!Number.isInteger(slot) || slot < 5 || slot > 120) throw new Error("Slot length must be 5-120 minutes");
    const row = { name, specialty, slot_minutes: slot, active: form.get("active") !== "off" };
    const doctorId = str(form, "id", 64);
    const { error } = doctorId
      ? await supabase.from("doctors").update(row).eq("id", id(form))
      : await supabase.from("doctors").insert({ ...row, clinic_id: staff.clinic.id });
    check(error);
    done("/dashboard/doctors");
  });
}

export async function setDoctorActive(form: FormData) {
  await guarded(async () => {
    const { supabase } = await admin();
    const { error } = await supabase
      .from("doctors")
      .update({ active: str(form, "active") === "true" })
      .eq("id", id(form));
    check(error);
    done("/dashboard/doctors");
  });
}

export async function addDoctorHours(form: FormData) {
  await guarded(async () => {
    const { supabase } = await admin();
    const start = time(form, "start_time");
    const end = time(form, "end_time");
    if (start >= end) throw new Error("Consulting hours must end after they start.");
    const { error } = await supabase
      .from("doctor_schedules")
      .insert({ doctor_id: id(form, "doctor_id"), weekday: weekday(form), start_time: start, end_time: end });
    check(error);
    done("/dashboard/doctors");
  });
}

export async function deleteDoctorHours(form: FormData) {
  await guarded(async () => {
    const { supabase } = await admin();
    check((await supabase.from("doctor_schedules").delete().eq("id", id(form))).error);
    done("/dashboard/doctors");
  });
}

// --- FAQs ----------------------------------------------------------------------------

export async function saveFaq(form: FormData) {
  await guarded(async () => {
    const { staff, supabase } = await admin();
    const question = str(form, "question", 500);
    const answer = str(form, "answer", 2000);
    if (question.length < 3 || !answer) throw new Error("Question and answer are required");
    const row = { question, answer, active: form.get("active") === "on" };
    const faqId = str(form, "id", 64);
    const { error } = faqId
      ? await supabase.from("clinic_faqs").update(row).eq("id", id(form))
      : await supabase.from("clinic_faqs").insert({ ...row, clinic_id: staff.clinic.id });
    check(error);
    done("/dashboard/faqs");
  });
}

export async function deleteFaq(form: FormData) {
  await guarded(async () => {
    const { supabase } = await admin();
    check((await supabase.from("clinic_faqs").delete().eq("id", id(form))).error);
    done("/dashboard/faqs");
  });
}

// --- calls ---------------------------------------------------------------------------

export async function setFollowUpDone(form: FormData) {
  await guarded(async () => {
    await requireStaff();
    const supabase = await createClient();
    const { error } = await supabase
      .from("call_logs")
      .update({ follow_up_done: str(form, "done") === "true" })
      .eq("id", id(form));
    check(error);
    done("/dashboard/calls");
  });
}
