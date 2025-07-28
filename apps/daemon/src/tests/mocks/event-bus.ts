/**
 * EventBus Mock
 *
 * Mock EventBus implementation for testing.
 */

import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import { vi } from "vitest"

export function createMockEventBus(): IEventBus {
  return {
    emit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    clearHandlers: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      totalHandlers: 0,
      handlersByType: new Map(),
      eventsEmitted: 0,
      errors: 0,
    }),
  }
}
