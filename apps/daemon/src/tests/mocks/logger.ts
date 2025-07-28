/**
 * Logger Mocks
 *
 * Mock logger implementation for testing.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { LogLevel } from "@/shared/utils/logger"
import { vi } from "vitest"

export function createMockLogger(): ILogger {
  return {
    ok: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    event: vi.fn(),
    chat: vi.fn(),
    queue: vi.fn(),
    starting: vi.fn(),
    started: vi.fn(),
    stopping: vi.fn(),
    stopped: vi.fn(),
    connecting: vi.fn(),
    connected: vi.fn(),
    disconnected: vi.fn(),
    failed: vi.fn(),
    ready: vi.fn(),
    received: vi.fn(),
    shutdown: vi.fn(),
    shutdownComplete: vi.fn(),
    fatal: vi.fn(),
    disableTimestamps: vi.fn(),
    enableTimestamps: vi.fn(),
    disableColors: vi.fn(),
    setColorsEnabled: vi.fn(),
    getLogLevel: vi.fn().mockReturnValue(LogLevel.INFO),
    setLogLevel: vi.fn(),
    setLogLevelFromString: vi.fn(),
  }
}
