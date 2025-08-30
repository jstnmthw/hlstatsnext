/**
 * System Clock Implementation
 *
 * Production implementation that uses the system's actual time.
 */

import type { IClock } from "./clock.interface"

export class SystemClock implements IClock {
  now(): Date {
    return new Date()
  }

  timestamp(): number {
    return Date.now()
  }

  isoString(): string {
    return new Date().toISOString()
  }

  fromTimestamp(timestamp: number): Date {
    return new Date(timestamp)
  }

  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
