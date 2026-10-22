// Timestamps are stored in UTC; staff see and enter clinic-local times.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(n: number) {
  return WEEKDAYS[n] ?? String(n);
}

export function formatDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** "HH:MM:SS" from Postgres `time` -> "HH:MM". */
export function shortTime(t: string) {
  return t.slice(0, 5);
}

/** Clinic-local calendar date (YYYY-MM-DD) for an instant. */
export function localDate(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function tzOffset(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - instant.getTime();
}

/** Clinic-local "YYYY-MM-DDTHH:MM" -> UTC instant. Throws on malformed input. */
export function zonedToUtc(local: string, timeZone: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error("Invalid date/time");
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let result = naive - tzOffset(new Date(naive), timeZone);
  // Second pass corrects for a DST change between the guess and the answer.
  result = naive - tzOffset(new Date(result), timeZone);
  return new Date(result);
}

/** UTC [start, end) of a clinic-local calendar day. */
export function localDayRange(day: string, timeZone: string) {
  const start = zonedToUtc(`${day}T00:00`, timeZone);
  const next = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + 1));
  const end = zonedToUtc(`${next.toISOString().slice(0, 10)}T00:00`, timeZone);
  return { start: start.toISOString(), end: end.toISOString() };
}
