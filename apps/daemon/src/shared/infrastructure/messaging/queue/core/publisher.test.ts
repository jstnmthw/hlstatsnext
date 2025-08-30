/**
 * Event Publisher Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventPublisher, defaultRoutingKeyMapper, defaultPriorityMapper } from "./publisher"
import type {
  IQueueClient,
  QueueChannel,
  EventMessage,
  RoutingKeyMapper,
  PriorityMapper,
} from "./types"
import { MessagePriority, QueuePublishError } from "./types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import { setUuidService } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import { SystemUuidService } from "@/shared/infrastructure/identifiers/system-uuid.service"
import { systemClock } from "@/shared/infrastructure/time"

describe("EventPublisher", () => {
  let publisher: EventPublisher
  let mockClient: IQueueClient
  let mockChannel: QueueChannel
  let mockLogger: ILogger

  beforeEach(() => {
    // Initialize UUID service for all tests
    setUuidService(new SystemUuidService(systemClock))

    mockChannel = {
      publish: vi.fn().mockReturnValue(true),
      ack: vi.fn(),
      nack: vi.fn(),
      consume: vi.fn(),
      cancel: vi.fn(),
      close: vi.fn(),
    } as unknown as QueueChannel

    mockClient = {
      createChannel: vi.fn().mockResolvedValue(mockChannel),
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
    } as unknown as IQueueClient

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      queue: vi.fn(),
    } as unknown as ILogger

    publisher = new EventPublisher(mockClient, mockLogger)
  })

  describe("Single Event Publishing", () => {
    it("should publish event successfully", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: { killerId: 123, victimId: 456 },
      }

      await publisher.publish(event)

      expect(mockClient.createChannel).toHaveBeenCalledWith("publisher")
      expect(mockChannel.publish).toHaveBeenCalledWith(
        "hlstats.events",
        "player.kill",
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          priority: MessagePriority.HIGH,
          messageId: expect.any(String),
          timestamp: expect.any(Number),
          headers: expect.objectContaining({
            "x-correlation-id": expect.any(String),
            "x-event-type": EventType.PLAYER_KILL,
            "x-server-id": 1,
            "x-routing-key": "player.kill",
          }),
        }),
      )

      expect(mockLogger.queue).toHaveBeenCalledWith(
        "Event published: PLAYER_KILL (Server ID: 1)",
        expect.objectContaining({
          messageId: expect.any(String),
          eventType: EventType.PLAYER_KILL,
          routingKey: "player.kill",
          priority: MessagePriority.HIGH,
          serverId: 1,
        }),
      )

      const stats = publisher.getStats()
      expect(stats.published).toBe(1)
      expect(stats.failed).toBe(0)
    })

    it("should reuse existing channel", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await publisher.publish(event)
      await publisher.publish(event)

      expect(mockClient.createChannel).toHaveBeenCalledTimes(1)
    })

    it("should handle channel buffer full", async () => {
      vi.mocked(mockChannel.publish).mockReturnValue(false)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(publisher.publish(event)).rejects.toThrow(
        new QueuePublishError("Channel buffer full - message not published"),
      )

      const stats = publisher.getStats()
      expect(stats.published).toBe(0)
      expect(stats.failed).toBe(1)
    })

    it("should handle publish errors", async () => {
      const error = new Error("Connection lost")
      vi.mocked(mockChannel.publish).mockImplementation(() => {
        throw error
      })

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(publisher.publish(event)).rejects.toThrow(QueuePublishError)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to publish event PLAYER_KILL"),
      )

      const stats = publisher.getStats()
      expect(stats.failed).toBe(1)
    })

    it("should preserve existing correlation ID", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        correlationId: "existing-correlation-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await publisher.publish(event)

      const publishCall = vi.mocked(mockChannel.publish).mock.calls[0]
      const messageBuffer = publishCall?.[2] as Buffer
      const message = JSON.parse(messageBuffer.toString()) as EventMessage

      expect(message.correlationId).toBe("existing-correlation-123")
    })

    it("should include server address and port when available", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        serverAddress: "192.168.1.100",
        serverPort: 27015,
        timestamp: new Date(),
        data: {},
      }

      await publisher.publish(event)

      const publishCall = vi.mocked(mockChannel.publish).mock.calls[0]
      const messageBuffer = publishCall?.[2] as Buffer
      const message = JSON.parse(messageBuffer.toString()) as EventMessage

      expect(message.metadata.source).toEqual({
        serverId: 1,
        serverAddress: "192.168.1.100",
        serverPort: 27015,
      })
    })
  })

  describe("Batch Publishing", () => {
    it("should publish empty batch successfully", async () => {
      await publisher.publishBatch([])

      expect(mockChannel.publish).not.toHaveBeenCalled()
      expect(mockLogger.queue).not.toHaveBeenCalled()
    })

    it("should publish small batch successfully", async () => {
      const events: BaseEvent[] = [
        {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: { killerId: 1, victimId: 2 },
        },
        {
          eventType: EventType.PLAYER_CONNECT,
          serverId: 1,
          timestamp: new Date(),
          data: { playerId: 3 },
        },
      ]

      await publisher.publishBatch(events)

      expect(mockChannel.publish).toHaveBeenCalledTimes(2)
      expect(mockLogger.queue).toHaveBeenCalledWith(
        "Publishing batch of 2 events",
        expect.objectContaining({ batchId: expect.any(String) }),
      )
      expect(mockLogger.queue).toHaveBeenCalledWith(
        "Batch published: 2 events",
        expect.objectContaining({ batchId: expect.any(String), eventCount: 2 }),
      )

      const stats = publisher.getStats()
      expect(stats.published).toBe(2)
    })

    it("should handle large batch with chunking", async () => {
      const events: BaseEvent[] = Array.from({ length: 150 }, (_, i) => ({
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: { killerId: i, victimId: i + 1 },
      }))

      await publisher.publishBatch(events)

      expect(mockChannel.publish).toHaveBeenCalledTimes(150)
      expect(mockLogger.queue).toHaveBeenCalledWith(
        "Publishing batch of 150 events",
        expect.any(Object),
      )

      const stats = publisher.getStats()
      expect(stats.published).toBe(150)
    })

    it("should handle batch publish errors", async () => {
      const error = new Error("Batch publish failed")
      vi.mocked(mockChannel.publish).mockImplementation(() => {
        throw error
      })

      const events: BaseEvent[] = [
        {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {},
        },
      ]

      await expect(publisher.publishBatch(events)).rejects.toThrow(QueuePublishError)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Batch publish failed at chunk 1"),
      )
    })
  })

  describe("Custom Mappers", () => {
    it("should use custom routing key mapper", async () => {
      const customRoutingMapper: RoutingKeyMapper = (event) =>
        `custom.${event.eventType.toLowerCase()}`
      const customPublisher = new EventPublisher(mockClient, mockLogger, customRoutingMapper)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await customPublisher.publish(event)

      expect(mockChannel.publish).toHaveBeenCalledWith(
        "hlstats.events",
        "custom.player_kill",
        expect.any(Buffer),
        expect.any(Object),
      )
    })

    it("should use custom priority mapper", async () => {
      const customPriorityMapper: PriorityMapper = () => MessagePriority.LOW
      const customPublisher = new EventPublisher(
        mockClient,
        mockLogger,
        defaultRoutingKeyMapper,
        customPriorityMapper,
      )

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await customPublisher.publish(event)

      const publishCall = vi.mocked(mockChannel.publish).mock.calls[0]
      const options = publishCall?.[3]
      expect(options?.priority).toBe(MessagePriority.LOW)
    })
  })

  describe("Statistics", () => {
    it("should track publish statistics", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      expect(publisher.getStats()).toEqual({ published: 0, failed: 0 })

      await publisher.publish(event)
      expect(publisher.getStats()).toEqual({ published: 1, failed: 0 })

      await publisher.publish(event)
      expect(publisher.getStats()).toEqual({ published: 2, failed: 0 })
    })

    it("should track failure statistics", async () => {
      vi.mocked(mockChannel.publish).mockReturnValue(false)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      try {
        await publisher.publish(event)
      } catch {
        // Expected to fail
      }

      expect(publisher.getStats()).toEqual({ published: 0, failed: 1 })
    })
  })

  describe("Message Creation", () => {
    it("should create well-formed message", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        serverAddress: "127.0.0.1",
        serverPort: 27015,
        timestamp: new Date(),
        data: { killerId: 123, victimId: 456 },
      }

      await publisher.publish(event)

      const publishCall = vi.mocked(mockChannel.publish).mock.calls[0]
      const messageBuffer = publishCall?.[2] as Buffer
      const message = JSON.parse(messageBuffer.toString()) as EventMessage

      expect(message).toMatchObject({
        id: expect.any(String),
        version: "1.0",
        timestamp: expect.any(String),
        correlationId: expect.any(String),
        payload: {
          ...event,
          timestamp: expect.any(String),
        },
        metadata: {
          source: {
            serverId: 1,
            serverAddress: "127.0.0.1",
            serverPort: 27015,
          },
          routing: {
            key: "player.kill",
            priority: MessagePriority.HIGH,
            retryCount: 0,
          },
          hints: {
            requiresAck: true,
            skipValidation: false,
          },
        },
      })
    })

    it("should handle missing server address and port", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await publisher.publish(event)

      const publishCall = vi.mocked(mockChannel.publish).mock.calls[0]
      const messageBuffer = publishCall?.[2] as Buffer
      const message = JSON.parse(messageBuffer.toString()) as EventMessage

      expect(message.metadata.source).toEqual({
        serverId: 1,
        serverAddress: "unknown",
        serverPort: 0,
      })
    })
  })
})

describe("Default Routing Key Mapper", () => {
  it("should map player events correctly", () => {
    expect(defaultRoutingKeyMapper({ eventType: EventType.PLAYER_KILL } as BaseEvent)).toBe(
      "player.kill",
    )
    expect(defaultRoutingKeyMapper({ eventType: EventType.PLAYER_CONNECT } as BaseEvent)).toBe(
      "player.connect",
    )
    expect(defaultRoutingKeyMapper({ eventType: EventType.PLAYER_CHANGE_TEAM } as BaseEvent)).toBe(
      "player.change.team",
    )
  })

  it("should map action events correctly", () => {
    expect(defaultRoutingKeyMapper({ eventType: EventType.ACTION_PLAYER } as BaseEvent)).toBe(
      "action.player",
    )
    expect(defaultRoutingKeyMapper({ eventType: EventType.ACTION_TEAM } as BaseEvent)).toBe(
      "action.team",
    )
  })

  it("should map match events correctly", () => {
    expect(defaultRoutingKeyMapper({ eventType: EventType.ROUND_START } as BaseEvent)).toBe(
      "round.start",
    )
    expect(defaultRoutingKeyMapper({ eventType: EventType.TEAM_WIN } as BaseEvent)).toBe("team.win")
  })

  // Objective events removed; objective flows are handled via ACTION_* events

  it("should map weapon events correctly", () => {
    expect(defaultRoutingKeyMapper({ eventType: EventType.WEAPON_FIRE } as BaseEvent)).toBe(
      "weapon.fire",
    )
    expect(defaultRoutingKeyMapper({ eventType: EventType.WEAPON_HIT } as BaseEvent)).toBe(
      "weapon.hit",
    )
  })

  it("should return unknown for unmapped events", () => {
    expect(defaultRoutingKeyMapper({ eventType: "UNKNOWN_EVENT" as EventType } as BaseEvent)).toBe(
      "unknown",
    )
  })
})

describe("Default Priority Mapper", () => {
  it("should assign high priority to critical events", () => {
    const highPriorityEvents = [
      EventType.PLAYER_KILL,
      EventType.PLAYER_SUICIDE,
      EventType.PLAYER_TEAMKILL,
      // Actions are critical for ranking adjustments
      EventType.ACTION_PLAYER,
      EventType.ACTION_PLAYER_PLAYER,
      EventType.ACTION_TEAM,
      EventType.ACTION_WORLD,
      EventType.SERVER_SHUTDOWN,
    ]

    highPriorityEvents.forEach((eventType) => {
      expect(defaultPriorityMapper({ eventType } as BaseEvent)).toBe(MessagePriority.HIGH)
    })
  })

  it("should assign low priority to non-critical events", () => {
    const lowPriorityEvents = [
      EventType.WEAPON_FIRE,
      EventType.WEAPON_HIT,
      EventType.SERVER_STATS_UPDATE,
      EventType.CHAT_MESSAGE,
    ]

    lowPriorityEvents.forEach((eventType) => {
      expect(defaultPriorityMapper({ eventType } as BaseEvent)).toBe(MessagePriority.LOW)
    })
  })

  it("should assign normal priority to standard events", () => {
    const normalPriorityEvents = [
      EventType.PLAYER_CONNECT,
      EventType.PLAYER_DISCONNECT,
      EventType.PLAYER_CHANGE_TEAM,
      // Rounds and objectives are normal priority
      EventType.ROUND_START,
      EventType.ROUND_END,
    ]

    normalPriorityEvents.forEach((eventType) => {
      expect(defaultPriorityMapper({ eventType } as BaseEvent)).toBe(MessagePriority.NORMAL)
    })
  })
})
