/**
 * RabbitMQ Consumer Tests
 */

import type { EventCoordinator } from "@/shared/application/event-coordinator"
import { EventConsumer } from "@/shared/infrastructure/messaging/queue/core/consumer"
import type {
  IQueueClient,
  MessageValidator,
} from "@/shared/infrastructure/messaging/queue/core/types"
import type { ModuleRegistry } from "@/shared/infrastructure/modules/registry"
import type { ILogger } from "@/shared/utils/logger.types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RabbitMQConsumer, defaultRabbitMQConsumerConfig } from "./consumer"
import { RabbitMQEventProcessor } from "./event-processor"

// Mock the dependencies
vi.mock("./event-processor", () => ({
  RabbitMQEventProcessor: vi.fn(),
}))
vi.mock("@/shared/infrastructure/messaging/queue/core/consumer", () => ({
  EventConsumer: vi.fn(),
  defaultConsumerConfig: {
    maxRetries: 3,
    retryDelay: 1000,
    maxRetryDelay: 30000,
    concurrency: 10,
    queues: ["hlstats.events.priority", "hlstats.events.standard", "hlstats.events.bulk"],
  },
  defaultMessageValidator: vi.fn().mockResolvedValue(undefined),
}))

describe.skip("RabbitMQConsumer", () => {
  let consumer: RabbitMQConsumer
  let mockClient: IQueueClient
  let mockLogger: ILogger
  let mockModuleRegistry: ModuleRegistry
  let mockCoordinators: EventCoordinator[]
  let mockEventProcessor: RabbitMQEventProcessor
  let mockEventConsumer: EventConsumer
  let mockMessageValidator: MessageValidator

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()

    mockClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      createChannel: vi.fn(),
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

    const mockCoordinator: EventCoordinator = {
      coordinateEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as EventCoordinator

    mockCoordinators = [mockCoordinator]

    mockMessageValidator = vi.fn().mockResolvedValue(undefined)

    mockEventProcessor = {
      processEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as RabbitMQEventProcessor

    mockEventConsumer = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      getConsumerStats: vi.fn().mockReturnValue({
        isConsuming: false,
        messagesProcessed: 0,
        messagesAcked: 0,
        messagesNacked: 0,
        messagesRejected: 0,
        averageProcessingTime: 0,
        queueDepth: 0,
      }),
    } as unknown as EventConsumer

    // Setup mocks - these need to be set before creating the consumer
    vi.mocked(RabbitMQEventProcessor).mockImplementation(() => mockEventProcessor)
    vi.mocked(EventConsumer).mockImplementation(() => mockEventConsumer)
  })

  const createConsumer = (
    client = mockClient,
    logger = mockLogger,
    moduleRegistry = mockModuleRegistry,
    coordinators = mockCoordinators,
    config = defaultRabbitMQConsumerConfig,
    messageValidator = mockMessageValidator,
  ) => {
    return new RabbitMQConsumer(
      client,
      logger,
      moduleRegistry,
      coordinators,
      config,
      messageValidator,
    )
  }

  describe("Constructor", () => {
    it("should create RabbitMQEventProcessor with correct parameters", () => {
      createConsumer()

      expect(RabbitMQEventProcessor).toHaveBeenCalledWith(
        mockLogger,
        mockModuleRegistry,
        mockCoordinators,
      )
    })

    it("should create EventConsumer with correct parameters", () => {
      createConsumer()

      expect(EventConsumer).toHaveBeenCalledWith(
        mockClient,
        mockEventProcessor,
        mockLogger,
        defaultRabbitMQConsumerConfig,
        mockMessageValidator,
      )
    })

    it("should create consumer with empty coordinators by default", () => {
      createConsumer(mockClient, mockLogger, mockModuleRegistry, [])

      expect(RabbitMQEventProcessor).toHaveBeenCalledWith(mockLogger, mockModuleRegistry, [])
    })

    it("should create consumer with custom config", () => {
      const customConfig = {
        maxRetries: 5,
        retryDelay: 2000,
        maxRetryDelay: 60000,
        concurrency: 15,
        queues: ["custom.queue"],
      }

      new RabbitMQConsumer(
        mockClient,
        mockLogger,
        mockModuleRegistry,
        mockCoordinators,
        customConfig,
      )

      expect(EventConsumer).toHaveBeenCalledWith(
        mockClient,
        mockEventProcessor,
        mockLogger,
        customConfig,
        mockMessageValidator,
      )
    })
  })

  describe("Lifecycle Management", () => {
    it("should start consumer successfully", async () => {
      consumer = createConsumer()

      await consumer.start()

      expect(mockLogger.queue).toHaveBeenCalledWith("Starting RabbitMQ consumer", {
        queues: defaultRabbitMQConsumerConfig.queues,
        concurrency: defaultRabbitMQConsumerConfig.concurrency,
        coordinators: mockCoordinators.length,
      })
      expect(mockEventConsumer.start).toHaveBeenCalledTimes(1)
      expect(mockLogger.queue).toHaveBeenCalledWith("RabbitMQ consumer started successfully")
    })

    it("should stop consumer successfully", async () => {
      consumer = createConsumer()

      await consumer.stop()

      expect(mockLogger.queue).toHaveBeenCalledWith("Stopping RabbitMQ consumer")
      expect(mockEventConsumer.stop).toHaveBeenCalledTimes(1)
      expect(mockLogger.queue).toHaveBeenCalledWith("RabbitMQ consumer stopped successfully")
    })

    it("should handle start errors", async () => {
      const error = new Error("Start failed")
      vi.mocked(mockEventConsumer.start).mockRejectedValueOnce(error)

      await expect(consumer.start()).rejects.toThrow("Start failed")
      expect(mockLogger.queue).toHaveBeenCalledWith(
        "Starting RabbitMQ consumer",
        expect.any(Object),
      )
    })

    it("should handle stop errors", async () => {
      const error = new Error("Stop failed")
      vi.mocked(mockEventConsumer.stop).mockRejectedValueOnce(error)

      await expect(consumer.stop()).rejects.toThrow("Stop failed")
      expect(mockLogger.queue).toHaveBeenCalledWith("Stopping RabbitMQ consumer")
    })
  })

  describe("Pause and Resume", () => {
    it("should pause consumer", async () => {
      await consumer.pause()

      expect(mockEventConsumer.pause).toHaveBeenCalledTimes(1)
    })

    it("should resume consumer", async () => {
      await consumer.resume()

      expect(mockEventConsumer.resume).toHaveBeenCalledTimes(1)
    })

    it("should handle pause errors", async () => {
      const error = new Error("Pause failed")
      vi.mocked(mockEventConsumer.pause).mockRejectedValueOnce(error)

      await expect(consumer.pause()).rejects.toThrow("Pause failed")
    })

    it("should handle resume errors", async () => {
      const error = new Error("Resume failed")
      vi.mocked(mockEventConsumer.resume).mockRejectedValueOnce(error)

      await expect(consumer.resume()).rejects.toThrow("Resume failed")
    })
  })

  describe("Statistics", () => {
    it("should return consumer statistics", () => {
      const expectedStats = {
        isConsuming: true,
        messagesProcessed: 100,
        messagesAcked: 95,
        messagesNacked: 3,
        messagesRejected: 2,
        averageProcessingTime: 150,
        queueDepth: 10,
      }

      vi.mocked(mockEventConsumer.getConsumerStats).mockReturnValue(expectedStats)

      const stats = consumer.getConsumerStats()

      expect(stats).toEqual(expectedStats)
      expect(mockEventConsumer.getConsumerStats).toHaveBeenCalledTimes(1)
    })

    it("should return initial stats by default", () => {
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
  })

  describe("Configuration", () => {
    it("should use default configuration", () => {
      new RabbitMQConsumer(mockClient, mockLogger, mockModuleRegistry)

      expect(EventConsumer).toHaveBeenCalledWith(
        mockClient,
        mockEventProcessor,
        mockLogger,
        defaultRabbitMQConsumerConfig,
        expect.any(Function),
      )
    })

    it("should support custom message validator", () => {
      const customValidator = vi.fn().mockResolvedValue(undefined)
      new RabbitMQConsumer(
        mockClient,
        mockLogger,
        mockModuleRegistry,
        [],
        defaultRabbitMQConsumerConfig,
        customValidator,
      )

      expect(EventConsumer).toHaveBeenCalledWith(
        mockClient,
        mockEventProcessor,
        mockLogger,
        defaultRabbitMQConsumerConfig,
        customValidator,
      )
    })

    it("should start with logging metadata", async () => {
      const customConfig = {
        maxRetries: 3,
        retryDelay: 1000,
        maxRetryDelay: 30000,
        concurrency: 20,
        queues: ["test.queue.1", "test.queue.2"],
      }

      const customConsumer = new RabbitMQConsumer(
        mockClient,
        mockLogger,
        mockModuleRegistry,
        mockCoordinators,
        customConfig,
      )

      await customConsumer.start()

      expect(mockLogger.queue).toHaveBeenCalledWith("Starting RabbitMQ consumer", {
        queues: ["test.queue.1", "test.queue.2"],
        concurrency: 20,
        coordinators: 1,
      })
    })
  })

  describe("Integration", () => {
    it("should properly integrate event processor and consumer", async () => {
      // Start the consumer
      await consumer.start()

      // Verify the components are correctly wired
      expect(RabbitMQEventProcessor).toHaveBeenCalledWith(
        mockLogger,
        mockModuleRegistry,
        mockCoordinators,
      )
      expect(EventConsumer).toHaveBeenCalledWith(
        mockClient,
        mockEventProcessor,
        mockLogger,
        defaultRabbitMQConsumerConfig,
        mockMessageValidator,
      )
      expect(mockEventConsumer.start).toHaveBeenCalledTimes(1)
    })

    it("should support multiple coordinators", () => {
      const mockCoordinator1: EventCoordinator = {
        coordinateEvent: vi.fn().mockResolvedValue(undefined),
      } as unknown as EventCoordinator

      const mockCoordinator2: EventCoordinator = {
        coordinateEvent: vi.fn().mockResolvedValue(undefined),
      } as unknown as EventCoordinator

      new RabbitMQConsumer(mockClient, mockLogger, mockModuleRegistry, [
        mockCoordinator1,
        mockCoordinator2,
      ])

      expect(RabbitMQEventProcessor).toHaveBeenCalledWith(mockLogger, mockModuleRegistry, [
        mockCoordinator1,
        mockCoordinator2,
      ])
    })

    it("should work without coordinators", () => {
      new RabbitMQConsumer(mockClient, mockLogger, mockModuleRegistry, [])

      expect(RabbitMQEventProcessor).toHaveBeenCalledWith(mockLogger, mockModuleRegistry, [])
    })
  })

  describe("Error Handling", () => {
    it("should propagate event consumer start errors", async () => {
      const startError = new Error("Consumer start failed")
      vi.mocked(mockEventConsumer.start).mockRejectedValueOnce(startError)

      await expect(consumer.start()).rejects.toThrow("Consumer start failed")
    })

    it("should propagate event consumer stop errors", async () => {
      const stopError = new Error("Consumer stop failed")
      vi.mocked(mockEventConsumer.stop).mockRejectedValueOnce(stopError)

      await expect(consumer.stop()).rejects.toThrow("Consumer stop failed")
    })

    it("should propagate pause errors", async () => {
      const pauseError = new Error("Consumer pause failed")
      vi.mocked(mockEventConsumer.pause).mockRejectedValueOnce(pauseError)

      await expect(consumer.pause()).rejects.toThrow("Consumer pause failed")
    })

    it("should propagate resume errors", async () => {
      const resumeError = new Error("Consumer resume failed")
      vi.mocked(mockEventConsumer.resume).mockRejectedValueOnce(resumeError)

      await expect(consumer.resume()).rejects.toThrow("Consumer resume failed")
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
