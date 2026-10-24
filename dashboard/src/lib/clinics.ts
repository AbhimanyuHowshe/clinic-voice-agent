// Public demo clinics offered on the patient voice page. The agent loads the clinic's real
// data from Supabase by slug; this list only drives the picker and the token route allowlist.
export const DEMO_CLINICS = [
  { slug: "sanjeevani", name: "Dr. Singh Dental Clinic", place: "Ujjain, India", languages: "Hindi, English, Hinglish" },
  { slug: "harbourside", name: "Harbourside Demo Medical Centre", place: "Sydney, Australia", languages: "English" },
] as const;

export type ClinicSlug = (typeof DEMO_CLINICS)[number]["slug"];

export function isDemoClinic(slug: string | null): slug is ClinicSlug {
  return DEMO_CLINICS.some((c) => c.slug === slug);
}
