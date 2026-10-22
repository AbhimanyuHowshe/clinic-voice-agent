export default function NoAccess() {
  return (
    <div className="card max-w-lg">
      <h1 className="text-lg font-semibold">No clinic access</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Your account is signed in but not linked to a clinic. Ask the clinic administrator to add you (they run{" "}
        <code>scripts/create_staff.py</code>).
      </p>
    </div>
  );
}
