import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A stored time as a Date. The database mostly stores Unix seconds, though a
 * few older rows hold milliseconds; treating seconds as milliseconds would
 * show every date as January 1970.
 */
export function toDate(timestamp: number): Date {
  return new Date(timestamp < 100_000_000_000 ? timestamp * 1000 : timestamp);
}

export function formatShortDate(timestamp: number): string {
  return toDate(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(timestamp: number): string {
  return toDate(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
