/**
 * Time Infrastructure Exports
 */

export type { IClock } from "./clock.interface"
export { SystemClock } from "./system-clock"
export { TestClock } from "./test-clock"

// Import for instance creation
import { SystemClock } from "./system-clock"

// Create a default system clock instance for convenience
export const systemClock = new SystemClock()
