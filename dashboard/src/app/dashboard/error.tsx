"use client";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="card max-w-lg border-red-300 dark:border-red-800">
      <h1 className="font-semibold text-red-700 dark:text-red-400">That didn&apos;t work</h1>
      <p className="mt-2 text-sm">{error.message || "Something went wrong."}</p>
      <button onClick={reset} className="btn mt-4">
        Try again
      </button>
    </div>
  );
}
