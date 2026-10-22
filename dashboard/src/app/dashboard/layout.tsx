import Link from "next/link";
import { Suspense } from "react";
import { getStaff } from "@/lib/staff";
import { signOut } from "./actions";
import { FlashError } from "./flash-error";

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
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-semibold">{staff?.clinic.name ?? "Clinic dashboard"}</p>
            {staff && (
              <p className="text-xs text-neutral-500">
                {staff.fullName || staff.email} · {staff.role} · times in {staff.clinic.timezone}
              </p>
            )}
          </div>
          <form action={signOut}>
            <button className="btn">Sign out</button>
          </form>
        </div>
        {staff && (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
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
