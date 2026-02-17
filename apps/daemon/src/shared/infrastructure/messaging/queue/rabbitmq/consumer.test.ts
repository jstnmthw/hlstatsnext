/**
 * RabbitMQ Consumer Tests
 *
 * Tests the RabbitMQConsumer wrapper which orchestrates EventConsumer
 * and RabbitMQEventProcessor. Uses real internal classes with mocked
 * IQueueClient to avoid vi.mock() issues with isolate: false.
 */

import type { EventCoordinator } from "@/shared/application/event-coordinator"
import type {
  IQueueClient,
  MessageValidator,
  QueueChannel,
} from "@/shared/infrastructure/messaging/queue/core/types"
import type { ModuleRegistry } from "@/shared/infrastructure/modules/registry"
import type { ILogger } from "@/shared/utils/logger.types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RabbitMQConsumer, defaultRabbitMQConsumerConfig } from "./consumer"

describe("RabbitMQConsumer", () => {
  let consumer: RabbitMQConsumer
  let mockClient: IQueueClient
  let mockLogger: ILogger
  let mockModuleRegistry: ModuleRegistry
  let mockCoordinators: EventCoordinator[]
  let mockChannel: QueueChannel
  let mockMessageValidator: MessageValidator

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockChannel = {
      consume: vi
        .fn()
        .mockImplementation((queueName: string) => Promise.resolve(`${queueName}-test-tag`)),
      ack: vi.fn(),
      nack: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockReturnValue(true),
      prefetch: vi.fn().mockResolvedValue(undefined),
      assertExchange: vi.fn().mockResolvedValue(undefined),
      assertQueue: vi.fn().mockResolvedValue(undefined),
      bindQueue: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueueChannel

    mockClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      createChannel: vi.fn().mockResolvedValue(mockChannel),
      isConnected: vi.fn().mockReturnValue(true),
    } as unknown as IQueueClient

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      queue: vi.fn(),
    } as unknown as ILogger

    mockModuleRegistry = {
      getHandlersForEvent: vi.fn().mockReturnValue([]),
      registerHandler: vi.fn(),
      getAllHandlers: vi.fn().mockReturnValue([]),
    } as unknown as ModuleRegistry

    mockCoordinators = []

    mockMessageValidator = vi.fn().mockResolvedValue(undefined)

    consumer = new RabbitMQConsumer(
      mockClient,
      mockLogger,
      mockModuleRegistry,
      mockCoordinators,
      defaultRabbitMQConsumerConfig,
      mockMessageValidator,
    )
  })

  afterEach(async () => {
    // Ensure consumer is stopped to clean up timers
    try {
      await consumer.stop()
    } catch {
      // Ignore errors during cleanup
    }
    vi.useRealTimers()
  })

  describe("Lifecycle Management", () => {
    it("should start consuming from all configured queues", async () => {
      await consumer.start()

      // Should create a channel for each queue
      expect(mockClient.createChannel).toHaveBeenCalledTimes(
        defaultRabbitMQConsumerConfig.queues.length,
      )

      // Should set up consumers on each channel
      expect(mockChannel.consume).toHaveBeenCalledTimes(defaultRabbitMQConsumerConfig.queues.length)
    })

    it("should log start and success messages", async () => {
      await consumer.start()

      expect(mockLogger.queue).toHaveBeenCalledWith("Starting RabbitMQ consumer", {
        queues: defaultRabbitMQConsumerConfig.queues,
        concurrency: defaultRabbitMQConsumerConfig.concurrency,
        coordinators: 0,
      })
      expect(mockLogger.queue).toHaveBeenCalledWith("RabbitMQ consumer started successfully")
    })

    it("should stop after starting", async () => {
      await consumer.start()
      await consumer.stop()

      expect(mockLogger.queue).toHaveBeenCalledWith("Stopping RabbitMQ consumer")
      expect(mockChannel.cancel).toHaveBeenCalled()
      expect(mockLogger.queue).toHaveBeenCalledWith("RabbitMQ consumer stopped successfully")
    })

    it("should handle stop when not started", async () => {
      // stop() without start() — EventConsumer.stop() returns early if not consuming
      await consumer.stop()

      expect(mockLogger.queue).toHaveBeenCalledWith("Stopping RabbitMQ consumer")
      expect(mockChannel.cancel).not.toHaveBeenCalled()
      expect(mockLogger.queue).toHaveBeenCalledWith("RabbitMQ consumer stopped successfully")
    })

    it("should propagate channel creation errors", async () => {
      vi.mocked(mockClient.createChannel).mockRejectedValue(new Error("Connection lost"))

      await expect(consumer.start()).rejects.toThrow()
    })
  })

  describe("Pause and Resume", () => {
    it("should pause consumer", async () => {
      await consumer.pause()

      // EventConsumer.pause() sets isPaused flag
      expect(mockLogger.info).toHaveBeenCalledWith("Event consumer paused")
    })

    it("should resume consumer", async () => {
      await consumer.resume()

      // EventConsumer.resume() clears isPaused flag
      expect(mockLogger.info).toHaveBeenCalledWith("Event consumer resumed")
    })
  })

  describe("Statistics", () => {
    it("should return initial stats when not started", () => {
      const stats = consumer.getConsumerStats()

      expect(stats).toEqual({
        isConsuming: false,
        messagesProcessed: 0,
        messagesAcked: 0,
        messagesNacked: 0,
        messagesRejected: 0,
        averageProcessingTime: 0,
        queueDepth: 0,
      })
    })

    it("should reflect consuming state after start", async () => {
      await consumer.start()
      const stats = consumer.getConsumerStats()

      expect(stats.isConsuming).toBe(true)
    })

    it("should reflect not consuming after stop", async () => {
      await consumer.start()
      await consumer.stop()
      const stats = consumer.getConsumerStats()

      expect(stats.isConsuming).toBe(false)
    })
  })

  describe("Configuration", () => {
    it("should use custom queue configuration", async () => {
      const customConfig = {
        ...defaultRabbitMQConsumerConfig,
        queues: ["custom.queue.1", "custom.queue.2"],
        concurrency: 20,
      }

      const customConsumer = new RabbitMQConsumer(
        mockClient,
        mockLogger,
        mockModuleRegistry,
        mockCoordinators,
        customConfig,
        mockMessageValidator,
      )

      await customConsumer.start()

      expect(mockClient.createChannel).toHaveBeenCalledTimes(2)
      expect(mockLogger.queue).toHaveBeenCalledWith("Starting RabbitMQ consumer", {
        queues: ["custom.queue.1", "custom.queue.2"],
        concurrency: 20,
        coordinators: 0,
      })

      await customConsumer.stop()
    })

    it("should log coordinator count in metadata", async () => {
      const coord = { coordinateEvent: vi.fn() } as unknown as EventCoordinator
      const consumerWithCoords = new RabbitMQConsumer(
        mockClient,
        mockLogger,
        mockModuleRegistry,
        [coord],
        defaultRabbitMQConsumerConfig,
        mockMessageValidator,
      )

      await consumerWithCoords.start()

      expect(mockLogger.queue).toHaveBeenCalledWith("Starting RabbitMQ consumer", {
        queues: defaultRabbitMQConsumerConfig.queues,
        concurrency: defaultRabbitMQConsumerConfig.concurrency,
        coordinators: 1,
      })

      await consumerWithCoords.stop()
    })
  })

  describe("Integration", () => {
    it("should support multiple coordinators", async () => {
      const coord1 = { coordinateEvent: vi.fn() } as unknown as EventCoordinator
      const coord2 = { coordinateEvent: vi.fn() } as unknown as EventCoordinator

      const multiCoordConsumer = new RabbitMQConsumer(
        mockClient,
        mockLogger,
        mockModuleRegistry,
        [coord1, coord2],
        defaultRabbitMQConsumerConfig,
        mockMessageValidator,
      )

      await multiCoordConsumer.start()

      const stats = multiCoordConsumer.getConsumerStats()
      expect(stats.isConsuming).toBe(true)

      await multiCoordConsumer.stop()
    })

    it("should work without coordinators", async () => {
      const noCoordConsumer = new RabbitMQConsumer(
        mockClient,
        mockLogger,
        mockModuleRegistry,
        [],
        defaultRabbitMQConsumerConfig,
        mockMessageValidator,
      )

      await noCoordConsumer.start()

      expect(mockLogger.queue).toHaveBeenCalledWith("Starting RabbitMQ consumer", {
        queues: defaultRabbitMQConsumerConfig.queues,
        concurrency: defaultRabbitMQConsumerConfig.concurrency,
        coordinators: 0,
      })

      await noCoordConsumer.stop()
    })
  })
})

describe("defaultRabbitMQConsumerConfig", () => {
  it("should match the default consumer config", () => {
    expect(defaultRabbitMQConsumerConfig).toEqual({
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      concurrency: 10,
      queues: ["hlstats.events.priority", "hlstats.events.standard", "hlstats.events.bulk"],
      logMetrics: true,
      metricsInterval: 30000,
    })
  })
})
