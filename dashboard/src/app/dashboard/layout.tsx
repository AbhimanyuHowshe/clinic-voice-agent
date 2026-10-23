import { Suspense } from "react";
import { getStaff } from "@/lib/staff";
import { signOut } from "./actions";
import { FlashError } from "./flash-error";
import { LiveRefresh } from "./live-refresh";
import { NavLinks } from "./nav-links";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/appointments", label: "Appointments" },
  { href: "/dashboard/agent", label: "Agent controls" },
  { href: "/dashboard/doctors", label: "Doctors" },
  { href: "/dashboard/faqs", label: "FAQs" },
  { href: "/dashboard/calls", label: "Calls" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  const nav = staff?.role === "admin" ? [...NAV, { href: "/dashboard/audit", label: "Audit log" }] : NAV;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="font-semibold leading-tight">{staff?.clinic.name ?? "Clinic dashboard"}</p>
              {staff && (
                <p className="text-xs text-slate-500">
                  {staff.fullName || staff.email} · <span className="capitalize">{staff.role}</span> · {staff.clinic.timezone}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {staff && <LiveRefresh />}
            <form action={signOut}>
              <button className="btn">Sign out</button>
            </form>
          </div>
        </div>
        {staff && <NavLinks items={nav} />}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Suspense>
          <FlashError />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
