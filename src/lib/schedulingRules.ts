/**
 * Central scheduling rules for order management.
 * All date/time comparisons use America/Sao_Paulo timezone.
 */

const TZ = "America/Sao_Paulo";

/** Get current date string (YYYY-MM-DD) in São Paulo timezone */
export function getTodayInSP(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TZ }); // en-CA gives YYYY-MM-DD
}

/** Get current time string (HH:MM) in São Paulo timezone */
function getNowTimeSP(now: Date = new Date()): string {
  return now.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Parse a scheduled moment into a comparable Date (in SP timezone offset) */
function parseScheduledMoment(scheduledDate: string, scheduledTime?: string | null): Date {
  const time = scheduledTime && scheduledTime.includes(":") ? scheduledTime : "23:59";
  // Build ISO with Brazil offset (-03:00). This is a simplification —
  // Brazil hasn't used DST since 2019, so -03:00 is stable.
  return new Date(`${scheduledDate}T${time}:00-03:00`);
}

/** Check if scheduled_date is today in SP timezone */
export function isScheduledToday(scheduledDate: string, now: Date = new Date()): boolean {
  return scheduledDate === getTodayInSP(now);
}

/** Check if the scheduled moment is strictly in the future */
export function isScheduledFuture(
  scheduledDate: string,
  scheduledTime?: string | null,
  now: Date = new Date()
): boolean {
  const todaySP = getTodayInSP(now);
  if (scheduledDate > todaySP) return true;
  if (scheduledDate < todaySP) return false;
  // Same day — compare time
  const nowTimeSP = getNowTimeSP(now);
  const time = scheduledTime && scheduledTime.includes(":") ? scheduledTime : "23:59";
  return time > nowTimeSP;
}

/**
 * Check if the scheduled moment is late (past by at least 1 minute)
 * AND status is not finalized.
 */
export function isScheduledLate(
  scheduledDate: string,
  scheduledTime?: string | null,
  status?: string,
  now: Date = new Date()
): boolean {
  if (status === "entregue" || status === "cancelado") return false;
  const scheduledMoment = parseScheduledMoment(scheduledDate, scheduledTime);
  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  return scheduledMoment < oneMinuteAgo;
}

/**
 * Get the display label for a scheduled order.
 * Examples: "Hoje às 08:00" | "Amanhã às 14:00" | "25/03 às 09:30"
 */
export function getScheduleLabel(
  scheduledDate: string,
  scheduledTime?: string | null,
  now: Date = new Date()
): string {
  const todaySP = getTodayInSP(now);
  const time = scheduledTime && scheduledTime.includes(":") ? scheduledTime : null;
  const timePart = time ? ` às ${time}` : "";

  if (scheduledDate === todaySP) {
    return `Hoje${timePart}`;
  }

  // Check if tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowSP = getTodayInSP(tomorrow);
  if (scheduledDate === tomorrowSP) {
    return `Amanhã${timePart}`;
  }

  // Format as DD/MM
  const [, month, day] = scheduledDate.split("-");
  return `${day}/${month}${timePart}`;
}

/**
 * Determine badge type for a scheduled order.
 * Returns null if order has no scheduling.
 */
export function getScheduleBadgeType(
  order: { scheduled_date: string | null; scheduled_time?: string | null; status: string },
  now: Date = new Date()
): "late" | "today" | "future" | null {
  if (!order.scheduled_date) return null;

  if (isScheduledLate(order.scheduled_date, order.scheduled_time, order.status, now)) {
    return "late";
  }
  if (isScheduledToday(order.scheduled_date, now) && !isScheduledFuture(order.scheduled_date, order.scheduled_time, now)) {
    return "today";
  }
  if (isScheduledFuture(order.scheduled_date, order.scheduled_time, now)) {
    return "future";
  }
  // Today but already past and delivered/cancelled — show as today
  if (isScheduledToday(order.scheduled_date, now)) {
    return "today";
  }
  return null;
}

/** Format time value — normalize bare numbers like "10" to "10:00" */
export function formatTimeValue(val: string): string {
  if (!val) return "";
  return val.includes(":") ? val : `${val}:00`;
}
