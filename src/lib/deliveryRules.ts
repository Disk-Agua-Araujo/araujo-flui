/**
 * Business rules for enterprise delivery scheduling.
 * - Before 14:00: same-day delivery allowed (if weekday)
 * - 14:00 or later: next business day
 * - Weekends (Sat/Sun) are never selectable
 */

export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Mon-Fri
}

export function getNextBusinessDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (!isWeekday(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Returns the minimum delivery date based on current time.
 * - Before 14:00 on a weekday: today
 * - 14:00+ or weekend: next business day
 */
export function getMinDeliveryDate(now: Date = new Date()): Date {
  const hour = now.getHours();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (isWeekday(today) && hour < 14) {
    return today;
  }

  return getNextBusinessDay(today);
}

/**
 * Check if a given date is valid for enterprise delivery.
 */
export function isValidDeliveryDate(date: Date, now: Date = new Date()): boolean {
  if (!isWeekday(date)) return false;
  const min = getMinDeliveryDate(now);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return dateOnly >= min;
}

/**
 * Calendar disabled function for enterprise delivery date picker.
 */
export function isDeliveryDateDisabled(date: Date, now: Date = new Date()): boolean {
  return !isValidDeliveryDate(date, now);
}
