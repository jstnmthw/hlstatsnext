/**
 * Queue Module Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  QueueModule,
  createQueueModule,
  createDevelopmentRabbitMQConfig,
  type QueueModuleConfig,
} from "./module"
import type { ILogger } from "@/shared/utils/logger.types"
import type {
  IQueueClient,
  IEventPublisher,
  IEventConsumer,
  RabbitMQConfig,
} from "./queue/core/types"
import type { IEventProcessor } from "./queue/core/consumer"

// Mock the imported modules
vi.mock("./queue/rabbitmq/client", () => ({
  RabbitMQClient: vi.fn(),
}))
vi.mock("./queue/core/publisher", () => ({
  EventPublisher: vi.fn(),
}))
vi.mock("./queue/core/consumer", () => ({
  EventConsumer: vi.fn(),
}))

describe.skip("QueueModule", () => {
  let queueModule: QueueModule
  let logger: ILogger
  let config: QueueModuleConfig
  let mockClient: IQueueClient
  let mockPublisher: IEventPublisher
  let mockConsumer: IEventConsumer
  let mockEventProcessor: IEventProcessor

  beforeEach(async () => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      queue: vi.fn(),
    } as unknown as ILogger

    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      getConnectionStats: vi.fn().mockReturnValue({ connected: true, messages: 0 }),
    } as unknown as IQueueClient

    mockPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as IEventPublisher

    mockConsumer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getConsumerStats: vi.fn().mockReturnValue({ processed: 0, errors: 0 }),
    } as unknown as IEventConsumer

    mockEventProcessor = {
      processEvent: vi.fn().mockResolvedValue(undefined),
    }

    config = {
      rabbitmq: {
        url: "amqp://test",
        prefetchCount: 10,
        heartbeatInterval: 60,
        connectionRetry: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 5000,
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
      },
      autoStartConsumers: false,
      autoSetupTopology: true,
    }

    // Set up constructor mocks
    const { RabbitMQClient } = await import("./queue/rabbitmq/client.js")
    const { EventPublisher } = await import("./queue/core/publisher.js")
    const { EventConsumer } = await import("./queue/core/consumer.js")

    vi.mocked(RabbitMQClient).mockImplementation(
      () => mockClient as unknown as typeof RabbitMQClient.prototype,
    )
    vi.mocked(EventPublisher).mockImplementation(
      () => mockPublisher as unknown as typeof EventPublisher.prototype,
    )
    vi.mocked(EventConsumer).mockImplementation(
      () => mockConsumer as unknown as typeof EventConsumer.prototype,
    )

    queueModule = new QueueModule(config, logger)
  })

  describe.skip("Initialization", () => {
    it("should initialize successfully without event processor", async () => {
      const dependencies = await queueModule.initialize()

      expect(mockClient.connect).toHaveBeenCalledTimes(1)
      expect(dependencies.client).toBe(mockClient)
      expect(dependencies.publisher).toBe(mockPublisher)
      expect(dependencies.consumer).toBeNull()
      expect(logger.info).toHaveBeenCalledWith("Queue module initialized successfully")
    })

    it("should initialize successfully with event processor", async () => {
      const dependencies = await queueModule.initialize(mockEventProcessor)

      expect(mockClient.connect).toHaveBeenCalledTimes(1)
      expect(dependencies.client).toBe(mockClient)
      expect(dependencies.publisher).toBe(mockPublisher)
      expect(dependencies.consumer).toBe(mockConsumer)
      expect(logger.info).toHaveBeenCalledWith("Queue module initialized successfully")
    })

    it("should auto-start consumer when configured", async () => {
      const autoStartConfig = { ...config, autoStartConsumers: true }
      const autoStartModule = new QueueModule(autoStartConfig, logger)

      await autoStartModule.initialize(mockEventProcessor)

      expect(mockConsumer.start).toHaveBeenCalledTimes(1)
    })

    // Shadow consumer removed

    it("should handle initialization errors", async () => {
      const error = new Error("Connection failed")
      vi.mocked(mockClient.connect).mockRejectedValueOnce(error)

      await expect(queueModule.initialize()).rejects.toThrow("Connection failed")
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to initialize queue module: Error: Connection failed",
      )
    })
  })

  describe("Service Getters", () => {
    beforeEach(async () => {
      await queueModule.initialize(mockEventProcessor)
    })

    it("should return client when initialized", () => {
      const client = queueModule.getClient()
      expect(client).toBe(mockClient)
    })

    it("should return publisher when initialized", () => {
      const publisher = queueModule.getPublisher()
      expect(publisher).toBe(mockPublisher)
    })

    it("should return consumer when initialized", () => {
      const consumer = queueModule.getConsumer()
      expect(consumer).toBe(mockConsumer)
    })

    // Shadow consumer removed

    it("should throw error when getting client before initialization", () => {
      const uninitializedModule = new QueueModule(config, logger)
      expect(() => uninitializedModule.getClient()).toThrow(
        "Queue module not initialized - client not available",
      )
    })

    it("should throw error when getting publisher before initialization", () => {
      const uninitializedModule = new QueueModule(config, logger)
      expect(() => uninitializedModule.getPublisher()).toThrow(
        "Queue module not initialized - publisher not available",
      )
    })

    it("should throw error when getting consumer before initialization", () => {
      const uninitializedModule = new QueueModule(config, logger)
      expect(() => uninitializedModule.getConsumer()).toThrow(
        "Queue module not initialized - consumer not available",
      )
    })

    // Shadow consumer removed
  })

  // Shadow consumer removed

  describe("Status and Monitoring", () => {
    it("should return correct status when uninitialized", () => {
      const status = queueModule.getStatus()

      expect(status.initialized).toBe(false)
      expect(status.connected).toBe(false)
      // Shadow consumer removed
    })

    it("should return correct status when initialized", async () => {
      await queueModule.initialize(mockEventProcessor)
      const status = queueModule.getStatus()

      expect(status.initialized).toBe(true)
      expect(status.connected).toBe(true)
      // Shadow consumer removed
      expect(status.connectionStats).toEqual({ connected: true, messages: 0 })
      expect(status.consumerStats).toEqual({ processed: 0, errors: 0 })
      // Shadow consumer removed
    })

    it("should report not initialized correctly", () => {
      expect(queueModule.isInitialized()).toBe(false)
    })

    it("should report initialized correctly", async () => {
      await queueModule.initialize()
      expect(queueModule.isInitialized()).toBe(true)
    })
  })

  describe("Shutdown", () => {
    beforeEach(async () => {
      await queueModule.initialize(mockEventProcessor)
    })

    it("should shutdown gracefully", async () => {
      await queueModule.shutdown()

      // Shadow consumer removed
      expect(mockConsumer.stop).toHaveBeenCalledTimes(1)
      expect(mockClient.disconnect).toHaveBeenCalledTimes(1)
      expect(logger.info).toHaveBeenCalledWith("Shutting down queue module...")
      expect(logger.info).toHaveBeenCalledWith("Queue module shutdown complete")
    })

    it("should handle shutdown errors", async () => {
      const error = new Error("Shutdown failed")
      vi.mocked(mockClient.disconnect).mockRejectedValueOnce(error)

      await expect(queueModule.shutdown()).rejects.toThrow("Shutdown failed")
      expect(logger.error).toHaveBeenCalledWith(
        "Error during queue module shutdown: Error: Shutdown failed",
      )
    })

    it("should shutdown gracefully when some services are null", async () => {
      const partialModule = new QueueModule(config, logger)

      await expect(partialModule.shutdown()).resolves.toBeUndefined()
      expect(logger.info).toHaveBeenCalledWith("Queue module shutdown complete")
    })
  })

  // Shadow consumer removed
})

describe("Factory Functions", () => {
  let logger: ILogger

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      queue: vi.fn(),
    } as unknown as ILogger
  })

  describe("createQueueModule", () => {
    it("should create queue module with default config", () => {
      const rabbitmqConfig: RabbitMQConfig = {
        url: "amqp://test",
        prefetchCount: 10,
        heartbeatInterval: 60,
        connectionRetry: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 5000,
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

      const module = createQueueModule(rabbitmqConfig, logger)
      expect(module).toBeInstanceOf(QueueModule)
    })

    it("should create queue module with overrides", () => {
      const rabbitmqConfig: RabbitMQConfig = {
        url: "amqp://test",
        prefetchCount: 10,
        heartbeatInterval: 60,
        connectionRetry: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 5000,
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

      const overrides = {
        autoStartConsumers: true,
      }

      const module = createQueueModule(rabbitmqConfig, logger, overrides)
      expect(module).toBeInstanceOf(QueueModule)
    })
  })

  describe("createDevelopmentRabbitMQConfig", () => {
    it("should create development config with default URL", () => {
      const config = createDevelopmentRabbitMQConfig()

      expect(config.url).toBe("amqp://hlstats:hlstats@localhost:5672/hlstats")
      expect(config.prefetchCount).toBe(10)
      expect(config.heartbeatInterval).toBe(60)
      expect(config.connectionRetry).toEqual({
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 10000,
      })
    })

    it("should create development config with custom URL", () => {
      const customUrl = "amqp://custom:password@remote:5672/custom"
      const config = createDevelopmentRabbitMQConfig(customUrl)

      expect(config.url).toBe(customUrl)
    })

    it("should have correct queue configurations", () => {
      const config = createDevelopmentRabbitMQConfig()

      expect(config.queues.priority).toEqual({
        name: "hlstats.events.priority",
        bindings: [
          "player.kill",
          "player.suicide",
          "player.teamkill",
          "round.*",
          "bomb.*",
          "hostage.*",
          "flag.*",
          "control.*",
        ],
        options: {
          durable: true,
          autoDelete: false,
          messageTtl: 3600000,
          maxLength: 50000,
          deadLetterExchange: "hlstats.events.dlx",
        },
      })

      expect(config.queues.standard).toEqual({
        name: "hlstats.events.standard",
        bindings: [
          "player.connect",
          "player.disconnect",
          "player.entry",
          "player.change.*",
          "chat.*",
          "admin.*",
          "team.*",
          "map.*",
        ],
        options: {
          durable: true,
          autoDelete: false,
          messageTtl: 3600000,
          maxLength: 75000,
          deadLetterExchange: "hlstats.events.dlx",
        },
      })

      expect(config.queues.bulk).toEqual({
        name: "hlstats.events.bulk",
        bindings: ["weapon.*", "action.*", "stats.*"],
        options: {
          durable: true,
          autoDelete: false,
          messageTtl: 3600000,
          maxLength: 100000,
          deadLetterExchange: "hlstats.events.dlx",
        },
      })
    })
  })
})
