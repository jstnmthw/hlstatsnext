/**
 * Rate Limiter for Authentication Failures
 *
 * Tracks failed authentication attempts per source IP and blocks
 * sources that exceed the threshold.
 */

export interface RateLimiterConfig {
  /** Maximum failed attempts before blocking (default: 10) */
  maxAttempts: number
  /** Time window for counting attempts in ms (default: 60000 = 1 minute) */
  windowMs: number
  /** Block duration in ms after threshold exceeded (default: 60000 = 1 minute) */
  blockDurationMs: number
}

export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxAttempts: 10,
  windowMs: 60_000, // 1 minute
  blockDurationMs: 60_000, // 1 minute
}

interface RateLimitEntry {
  /** Timestamps of failed attempts within the current window */
  attempts: number[]
  /** Timestamp when the block expires (if blocked) */
  blockedUntil: number | null
}

/**
 * Simple sliding window rate limiter for tracking authentication failures.
 */
export class AuthRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>()
  private readonly config: RateLimiterConfig

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config }
  }

  /**
   * Check if a source IP is currently rate-limited.
   *
   * @param sourceIp - The source IP address
   * @returns true if blocked, false if allowed
   */
  isBlocked(sourceIp: string): boolean {
    const entry = this.entries.get(sourceIp)
    if (!entry) return false

    const now = Date.now()

    // Check if currently blocked
    if (entry.blockedUntil !== null && entry.blockedUntil > now) {
      return true
    }

    // Block has expired - clear it
    if (entry.blockedUntil !== null && entry.blockedUntil <= now) {
      entry.blockedUntil = null
      entry.attempts = []
    }

    return false
  }

  /**
   * Record a failed authentication attempt.
   * If threshold is exceeded, the source will be blocked.
   *
   * @param sourceIp - The source IP address
   * @returns true if the source is now blocked, false otherwise
   */
  recordFailure(sourceIp: string): boolean {
    const now = Date.now()

    let entry = this.entries.get(sourceIp)
    if (!entry) {
      entry = { attempts: [], blockedUntil: null }
      this.entries.set(sourceIp, entry)
    }

    // If already blocked, return true
    if (entry.blockedUntil !== null && entry.blockedUntil > now) {
      return true
    }

    // Clean up expired attempts outside the window
    const windowStart = now - this.config.windowMs
    entry.attempts = entry.attempts.filter((ts) => ts > windowStart)

    // Record this attempt
    entry.attempts.push(now)

    // Check if threshold exceeded
    if (entry.attempts.length >= this.config.maxAttempts) {
      entry.blockedUntil = now + this.config.blockDurationMs
      entry.attempts = [] // Clear attempts after blocking
      return true
    }

    return false
  }

  /**
   * Clear rate limit state for a specific IP or all IPs.
   *
   * @param sourceIp - Optional IP to clear; if omitted, clears all
   */
  clear(sourceIp?: string): void {
    if (sourceIp) {
      this.entries.delete(sourceIp)
    } else {
      this.entries.clear()
    }
  }

  /**
   * Get the remaining attempts before an IP is blocked.
   *
   * @param sourceIp - The source IP address
   * @returns Number of remaining attempts, or 0 if blocked
   */
  getRemainingAttempts(sourceIp: string): number {
    if (this.isBlocked(sourceIp)) return 0

    const entry = this.entries.get(sourceIp)
    if (!entry) return this.config.maxAttempts

    const now = Date.now()
    const windowStart = now - this.config.windowMs
    const recentAttempts = entry.attempts.filter((ts) => ts > windowStart).length

    return Math.max(0, this.config.maxAttempts - recentAttempts)
  }
}
