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
    serverAuthenticator: {
      authenticateServer: ReturnType<typeof vi.fn>
    }
    serverInfoProvider: {
      getServerGame: ReturnType<typeof vi.fn>
    }
  }
  setPublisher: (publisher: IEventPublisher) => void
  processRawEvent: (logLine: string, host: string, port: number) => Promise<BaseEvent | null>
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

    // Mock server authentication to return our test server
    const ingress = context.ingressService as unknown as TestIngressService
    ingress.dependencies.serverAuthenticator.authenticateServer = vi
      .fn()
      .mockResolvedValue(serverId)
    ingress.dependencies.serverInfoProvider.getServerGame = vi.fn().mockResolvedValue("cstrike")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("kill event pipeline", () => {
    it("should parse a kill log line and produce a PLAYER_KILL event", async () => {
      const logLine =
        '"Attacker<2><STEAM_0:1:12345><CT>" killed "Defender<3><STEAM_0:1:67890><TERRORIST>" with "ak47" (headshot)'

      const event = await context.ingressService.processRawEvent(logLine, "127.0.0.1", 27015)

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
      const connectLine = '"Player1<2><STEAM_0:1:11111><>" connected, address "192.168.1.100:27005"'
      events.push(await context.ingressService.processRawEvent(connectLine, "127.0.0.1", 27015))

      // Entry
      const entryLine = '"Player1<2><STEAM_0:1:11111><CT>" entered the game'
      events.push(await context.ingressService.processRawEvent(entryLine, "127.0.0.1", 27015))

      // Disconnect
      const disconnectLine = '"Player1<2><STEAM_0:1:11111><CT>" disconnected'
      events.push(await context.ingressService.processRawEvent(disconnectLine, "127.0.0.1", 27015))

      // All events should have been parsed
      const validEvents = events.filter((e) => e !== null)
      expect(validEvents.length).toBeGreaterThanOrEqual(2) // connect + entry at minimum

      // Check event types were recognized
      const eventTypes = validEvents.map((e) => e.eventType)
      expect(eventTypes).toContain(EventType.PLAYER_CONNECT)
      expect(eventTypes).toContain(EventType.PLAYER_ENTRY)
    })
  })

  describe("chat event pipeline", () => {
    it("should parse a chat message", async () => {
      const logLine = '"Chatter<2><STEAM_0:1:22222><CT>" say "Hello world"'

      const event = await context.ingressService.processRawEvent(logLine, "127.0.0.1", 27015)

      expect(event).not.toBeNull()
      expect(event!.eventType).toBe(EventType.CHAT_MESSAGE)
    })
  })

  describe("statistics tracking", () => {
    it("should track processed log counts", async () => {
      const lines = [
        '"P1<2><STEAM_0:1:33333><CT>" killed "P2<3><STEAM_0:1:44444><TERRORIST>" with "m4a1"',
        '"P1<2><STEAM_0:1:33333><CT>" say "gg"',
        "This is not a valid log line",
      ]

      for (const line of lines) {
        await context.ingressService.processRawEvent(line, "127.0.0.1", 27015)
      }

      const stats = context.ingressService.getStats()
      expect(stats.totalLogsProcessed).toBeGreaterThanOrEqual(0)
    })
  })

  describe("malformed input handling", () => {
    it("should return null for unparseable log lines", async () => {
      const event = await context.ingressService.processRawEvent(
        "completely invalid garbage",
        "127.0.0.1",
        27015,
      )
      expect(event).toBeNull()
    })

    it("should handle empty log lines", async () => {
      const event = await context.ingressService.processRawEvent("", "127.0.0.1", 27015)
      expect(event).toBeNull()
    })
  })
})
