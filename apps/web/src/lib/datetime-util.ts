import { format, formatDistanceToNow, isThisYear, isToday, isYesterday } from "date-fns"

/**
 * Formats a date in a human-friendly way:
 * - For recent dates: relative time (e.g., "30s ago", "1m ago", "1h ago")
 * - For older dates: absolute format (e.g., "15/12/2023 14:30")
 *
 * @param date - The date to format (Date object or date string)
 * @param options - Optional configuration
 * @returns Formatted date string
 */
export function formatHumanFriendlyDate(
  date: Date | string,
  options: {
    /** Include seconds in relative time (default: true) */
    includeSeconds?: boolean
    /** Custom format for absolute dates (default: "dd/MM/yyyy HH:mm") */
    absoluteFormat?: string
    /** Threshold in hours to switch from relative to absolute (default: 24) */
    relativeThreshold?: number
  } = {},
): string {
  const {
    includeSeconds = true,
    absoluteFormat = "dd/MM/yyyy HH:mm",
    relativeThreshold = 24,
  } = options

  const dateObj = typeof date === "string" ? new Date(date) : date

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date provided")
  }

  const now = new Date()
  const hoursDiff = Math.abs(now.getTime() - dateObj.getTime()) / (1000 * 60 * 60)

  // Use relative format for dates within the threshold
  if (hoursDiff < relativeThreshold) {
    return formatDistanceToNow(dateObj, {
      addSuffix: true,
      includeSeconds,
    })
  }

  // Use absolute format for older dates
  return format(dateObj, absoluteFormat)
}

/**
 * Formats a date with additional context for better readability:
 * - Today: "Today at 14:30"
 * - Yesterday: "Yesterday at 14:30"
 * - This year: "15 Dec at 14:30"
 * - Other years: "15/12/2023 14:30"
 *
 * @param date - The date to format (Date object or date string)
 * @returns Formatted date string with context
 */
export function formatDateWithContext(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date

  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date provided")
  }

  const timeFormat = "HH:mm"
  const time = format(dateObj, timeFormat)

  if (isToday(dateObj)) {
    return `Today at ${time}`
  }

  if (isYesterday(dateObj)) {
    return `Yesterday at ${time}`
  }

  if (isThisYear(dateObj)) {
    return `${format(dateObj, "dd MMM")} at ${time}`
  }

  return format(dateObj, "dd/MM/yyyy HH:mm")
}

/**
 * Formats a date range in a human-friendly way
 * - Same day: "15/12/2023 14:30 - 14:30"'
 * - Same year: "15 Dec - 15 Dec 2023"
 * - Different years: "15/12/2023 - 15/12/2024"
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted date range string
 */
export function formatDateRange(startDate: Date | string, endDate: Date | string): string {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate
  const end = typeof endDate === "string" ? new Date(endDate) : endDate

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid date provided")
  }

  // If same day, show time range
  if (format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd")) {
    return `${format(start, "dd/MM/yyyy")} ${format(start, "HH:mm")} - ${format(end, "HH:mm")}`
  }

  // If same year, show date range without year
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, "dd MMM")} - ${format(end, "dd MMM yyyy")}`
  }

  // Different years, show full dates
  return `${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}`
}

/**
 * Utility to check if a date is recent (within specified hours)
 *
 * @param date - The date to check
 * @param minutes - Number of minutes to consider "recent" (default: 24 * 60)
 * @returns True if the date is within the specified hours
 */
export function isRecentDate(date: Date | string, minutes: number = 24 * 60): boolean {
  const dateObj = typeof date === "string" ? new Date(date) : date

  if (isNaN(dateObj.getTime())) {
    return false
  }

  const now = new Date()
  const minutesDiff = Math.abs(now.getTime() - dateObj.getTime()) / (1000 * 60)

  return minutesDiff < minutes
}

/**
 * Formats a date in the format "dd/MM/yyyy HH:mm"
 *
 * @param date - The date to format (Date object or date string)
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date

  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid date provided")
  }

  // AM/PM
  return format(dateObj, "dd/MM/yyyy hh:mm a")
}

/**
 * Formats duration in seconds to human readable format
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "2h 30m", "45m", "30s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24

  if (remainingHours > 0) {
    return `${days}d ${remainingHours}h`
  }

  return `${days}d`
}
