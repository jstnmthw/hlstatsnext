/**
 * RabbitMQ Client Tests
 *
 * Comprehensive tests covering connection management, channel management,
 * topology setup, retry logic, event handlers, and error handling branches.
 */

import type {
  QueueChannel,
  QueueConnection,
  RabbitMQConfig,
} from "@/shared/infrastructure/messaging/queue/core/types"
import { QueueConnectionError } from "@/shared/infrastructure/messaging/queue/core/types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RabbitMQClient } from "./client"

// Mock amqplib
const mockAmqpConnect = vi.fn()
vi.mock("amqplib", () => ({
  connect: (...args: unknown[]) => mockAmqpConnect(...args),
}))

// Mock the adapters module - we return the mock connection directly
const mockAmqpConnectionAdapter = vi.fn()
vi.mock("./adapters", () => ({
  AmqpConnectionAdapter: (...args: unknown[]) => mockAmqpConnectionAdapter(...args),
}))

function createMockChannel(): QueueChannel {
  return {
    publish: vi.fn().mockReturnValue(true),
    consume: vi.fn().mockResolvedValue("consumer-tag-123"),
    cancel: vi.fn().mockResolvedValue(undefined),
    ack: vi.fn(),
    nack: vi.fn(),
    prefetch: vi.fn().mockResolvedValue(undefined),
    assertExchange: vi.fn().mockResolvedValue(undefined),
    assertQueue: vi.fn().mockResolvedValue(undefined),
    bindQueue: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueueChannel
}

function createMockConnection(channel: QueueChannel) {
  const eventHandlers: Record<string, (...args: unknown[]) => void> = {}
  const conn: QueueConnection & { _handlers: typeof eventHandlers } = {
    createChannel: vi.fn().mockResolvedValue(channel),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      eventHandlers[event] = listener
    }),
    _handlers: eventHandlers,
  }
  return conn
}

function createDefaultConfig(): RabbitMQConfig {
  return {
    url: "amqp://localhost:5672",
    heartbeatInterval: 60,
    prefetchCount: 10,
    connectionRetry: {
      maxAttempts: 3,
      initialDelay: 1, // 1ms for fast tests
      maxDelay: 5, // 5ms max for fast tests
    },
    queues: {
      priority: {
        name: "test.priority",
        bindings: [],
        options: { durable: true, autoDelete: false },
      },
      standard: {
        name: "test.standard",
        bindings: [],
        options: { durable: true, autoDelete: false },
      },
      bulk: {
        name: "test.bulk",
        bindings: [],
        options: { durable: true, autoDelete: false },
      },
    },
  }
}

describe("RabbitMQClient", () => {
  let client: RabbitMQClient
  let config: RabbitMQConfig
  let logger: ReturnType<typeof createMockLogger>
  let mockChannel: QueueChannel
  let mockConnection: ReturnType<typeof createMockConnection>

  beforeEach(() => {
    vi.clearAllMocks()

    logger = createMockLogger()
    config = createDefaultConfig()
    mockChannel = createMockChannel()
    mockConnection = createMockConnection(mockChannel)

    // Default: amqp.connect resolves with a raw amqp connection
    const mockRawAmqpConnection = {
      createChannel: vi.fn().mockResolvedValue({}),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    }
    mockAmqpConnect.mockResolvedValue(mockRawAmqpConnection)

    // AmqpConnectionAdapter wraps raw connection -> returns our mockConnection
    mockAmqpConnectionAdapter.mockReturnValue(mockConnection)

    client = new RabbitMQClient(config, logger)
  })

  describe("connect", () => {
    it("should throw QueueError if already connecting", async () => {
      // Make amqp.connect hang so isConnecting stays true
      mockAmqpConnect.mockReturnValue(new Promise(() => {}))

      const p = client.connect()
      await expect(client.connect()).rejects.toThrow("Connection already in progress")
      // Clean up - prevent unhandled rejection
      p.catch(() => {})
    })

    it("should throw QueueConnectionError after exhausting retry attempts", async () => {
      mockAmqpConnect.mockRejectedValue(new Error("Connection refused"))

      await expect(client.connect()).rejects.toThrow(QueueConnectionError)
    })

    it("should wrap topology setup failure as QueueConnectionError", async () => {
      vi.mocked(mockConnection.createChannel).mockRejectedValueOnce(
        new Error("Channel create failed"),
      )

      await expect(client.connect()).rejects.toThrow(QueueConnectionError)
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to establish RabbitMQ connection"),
      )
    })

    it("should reset isConnecting flag on error", async () => {
      mockAmqpConnect.mockRejectedValue(new Error("fail"))

      await client.connect().catch(() => {})

      // Now a second attempt should not get "Connection already in progress"
      await expect(client.connect()).rejects.toThrow(QueueConnectionError)
    })

    it("should log retry delay messages", async () => {
      mockAmqpConnect.mockRejectedValue(new Error("fail"))

      await client.connect().catch(() => {})

      // Should have logged retry delay messages for attempts 1 and 2 (not for last attempt)
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("Retrying connection in"))
    })
  })

  describe("createChannel", () => {
    it("should throw when not connected", async () => {
      await expect(client.createChannel("test")).rejects.toThrow("No active connection")
    })
  })

  describe("isConnected", () => {
    it("should return false initially", () => {
      expect(client.isConnected()).toBe(false)
    })
  })

  describe("getConnectionStats", () => {
    it("should return initial stats", () => {
      const stats = client.getConnectionStats()
      expect(stats).toEqual({
        connected: false,
        heartbeatsSent: 0,
        heartbeatsMissed: 0,
        channelsCount: 0,
        uptime: 0,
      })
    })

    it("should report 0 uptime when connectionStartTime is null", () => {
      expect(client.getConnectionStats().uptime).toBe(0)
    })
  })

  describe("exponential backoff", () => {
    it("should cap delay at maxDelay", async () => {
      const cfg = createDefaultConfig()
      ;(cfg.connectionRetry as { maxAttempts: number }).maxAttempts = 5
      ;(cfg.connectionRetry as { initialDelay: number }).initialDelay = 2
      ;(cfg.connectionRetry as { maxDelay: number }).maxDelay = 5

      const localClient = new RabbitMQClient(cfg, logger)

      mockAmqpConnect.mockRejectedValue(new Error("fail"))

      await localClient.connect().catch(() => {})

      // With initialDelay=2, delays would be: 2, 4, 8(capped to 5), 16(capped to 5)
      expect(logger.debug).toHaveBeenCalledWith("Retrying connection in 5ms")
    })
  })
})
