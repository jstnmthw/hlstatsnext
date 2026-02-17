import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  formatDate,
  formatDateRange,
  formatDateWithContext,
  formatDuration,
  formatHumanFriendlyDate,
  isRecentDate,
} from "./datetime-util"

// Helper: create a local-time Date (months are 0-indexed)
function local(y: number, m: number, d: number, h = 0, min = 0, s = 0) {
  return new Date(y, m - 1, d, h, min, s)
}

describe("formatHumanFriendlyDate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(local(2025, 6, 15, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns relative time for recent dates", () => {
    const oneHourAgo = local(2025, 6, 15, 11, 0, 0)
    const result = formatHumanFriendlyDate(oneHourAgo)
    expect(result).toContain("ago")
  })

  it("returns absolute time for old dates", () => {
    const oldDate = local(2025, 6, 10, 10, 0, 0)
    const result = formatHumanFriendlyDate(oldDate)
    expect(result).toBe("10/06/2025 10:00")
  })

  it("throws on invalid date", () => {
    expect(() => formatHumanFriendlyDate("not-a-date")).toThrow("Invalid date provided")
  })

  it("uses custom absoluteFormat", () => {
    const oldDate = local(2025, 6, 10, 10, 0, 0)
    const result = formatHumanFriendlyDate(oldDate, { absoluteFormat: "yyyy-MM-dd" })
    expect(result).toBe("2025-06-10")
  })

  it("uses custom relativeThreshold", () => {
    const threeHoursAgo = local(2025, 6, 15, 9, 0, 0)
    const result = formatHumanFriendlyDate(threeHoursAgo, { relativeThreshold: 1 })
    expect(result).toBe("15/06/2025 09:00")
  })

  it("respects includeSeconds option", () => {
    const thirtySecondsAgo = local(2025, 6, 15, 11, 59, 30)
    const result = formatHumanFriendlyDate(thirtySecondsAgo, { includeSeconds: false })
    expect(result).toContain("ago")
  })

  it("accepts string dates and formats them", () => {
    // String dates are parsed by Date constructor, timezone-dependent
    const dateStr = local(2025, 6, 10, 10, 0, 0).toISOString()
    const result = formatHumanFriendlyDate(dateStr)
    // Just check it doesn't throw and returns a non-empty string
    expect(result.length).toBeGreaterThan(0)
  })
})

describe("formatDateWithContext", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(local(2025, 6, 15, 14, 30, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Today at HH:mm" for today\'s date', () => {
    const result = formatDateWithContext(local(2025, 6, 15, 10, 30, 0))
    expect(result).toBe("Today at 10:30")
  })

  it('returns "Yesterday at HH:mm" for yesterday\'s date', () => {
    const result = formatDateWithContext(local(2025, 6, 14, 10, 30, 0))
    expect(result).toBe("Yesterday at 10:30")
  })

  it('returns "dd MMM at HH:mm" for this year', () => {
    const result = formatDateWithContext(local(2025, 3, 10, 10, 30, 0))
    expect(result).toBe("10 Mar at 10:30")
  })

  it("returns dd/MM/yyyy HH:mm for other years", () => {
    const result = formatDateWithContext(local(2023, 12, 15, 14, 30, 0))
    expect(result).toBe("15/12/2023 14:30")
  })

  it("accepts string dates", () => {
    const todayStr = local(2025, 6, 15, 10, 30, 0).toISOString()
    const result = formatDateWithContext(todayStr)
    expect(result).toMatch(/^Today at/)
  })

  it("throws on invalid date", () => {
    expect(() => formatDateWithContext("bad-date")).toThrow("Invalid date provided")
  })
})

describe("formatDateRange", () => {
  it("returns time range for same-day dates", () => {
    const start = local(2025, 6, 15, 10, 0, 0)
    const end = local(2025, 6, 15, 14, 0, 0)
    expect(formatDateRange(start, end)).toBe("15/06/2025 10:00 - 14:00")
  })

  it("returns date range for same-year dates", () => {
    const start = local(2025, 3, 15, 10, 0, 0)
    const end = local(2025, 6, 20, 14, 0, 0)
    expect(formatDateRange(start, end)).toBe("15 Mar - 20 Jun 2025")
  })

  it("returns full date range for different-year dates", () => {
    const start = local(2023, 12, 15, 10, 0, 0)
    const end = local(2025, 6, 20, 14, 0, 0)
    expect(formatDateRange(start, end)).toBe("15/12/2023 - 20/06/2025")
  })

  it("accepts string dates", () => {
    const start = local(2025, 3, 15, 10, 0, 0)
    const end = local(2025, 6, 20, 14, 0, 0)
    const result = formatDateRange(start.toISOString(), end.toISOString())
    expect(result).toBe("15 Mar - 20 Jun 2025")
  })

  it("throws on invalid start date", () => {
    expect(() => formatDateRange("bad", new Date())).toThrow("Invalid date provided")
  })

  it("throws on invalid end date", () => {
    expect(() => formatDateRange(new Date(), "bad")).toThrow("Invalid date provided")
  })
})

describe("isRecentDate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(local(2025, 6, 15, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns true for recent dates within default threshold", () => {
    const oneHourAgo = local(2025, 6, 15, 11, 0, 0)
    expect(isRecentDate(oneHourAgo)).toBe(true)
  })

  it("returns false for old dates beyond default threshold", () => {
    const twoDaysAgo = local(2025, 6, 13, 12, 0, 0)
    expect(isRecentDate(twoDaysAgo)).toBe(false)
  })

  it("returns false for invalid dates", () => {
    expect(isRecentDate("bad-date")).toBe(false)
  })

  it("uses custom threshold", () => {
    const thirtyMinAgo = local(2025, 6, 15, 11, 30, 0)
    expect(isRecentDate(thirtyMinAgo, 15)).toBe(false)
    expect(isRecentDate(thirtyMinAgo, 60)).toBe(true)
  })

  it("accepts string dates", () => {
    const recent = local(2025, 6, 15, 11, 30, 0)
    expect(isRecentDate(recent.toISOString())).toBe(true)
  })
})

describe("formatDate", () => {
  it("formats a date with AM/PM", () => {
    const date = local(2025, 6, 15, 14, 30, 0)
    const result = formatDate(date)
    expect(result).toBe("15/06/2025 02:30 PM")
  })

  it("formats morning time", () => {
    const date = local(2025, 6, 15, 9, 15, 0)
    const result = formatDate(date)
    expect(result).toBe("15/06/2025 09:15 AM")
  })

  it("throws on invalid date", () => {
    expect(() => formatDate("invalid")).toThrow("Invalid date provided")
  })
})

describe("formatDuration", () => {
  it("formats seconds under 60 as Xs", () => {
    expect(formatDuration(30)).toBe("30s")
    expect(formatDuration(0)).toBe("0s")
    expect(formatDuration(59)).toBe("59s")
  })

  it("formats minutes under 60 as Xm", () => {
    expect(formatDuration(60)).toBe("1m")
    expect(formatDuration(120)).toBe("2m")
    expect(formatDuration(3540)).toBe("59m")
  })

  it("formats hours under 24 as Xh Ym", () => {
    expect(formatDuration(3600)).toBe("1h")
    expect(formatDuration(5400)).toBe("1h 30m")
    expect(formatDuration(7200)).toBe("2h")
  })

  it("formats days as Xd Yh", () => {
    expect(formatDuration(86400)).toBe("1d")
    expect(formatDuration(90000)).toBe("1d 1h")
    expect(formatDuration(172800)).toBe("2d")
  })
})
