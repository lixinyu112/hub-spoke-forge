/**
 * Format a Date object to ISO string for transport.
 * @param date Source date.
 * @returns ISO-8601 formatted string.
 */
export function formatDateToIso(date: Date): string {
  return date.toISOString();
}
