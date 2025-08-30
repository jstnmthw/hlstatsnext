/**
 * Test Clock Implementation
 *
 * Deterministic clock implementation for testing.
 * Allows controlling time progression and making tests predictable.
 */

import type { IClock } from "./clock.interface"

export class TestClock implements IClock {
  private currentTime: number

  constructor(initialTime?: Date | number) {
    if (initialTime instanceof Date) {
      this.currentTime = initialTime.getTime()
    } else if (typeof initialTime === "number") {
      this.currentTime = initialTime
    } else {
      // Default to a fixed timestamp for predictable tests
      this.currentTime = new Date("2024-01-01T00:00:00.000Z").getTime()
    }
  }

  now(): Date {
    return new Date(this.currentTime)
  }

  timestamp(): number {
    return this.currentTime
  }

  isoString(): string {
    return new Date(this.currentTime).toISOString()
  }

  fromTimestamp(timestamp: number): Date {
    return new Date(timestamp)
  }

  async sleep(ms: number): Promise<void> {
    // In tests, we can choose to advance time instead of actually sleeping
    this.advance(ms)
    return Promise.resolve()
  }

  /**
   * Advance the clock by the specified number of milliseconds
   */
  advance(ms: number): void {
    this.currentTime += ms
  }

  /**
   * Set the clock to a specific time
   */
  setTime(time: Date | number): void {
    if (time instanceof Date) {
      this.currentTime = time.getTime()
    } else {
      this.currentTime = time
    }
  }

  /**
   * Reset the clock to the default test time
   */
  reset(): void {
    this.currentTime = new Date("2024-01-01T00:00:00.000Z").getTime()
  }

  /**
   * Get the current time without affecting the clock
   */
  peek(): Date {
    return new Date(this.currentTime)
  }
}
