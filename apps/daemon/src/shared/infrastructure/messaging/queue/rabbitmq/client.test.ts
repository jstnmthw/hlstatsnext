/**
 * RabbitMQ Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { RabbitMQClient } from "./client"
import type {
  RabbitMQConfig,
  QueueChannel,
} from "@/shared/infrastructure/messaging/queue/core/types"
import {
  QueueConnectionError,
  QueueError,
} from "@/shared/infrastructure/messaging/queue/core/types"
import type { Connection } from "amqplib"
import type { ILogger } from "@/shared/utils/logger.types"

// Mock amqplib
const mockConnect = vi.fn()
vi.mock("amqplib", () => ({
  connect: mockConnect,
}))

// Mock the adapters module
const mockAmqpConnectionAdapter = vi.fn()
vi.mock("./adapters", () => ({
  AmqpConnectionAdapter: mockAmqpConnectionAdapter,
}))

describe.skip("RabbitMQClient", () => {
  let client: RabbitMQClient
  let config: RabbitMQConfig
  let mockLogger: ILogger
  let mockChannel: QueueChannel
  let mockConnection: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    vi.clearAllMocks()

    mockChannel = {
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

    mockConnection = {
      createChannel: vi.fn().mockResolvedValue(mockChannel),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    }

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    config = {
      url: "amqp://localhost:5672",
      heartbeatInterval: 60000,
      prefetchCount: 10,
      connectionRetry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 30000,
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
        bulk: { name: "test.bulk", bindings: [], options: { durable: true, autoDelete: false } },
      },
    }

    // Setup successful connection by default
    const mockAmqpConnection = {
      createChannel: vi.fn().mockResolvedValue({}),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    }

    mockConnect.mockResolvedValue(mockAmqpConnection)
    mockAmqpConnectionAdapter.mockReturnValue(mockConnection as unknown as Connection)

    client = new RabbitMQClient(config, mockLogger)
  })

  describe("Connection Management", () => {
    it("should connect successfully", async () => {
      await client.connect()

      expect(mockConnect).toHaveBeenCalledWith(config.url, {
        heartbeat: config.heartbeatInterval,
        connectionTimeout: 10000,
        frameMax: 131072,
      })
      expect(mockLogger.info).toHaveBeenCalledWith("RabbitMQ connection established successfully")
      expect(client.isConnected()).toBe(true)
    })

    it("should prevent concurrent connections", async () => {
      const connectPromise1 = client.connect()
      const connectPromise2 = client.connect()

      await expect(connectPromise1).resolves.toBeUndefined()
      await expect(connectPromise2).rejects.toThrow(
        new QueueError("Connection already in progress"),
      )
    })

    it("should prevent connecting when already connected", async () => {
      await client.connect()

      await expect(client.connect()).rejects.toThrow(new QueueError("Already connected"))
    })

    it("should handle connection failures with retries", async () => {
      const connectionError = new Error("Connection refused")
      mockConnect
        .mockRejectedValueOnce(connectionError)
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce({
          createChannel: vi.fn().mockResolvedValue({}),
          close: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
        })

      await client.connect()

      expect(mockConnect).toHaveBeenCalledTimes(3)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Connection attempt 1 failed: Error: Connection refused",
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Connection attempt 2 failed: Error: Connection refused",
      )
      expect(mockLogger.info).toHaveBeenCalledWith("RabbitMQ connection established successfully")
    })

    it("should fail after exhausting retry attempts", async () => {
      const connectionError = new Error("Connection refused")
      mockConnect.mockRejectedValue(connectionError)

      await expect(client.connect()).rejects.toThrow(QueueConnectionError)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to establish RabbitMQ connection"),
      )
      expect(mockConnect).toHaveBeenCalledTimes(3) // maxAttempts
    })

    it("should disconnect successfully", async () => {
      await client.connect()

      await client.disconnect()

      expect(mockConnection.close).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith("RabbitMQ connection closed")
      expect(client.isConnected()).toBe(false)
    })

    it("should handle disconnect when not connected", async () => {
      await expect(client.disconnect()).resolves.toBeUndefined()
    })
  })

  describe("Channel Management", () => {
    beforeEach(async () => {
      await client.connect()
    })

    it("should create new channel", async () => {
      await client.createChannel("test-channel")

      expect(mockConnection.createChannel).toHaveBeenCalledTimes(1)
      expect(mockLogger.debug).toHaveBeenCalledWith("Created channel: test-channel")
    })

    it("should reuse existing channel", async () => {
      const channel1 = await client.createChannel("test-channel")
      const channel2 = await client.createChannel("test-channel")

      expect(channel1).toBe(channel2)
    })

    it("should fail to create channel without connection", async () => {
      await client.disconnect()

      await expect(client.createChannel("test-channel")).rejects.toThrow(
        new QueueError("No active connection"),
      )
    })
  })

  describe("Connection Statistics", () => {
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

    it("should return connected stats", async () => {
      await client.connect()

      const stats = client.getConnectionStats()
      expect(stats.connected).toBe(true)
      expect(stats.uptime).toBeGreaterThan(0)
    })
  })

  describe("Topology Setup", () => {
    it("should setup exchanges and queues", async () => {
      await client.connect()

      // Verify exchanges were created
      expect(mockChannel.assertExchange).toHaveBeenCalledWith("hlstats.events", "topic", {
        durable: true,
        autoDelete: false,
      })
      expect(mockChannel.assertExchange).toHaveBeenCalledWith("hlstats.events.dlx", "topic", {
        durable: true,
        autoDelete: false,
      })

      // Verify queues were created
      expect(mockChannel.assertQueue).toHaveBeenCalledWith("hlstats.events.priority", {
        durable: true,
        autoDelete: false,
        arguments: {
          "x-dead-letter-exchange": "hlstats.events.dlx",
          "x-message-ttl": 3600000,
          "x-max-priority": 10,
        },
      })

      expect(mockLogger.info).toHaveBeenCalledWith("RabbitMQ topology setup completed")
    })

    it("should create queue bindings", async () => {
      await client.connect()

      // Verify some key bindings
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        "hlstats.events.priority",
        "hlstats.events",
        "player.kill",
      )
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        "hlstats.events.standard",
        "hlstats.events",
        "player.connect",
      )
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        "hlstats.events.bulk",
        "hlstats.events",
        "weapon.*",
      )
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        "hlstats.events.dlq",
        "hlstats.events.dlx",
        "#",
      )

      expect(mockLogger.debug).toHaveBeenCalledWith("Queue bindings created successfully")
    })
  })

  describe("Configuration", () => {
    it("should use custom configuration values", async () => {
      const customConfig: RabbitMQConfig = {
        url: "amqp://custom:5672",
        heartbeatInterval: 30000,
        prefetchCount: 20,
        connectionRetry: {
          maxAttempts: 5,
          initialDelay: 500,
          maxDelay: 60000,
        },
        queues: {
          priority: {
            name: "custom.priority",
            bindings: [],
            options: { durable: true, autoDelete: false },
          },
          standard: {
            name: "custom.standard",
            bindings: [],
            options: { durable: true, autoDelete: false },
          },
          bulk: {
            name: "custom.bulk",
            bindings: [],
            options: { durable: true, autoDelete: false },
          },
        },
      }

      const customClient = new RabbitMQClient(customConfig, mockLogger)
      await customClient.connect()

      expect(mockConnect).toHaveBeenCalledWith(customConfig.url, {
        heartbeat: customConfig.heartbeatInterval,
        connectionTimeout: 10000,
        frameMax: 131072,
      })
    })

    it("should use exponential backoff for retry delays", async () => {
      const connectionError = new Error("Connection refused")
      mockConnect.mockRejectedValue(connectionError)

      await expect(client.connect()).rejects.toThrow(QueueConnectionError)

      expect(mockLogger.debug).toHaveBeenCalledWith("Retrying connection in 1000ms")
      expect(mockLogger.debug).toHaveBeenCalledWith("Retrying connection in 2000ms")
    })
  })

  describe("Error Handling", () => {
    it("should handle topology setup failures", async () => {
      const topologyError = new Error("Exchange creation failed")
      vi.mocked(mockChannel.assertExchange).mockRejectedValueOnce(topologyError)

      await expect(client.connect()).rejects.toThrow(QueueConnectionError)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to establish RabbitMQ connection"),
      )
    })
  })
})
