/**
 * Event Consumer Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  EventConsumer,
  defaultConsumerConfig,
  defaultMessageValidator,
  type ConsumerConfig,
  type IEventProcessor,
} from "./consumer"
import type {
  IQueueClient,
  QueueChannel,
  ConsumeMessage,
  EventMessage,
  MessageValidator,
} from "./types"
import { QueueConsumeError } from "./types"
import type { ILogger } from "@/shared/utils/logger.types"
import { EventType } from "@/shared/types/events"

describe("EventConsumer", () => {
  let consumer: EventConsumer
  let mockClient: IQueueClient
  let mockProcessor: IEventProcessor
  let mockLogger: ILogger
  let mockChannel: QueueChannel
  let config: ConsumerConfig

  beforeEach(() => {
    vi.useFakeTimers()
    mockChannel = {
      consume: vi.fn().mockResolvedValue("test.queue-123-456"),
      cancel: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      ack: vi.fn().mockResolvedValue(undefined),
      nack: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockReturnValue(true),
    } as unknown as QueueChannel

    mockClient = {
      createChannel: vi.fn().mockResolvedValue(mockChannel),
    } as unknown as IQueueClient

    mockProcessor = {
      processEvent: vi.fn().mockResolvedValue(undefined),
    }

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      queue: vi.fn(),
    } as unknown as ILogger

    config = {
      maxRetries: 3,
      retryDelay: 100,
      maxRetryDelay: 1000,
      concurrency: 5,
      queues: ["test.queue"],
    }

    consumer = new EventConsumer(mockClient, mockProcessor, mockLogger, config)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Lifecycle Management", () => {
    it("should start consumer successfully", async () => {
      await consumer.start()

      expect(mockClient.createChannel).toHaveBeenCalledWith("consumer-test.queue")
      expect(mockChannel.consume).toHaveBeenCalledWith("test.queue", expect.any(Function), {
        noAck: false,
        consumerTag: expect.stringMatching(/^test\.queue-\d+-\d+$/),
      })
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Event consumer started successfully for queues: test.queue with concurrency: 5",
      )

      const stats = consumer.getConsumerStats()
      expect(stats.isConsuming).toBe(true)
    })

    it("should prevent starting consumer twice", async () => {
      await consumer.start()

      await expect(consumer.start()).rejects.toThrow(
        new QueueConsumeError("Consumer is already running"),
      )
    })

    it("should handle start errors", async () => {
      const error = new Error("Channel creation failed")
      vi.mocked(mockClient.createChannel).mockRejectedValueOnce(error)

      await expect(consumer.start()).rejects.toThrow("Failed to start consumer")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to start event consumer: Error: Channel creation failed",
      )
    })

    it("should stop consumer successfully", async () => {
      await consumer.start()
      await consumer.stop()

      expect(mockChannel.cancel).toHaveBeenCalledWith("test.queue-123-456")
      expect(mockChannel.close).toHaveBeenCalledTimes(0) // Consumer doesn't close channels - handled by client
      expect(mockLogger.info).toHaveBeenCalledWith("Event consumer stopped")

      const stats = consumer.getConsumerStats()
      expect(stats.isConsuming).toBe(false)
    })

    it("should handle stop when not consuming", async () => {
      await expect(consumer.stop()).resolves.toBeUndefined()
    })

    it("should handle stop errors", async () => {
      await consumer.start()

      const error = new Error("Channel cancel failed")
      vi.mocked(mockChannel.cancel).mockRejectedValueOnce(error)

      // Consumer should not throw on cancel errors, it should handle them gracefully
      await expect(consumer.stop()).resolves.toBeUndefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to cancel consumer test.queue-123-456: Error: Channel cancel failed",
      )
    })
  })

  describe("Pause and Resume", () => {
    beforeEach(async () => {
      await consumer.start()
    })

    it("should pause consumer", async () => {
      await consumer.pause()
      expect(mockLogger.info).toHaveBeenCalledWith("Event consumer paused")
    })

    it("should resume consumer", async () => {
      await consumer.pause()
      await consumer.resume()
      expect(mockLogger.info).toHaveBeenCalledWith("Event consumer resumed")
    })
  })

  describe("Message Processing", () => {
    let messageHandler: (msg: ConsumeMessage) => Promise<void>

    beforeEach(async () => {
      await consumer.start()

      // Extract the message handler
      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      messageHandler = consumeCall?.[1] as (msg: ConsumeMessage) => Promise<void>
    })

    it("should process valid message successfully", async () => {
      const eventMessage: EventMessage = {
        id: "msg-123",
        version: "1.0",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlationId: "corr-456",
        payload: {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: { killerId: 1, victimId: 2 },
        },
        metadata: {
          source: { serverId: 1, serverAddress: "127.0.0.1", serverPort: 27015 },
          routing: { key: "player.kill", priority: 1, retryCount: 0 },
        },
      }

      const mockMessage: ConsumeMessage = {
        content: Buffer.from(JSON.stringify(eventMessage)),
        properties: { messageId: "msg-123" },
        fields: { routingKey: "player.kill" },
      } as ConsumeMessage

      await messageHandler(mockMessage)

      expect(mockProcessor.processEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          data: { killerId: 1, victimId: 2 },
        }),
      )
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage)
      expect(mockLogger.queue).toHaveBeenCalledWith(
        "Event received: PLAYER_KILL (Server ID: 1)",
        expect.objectContaining({
          messageId: "msg-123",
          eventType: EventType.PLAYER_KILL,
          queueName: "test.queue",
          retryCount: 0,
        }),
      )

      const stats = consumer.getConsumerStats()
      expect(stats.messagesProcessed).toBe(1)
      expect(stats.messagesAcked).toBe(1)
    })

    it("should handle null messages", async () => {
      await messageHandler(null as unknown as ConsumeMessage)

      expect(mockLogger.warn).toHaveBeenCalledWith("Received null message from queue test.queue")
      expect(mockProcessor.processEvent).not.toHaveBeenCalled()
    })

    it("should requeue messages when paused", async () => {
      await consumer.pause()

      const mockMessage: ConsumeMessage = {
        content: Buffer.from("{}"),
        properties: {},
        fields: {},
      } as ConsumeMessage

      await messageHandler(mockMessage)

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true)
      expect(mockProcessor.processEvent).not.toHaveBeenCalled()
    })

    it("should reject invalid JSON messages", async () => {
      const mockMessage: ConsumeMessage = {
        content: Buffer.from("invalid json"),
        properties: {},
        fields: {},
      } as ConsumeMessage

      await messageHandler(mockMessage)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse message from test.queue"),
      )
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false)

      const stats = consumer.getConsumerStats()
      expect(stats.messagesRejected).toBe(1)
    })

    it("should handle message validation errors", async () => {
      const invalidMessage = {
        id: "msg-123",
        // Missing required fields
      }

      const mockMessage: ConsumeMessage = {
        content: Buffer.from(JSON.stringify(invalidMessage)),
        properties: {},
        fields: {},
      } as ConsumeMessage

      await messageHandler(mockMessage)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error processing message"),
      )
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false)
    })

    it("should handle processing errors with retry", async () => {
      const processingError = new Error("Processing failed")
      vi.mocked(mockProcessor.processEvent).mockRejectedValueOnce(processingError)

      const eventMessage: EventMessage = {
        id: "msg-123",
        version: "1.0",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlationId: "corr-456",
        payload: {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {},
        },
        metadata: {
          source: { serverId: 1, serverAddress: "127.0.0.1", serverPort: 27015 },
          routing: { key: "player.kill", priority: 1, retryCount: 0 },
        },
      }

      const mockMessage: ConsumeMessage = {
        content: Buffer.from(JSON.stringify(eventMessage)),
        properties: {},
        fields: {},
      } as ConsumeMessage

      await messageHandler(mockMessage)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error processing message msg-123 from test.queue"),
      )
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false)

      const stats = consumer.getConsumerStats()
      expect(stats.messagesNacked).toBe(1)
    })

    it("should send message to DLQ after max retries", async () => {
      const processingError = new Error("Processing failed")
      vi.mocked(mockProcessor.processEvent).mockRejectedValue(processingError)

      const eventMessage: EventMessage = {
        id: "msg-123",
        version: "1.0",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlationId: "corr-456",
        payload: {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {},
        },
        metadata: {
          source: { serverId: 1, serverAddress: "127.0.0.1", serverPort: 27015 },
          routing: { key: "player.kill", priority: 1, retryCount: 3 }, // Exceeded max retries
        },
      }

      const mockMessage: ConsumeMessage = {
        content: Buffer.from(JSON.stringify(eventMessage)),
        properties: {},
        fields: {},
      } as ConsumeMessage

      await messageHandler(mockMessage)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Message msg-123 exceeded retry limit"),
      )
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false)

      const stats = consumer.getConsumerStats()
      expect(stats.messagesRejected).toBe(1)
    })
  })

  describe("Multiple Queues", () => {
    it("should start consuming from multiple queues", async () => {
      const multiQueueConfig = {
        ...config,
        queues: ["queue1", "queue2", "queue3"],
      }

      const multiQueueConsumer = new EventConsumer(
        mockClient,
        mockProcessor,
        mockLogger,
        multiQueueConfig,
      )

      await multiQueueConsumer.start()

      expect(mockClient.createChannel).toHaveBeenCalledTimes(3)
      expect(mockClient.createChannel).toHaveBeenCalledWith("consumer-queue1")
      expect(mockClient.createChannel).toHaveBeenCalledWith("consumer-queue2")
      expect(mockClient.createChannel).toHaveBeenCalledWith("consumer-queue3")
    })
  })

  describe("Statistics", () => {
    it("should return initial stats", () => {
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

    it("should calculate average processing time", async () => {
      // Use real timers for this test to avoid fake timer pitfalls
      vi.useRealTimers()
      await consumer.start()

      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      const messageHandler = consumeCall?.[1] as (msg: ConsumeMessage) => Promise<void>

      // Introduce a real delay to ensure a measurable processing time
      vi.mocked(mockProcessor.processEvent).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 15)),
      )

      const eventMessage: EventMessage = {
        id: "msg-123",
        version: "1.0",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlationId: "corr-456",
        payload: {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {},
        },
        metadata: {
          source: { serverId: 1, serverAddress: "127.0.0.1", serverPort: 27015 },
          routing: { key: "player.kill", priority: 1, retryCount: 0 },
        },
      }

      const mockMessage: ConsumeMessage = {
        content: Buffer.from(JSON.stringify(eventMessage)),
        properties: {},
        fields: {},
      } as ConsumeMessage

      await messageHandler(mockMessage)

      const stats = consumer.getConsumerStats()
      expect(stats.averageProcessingTime).toBeGreaterThan(0)

      // Restore fake timers for subsequent tests
      vi.useFakeTimers()
    })
  })

  describe("Periodic Metrics Logging", () => {
    it("should log metrics at the configured interval", async () => {
      const metricsConfig: ConsumerConfig = {
        ...config,
        metricsInterval: 100,
        logMetrics: true,
      }

      consumer = new EventConsumer(mockClient, mockProcessor, mockLogger, metricsConfig)

      await consumer.start()

      // Extract the message handler
      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      const messageHandler = consumeCall?.[1] as (msg: ConsumeMessage) => Promise<void>

      const eventMessage: EventMessage = {
        id: "msg-123",
        version: "1.0",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlationId: "corr-456",
        payload: {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {},
        },
        metadata: {
          source: { serverId: 1, serverAddress: "127.0.0.1", serverPort: 27015 },
          routing: { key: "player.kill", priority: 1, retryCount: 0 },
        },
      }

      const mockMessage: ConsumeMessage = {
        content: Buffer.from(JSON.stringify(eventMessage)),
        properties: {},
        fields: {},
      } as ConsumeMessage

      await messageHandler(mockMessage)

      // Advance timers to trigger metrics log
      vi.advanceTimersByTime(100)

      expect(mockLogger.info).toHaveBeenCalledWith("Queue Consumer Metrics:")
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringMatching(/^\s{2}Events Received: /))
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\s{2}Events Processed: /),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\s{2}Validation Errors: /),
      )
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringMatching(/^\s{2}Events\/sec: /))
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\s{2}Queue test\.queue: \d+ received, \d+ processed, \d+ errors$/),
      )

      await consumer.stop()
    })
  })

  describe("Custom Message Validator", () => {
    it("should use custom message validator", async () => {
      const customValidator: MessageValidator = vi
        .fn()
        .mockRejectedValue(new Error("Custom validation failed"))

      const customConsumer = new EventConsumer(
        mockClient,
        mockProcessor,
        mockLogger,
        config,
        customValidator,
      )

      await customConsumer.start()

      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      const messageHandler = consumeCall?.[1] as (msg: ConsumeMessage) => Promise<void>

      const eventMessage: EventMessage = {
        id: "msg-123",
        version: "1.0",
        timestamp: "2023-01-01T00:00:00.000Z",
        correlationId: "corr-456",
        payload: {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {},
        },
        metadata: {
          source: { serverId: 1, serverAddress: "127.0.0.1", serverPort: 27015 },
          routing: { key: "player.kill", priority: 1, retryCount: 0 },
        },
      }

      const mockMessage: ConsumeMessage = {
        content: Buffer.from(JSON.stringify(eventMessage)),
        properties: {},
        fields: {},
      } as ConsumeMessage

      await messageHandler(mockMessage)

      expect(customValidator).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "msg-123",
          correlationId: "corr-456",
          payload: expect.objectContaining({
            eventType: EventType.PLAYER_KILL,
            serverId: 1,
          }),
        }),
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Custom validation failed"),
      )
    })
  })
})

describe("Default Message Validator", () => {
  it("should validate correct message", async () => {
    const validMessage: EventMessage = {
      id: "msg-123",
      version: "1.0",
      timestamp: "2023-01-01T00:00:00.000Z",
      correlationId: "corr-456",
      payload: {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      },
      metadata: {
        source: { serverId: 1, serverAddress: "127.0.0.1", serverPort: 27015 },
        routing: { key: "player.kill", priority: 1, retryCount: 0 },
      },
    }

    await expect(defaultMessageValidator(validMessage)).resolves.toBeUndefined()
  })

  it("should reject message without ID", async () => {
    const invalidMessage = {
      payload: { eventType: EventType.PLAYER_KILL },
      metadata: { source: { serverId: 1 } },
    } as EventMessage

    await expect(defaultMessageValidator(invalidMessage)).rejects.toThrow("Message missing ID")
  })

  it("should reject message without payload", async () => {
    const invalidMessage = {
      id: "msg-123",
      metadata: { source: { serverId: 1 } },
    } as EventMessage

    await expect(defaultMessageValidator(invalidMessage)).rejects.toThrow("Message missing payload")
  })

  it("should reject message without eventType", async () => {
    const invalidMessage = {
      id: "msg-123",
      payload: { serverId: 1 },
      metadata: { source: { serverId: 1 } },
    } as EventMessage

    await expect(defaultMessageValidator(invalidMessage)).rejects.toThrow(
      "Message payload missing eventType",
    )
  })

  it("should reject message without metadata", async () => {
    const invalidMessage = {
      id: "msg-123",
      payload: { eventType: EventType.PLAYER_KILL },
    } as EventMessage

    await expect(defaultMessageValidator(invalidMessage)).rejects.toThrow(
      "Message missing metadata",
    )
  })

  it("should reject message with invalid serverId", async () => {
    const invalidMessage = {
      id: "msg-123",
      correlationId: "corr-123",
      payload: { eventType: EventType.PLAYER_KILL },
      metadata: {
        source: {
          serverId: "invalid" as unknown as number,
          serverAddress: "127.0.0.1",
          serverPort: 27015,
        },
        routing: { key: "player.kill", priority: 1, retryCount: 0 },
      },
      version: "1.0",
      timestamp: "2023-01-01T00:00:00.000Z",
    } as EventMessage

    await expect(defaultMessageValidator(invalidMessage)).rejects.toThrow(
      "Message metadata missing or invalid serverId",
    )
  })
})

describe("Default Consumer Config", () => {
  it("should have correct default values", () => {
    expect(defaultConsumerConfig).toEqual({
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
