"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** Shows the ?error= message a failed server action redirected back with. */
export function FlashError() {
  const message = useSearchParams().get("error");
  const pathname = usePathname();
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start justify-between gap-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
    >
      <span>{message}</span>
      <Link href={pathname} className="underline">
        Dismiss
      </Link>
    </div>
  );
}
