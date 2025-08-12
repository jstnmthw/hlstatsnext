/**
 * Event Coordinator Tests
 */

import { describe, it, expect, vi } from "vitest"
import type { EventCoordinator } from "./event-coordinator"

describe("EventCoordinator interface", () => {
  it("should define a coordinateEvent method signature", async () => {
    const stub: EventCoordinator = {
      coordinateEvent: vi.fn().mockResolvedValue(undefined),
    }

    await expect(
      stub.coordinateEvent({
        eventType: "PLAYER_KILL",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      } as unknown as Parameters<EventCoordinator["coordinateEvent"]>[0]),
    ).resolves.toBeUndefined()
  })
})
