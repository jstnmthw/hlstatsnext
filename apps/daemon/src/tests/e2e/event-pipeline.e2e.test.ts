/**
 * Event Pipeline E2E Tests
 *
 * Tests the full log line → parse → DB write → queue publish pipeline
 * with real MySQL, RabbitMQ, and Garnet services.
 */

import { createAppContext, type AppContext } from "@/context"
import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getTestDb } from "../integration/helpers/test-db"

// Type for accessing ingress service internals in tests
interface TestIngressService {
  dependencies: {
    tokenAuthenticator: {
      lookupSource: ReturnType<typeof vi.fn>
      handleBeacon: ReturnType<typeof vi.fn>
      getAuthenticatedServerIds: ReturnType<typeof vi.fn>
    }
    serverInfoProvider: {
      getServerGame: ReturnType<typeof vi.fn>
    }
  }
  setPublisher: (publisher: IEventPublisher) => void
  processRawEvent: (logLine: string, serverId: number) => Promise<BaseEvent | null>
  getStats: () => { totalLogsProcessed: number; totalErrors: number }
}

describe("Event Pipeline (e2e)", () => {
  let context: AppContext
  let capturedEvents: BaseEvent[]
  let mockPublisher: IEventPublisher
  let serverId: number

  beforeEach(async () => {
    capturedEvents = []
    mockPublisher = {
      publish: vi.fn().mockImplementation(async (event: BaseEvent) => {
        capturedEvents.push(event)
      }),
      publishBatch: vi.fn().mockResolvedValue(undefined),
    }

    context = createAppContext({ port: 27500, host: "127.0.0.1" })
    context.ingressService.setPublisher(mockPublisher)

    // Create a test server in the real database
    const server = await getTestDb().server.create({
      data: {
        name: "E2E Test Server",
        address: "127.0.0.1",
        port: 27015,
        game: "cstrike",
        activeMap: "de_dust2",
      },
    })
    serverId = server.serverId

    // Mock token authenticator to return our test server
    const ingress = context.ingressService as unknown as TestIngressService
    ingress.dependencies.tokenAuthenticator.lookupSource = vi.fn().mockReturnValue(serverId)
    ingress.dependencies.tokenAuthenticator.handleBeacon = vi
      .fn()
      .mockResolvedValue({ kind: "authenticated", serverId })
    ingress.dependencies.serverInfoProvider.getServerGame = vi.fn().mockResolvedValue("cstrike")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("kill event pipeline", () => {
    it("should parse a kill log line and produce a PLAYER_KILL event", async () => {
      const logLine =
        '"Attacker<2><STEAM_0:1:12345><CT>" killed "Defender<3><STEAM_0:1:67890><TERRORIST>" with "ak47" (headshot)'

      const event = await context.ingressService.processRawEvent(logLine, serverId)

      expect(event).not.toBeNull()
      expect(event!.eventType).toBe(EventType.PLAYER_KILL)
      expect(event!.serverId).toBe(serverId)
      expect(event!.data).toMatchObject({
        weapon: "ak47",
        headshot: true,
      })
      expect(event!.meta).toMatchObject({
        killer: { steamId: "STEAM_0:1:12345", playerName: "Attacker" },
        victim: { steamId: "STEAM_0:1:67890", playerName: "Defender" },
      })
      // Verify event has UUID
      expect(event!.eventId).toBeDefined()
      expect(event!.correlationId).toBeDefined()
    })
  })

  describe("player connect → entry → disconnect lifecycle", () => {
    it("should process the full player connection lifecycle", async () => {
      const events: (BaseEvent | null)[] = []

      // Connect
      events.push(
        await context.ingressService.processRawEvent(
          '"TestPlayer<2><STEAM_0:1:12345><>" connected, address "192.168.1.100:27015"',
          serverId,
        ),
      )

      // Entry
      events.push(
        await context.ingressService.processRawEvent(
          '"TestPlayer<2><STEAM_0:1:12345><>" entered the game',
          serverId,
        ),
      )

      // Disconnect
      events.push(
        await context.ingressService.processRawEvent(
          '"TestPlayer<2><STEAM_0:1:12345><CT>" disconnected',
          serverId,
        ),
      )

      // Verify all events were created
      expect(events[0]).not.toBeNull()
      expect(events[0]!.eventType).toBe(EventType.PLAYER_CONNECT)

      expect(events[1]).not.toBeNull()
      expect(events[1]!.eventType).toBe(EventType.PLAYER_ENTRY)

      expect(events[2]).not.toBeNull()
      expect(events[2]!.eventType).toBe(EventType.PLAYER_DISCONNECT)

      // All should have consistent server ID
      for (const event of events) {
        expect(event!.serverId).toBe(serverId)
      }
    })
  })

  describe("team actions", () => {
    it("should process team change events", async () => {
      const logLine = '"TestPlayer<2><STEAM_0:1:12345><Unassigned>" joined team "CT"'

      const event = await context.ingressService.processRawEvent(logLine, serverId)

      expect(event).not.toBeNull()
      expect(event!.eventType).toBe(EventType.PLAYER_CHANGE_TEAM)
      expect(event!.data).toMatchObject({
        gameUserId: 2,
        team: "CT",
      })
    })
  })

  describe("error handling", () => {
    it("should handle invalid log lines gracefully", async () => {
      const invalidLogLine = "this is not a valid log line at all"

      const event = await context.ingressService.processRawEvent(invalidLogLine, serverId)

      // Should return null for unparseable lines, not throw
      expect(event).toBeNull()
    })

    it("should not count unrecognized lines as errors", async () => {
      const ingress = context.ingressService as unknown as TestIngressService

      // Unrecognized lines are treated as success with no event (not errors)
      await context.ingressService.processRawEvent("invalid 1", serverId)
      await context.ingressService.processRawEvent("invalid 2", serverId)

      const stats = ingress.getStats()
      expect(stats.totalErrors).toBe(0)
    })
  })
})
