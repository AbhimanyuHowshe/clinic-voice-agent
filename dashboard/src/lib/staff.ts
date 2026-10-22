import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Staff = {
  userId: string;
  email: string;
  fullName: string;
  role: "admin" | "staff";
  clinic: { id: string; name: string; timezone: string; slug: string };
};

/** The signed-in staff member and their clinic, or a redirect to /login. Cached per request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, clinics(id, name, timezone, slug)")
    .eq("id", user.id)
    .maybeSingle();
  const clinic = profile?.clinics as unknown as Staff["clinic"] | null;
  if (!profile || !clinic) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
    clinic,
  };
});

/** Like getStaff, but for pages that require a linked clinic. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/dashboard/no-access");
  return staff;
}
