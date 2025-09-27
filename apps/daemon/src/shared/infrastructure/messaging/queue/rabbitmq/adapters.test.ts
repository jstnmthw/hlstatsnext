/**
 * RabbitMQ Adapters Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { AmqpChannelAdapter, AmqpConnectionAdapter } from "./adapters"
import type * as amqp from "amqplib"
import type { Connection } from "amqplib"
import type {
  ConsumeMessage,
  PublishOptions,
  ConsumeOptions,
} from "@/shared/infrastructure/messaging/queue/core/types"

describe("AmqpChannelAdapter", () => {
  let adapter: AmqpChannelAdapter
  let mockAmqpChannel: amqp.Channel

  beforeEach(() => {
    mockAmqpChannel = {
      publish: vi.fn().mockReturnValue(true),
      consume: vi.fn().mockResolvedValue({ consumerTag: "test-consumer-123" }),
      cancel: vi.fn().mockResolvedValue(undefined),
      ack: vi.fn(),
      nack: vi.fn(),
      prefetch: vi.fn().mockResolvedValue(undefined),
      assertExchange: vi.fn().mockResolvedValue(undefined),
      assertQueue: vi.fn().mockResolvedValue(undefined),
      bindQueue: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as amqp.Channel

    adapter = new AmqpChannelAdapter(mockAmqpChannel)
  })

  describe("Message Publishing", () => {
    it("should publish message successfully", () => {
      const content = Buffer.from("test message")
      const options: PublishOptions = {
        persistent: true,
        priority: 1,
        messageId: "msg-123",
      }

      const result = adapter.publish("test.exchange", "test.routing.key", content, options)

      expect(result).toBe(true)
      expect(mockAmqpChannel.publish).toHaveBeenCalledWith(
        "test.exchange",
        "test.routing.key",
        content,
        options,
      )
    })

    it("should publish message without options", () => {
      const content = Buffer.from("test message")

      const result = adapter.publish("test.exchange", "test.routing.key", content)

      expect(result).toBe(true)
      expect(mockAmqpChannel.publish).toHaveBeenCalledWith(
        "test.exchange",
        "test.routing.key",
        content,
        undefined,
      )
    })

    it("should return false when channel buffer is full", () => {
      vi.mocked(mockAmqpChannel.publish).mockReturnValue(false)
      const content = Buffer.from("test message")

      const result = adapter.publish("test.exchange", "test.routing.key", content)

      expect(result).toBe(false)
    })
  })

  describe("Message Consumption", () => {
    it("should consume messages successfully", async () => {
      const mockOnMessage = vi.fn()
      const options: ConsumeOptions = {
        noAck: false,
        consumerTag: "test-consumer",
      }

      const consumerTag = await adapter.consume("test.queue", mockOnMessage, options)

      expect(consumerTag).toBe("test-consumer-123")
      expect(mockAmqpChannel.consume).toHaveBeenCalledWith(
        "test.queue",
        expect.any(Function),
        options,
      )
    })

    it("should consume messages without options", async () => {
      const mockOnMessage = vi.fn()

      const consumerTag = await adapter.consume("test.queue", mockOnMessage)

      expect(consumerTag).toBe("test-consumer-123")
      expect(mockAmqpChannel.consume).toHaveBeenCalledWith(
        "test.queue",
        expect.any(Function),
        undefined,
      )
    })

    it("should adapt amqp message format", async () => {
      const mockOnMessage = vi.fn()
      let messageHandler: (msg: amqp.ConsumeMessage | null) => void

      vi.mocked(mockAmqpChannel.consume).mockImplementation(async (_queue, handler) => {
        messageHandler = handler
        return { consumerTag: "test-consumer-123" }
      })

      await adapter.consume("test.queue", mockOnMessage)

      // Simulate receiving a message
      const mockAmqpMessage: amqp.ConsumeMessage = {
        content: Buffer.from("test content"),
        fields: {
          deliveryTag: 1,
          redelivered: false,
          exchange: "test.exchange",
          routingKey: "test.routing.key",
          consumerTag: "test-consumer",
        },
        properties: {
          messageId: "msg-123",
          timestamp: 1640995200000,
          headers: { "x-test": "value" },
          correlationId: "corr-123",
          replyTo: "reply.queue",
          expiration: "60000",
          priority: 1,
          contentType: "application/json",
          contentEncoding: "utf8",
          deliveryMode: 2,
          type: "event",
          userId: "system",
          appId: "test-app",
          clusterId: "cluster1",
        },
      } as amqp.ConsumeMessage

      messageHandler!(mockAmqpMessage)

      expect(mockOnMessage).toHaveBeenCalledWith({
        content: Buffer.from("test content"),
        fields: {
          deliveryTag: 1,
          redelivered: false,
          exchange: "test.exchange",
          routingKey: "test.routing.key",
        },
        properties: {
          messageId: "msg-123",
          timestamp: 1640995200000,
          headers: { "x-test": "value" },
          correlationId: "corr-123",
          replyTo: "reply.queue",
          expiration: "60000",
          priority: 1,
          contentType: "application/json",
          contentEncoding: "utf8",
          deliveryMode: 2,
          type: "event",
          userId: "system",
          appId: "test-app",
          clusterId: "cluster1",
        },
      })
    })

    it("should handle null messages", async () => {
      const mockOnMessage = vi.fn()
      let messageHandler: (msg: amqp.ConsumeMessage | null) => void

      vi.mocked(mockAmqpChannel.consume).mockImplementation(async (_queue, handler) => {
        messageHandler = handler
        return { consumerTag: "test-consumer-123" }
      })

      await adapter.consume("test.queue", mockOnMessage)

      // Simulate receiving null message
      messageHandler!(null)

      expect(mockOnMessage).toHaveBeenCalledWith(null)
    })
  })

  describe("Consumer Management", () => {
    it("should cancel consumer", async () => {
      await adapter.cancel("test-consumer-123")

      expect(mockAmqpChannel.cancel).toHaveBeenCalledWith("test-consumer-123")
    })
  })

  describe("Message Acknowledgment", () => {
    it("should acknowledge message", () => {
      const message: ConsumeMessage = {
        content: Buffer.from("test"),
        fields: {
          deliveryTag: 1,
          redelivered: false,
          exchange: "test.exchange",
          routingKey: "test.routing.key",
        },
        properties: {
          messageId: "msg-123",
        },
      }

      adapter.ack(message)

      expect(mockAmqpChannel.ack).toHaveBeenCalledWith({
        content: message.content,
        fields: message.fields,
        properties: message.properties,
      })
    })

    it("should negative acknowledge message", () => {
      const message: ConsumeMessage = {
        content: Buffer.from("test"),
        fields: {
          deliveryTag: 1,
          redelivered: false,
          exchange: "test.exchange",
          routingKey: "test.routing.key",
        },
        properties: {
          messageId: "msg-123",
        },
      }

      adapter.nack(message, false, true)

      expect(mockAmqpChannel.nack).toHaveBeenCalledWith(
        {
          content: message.content,
          fields: message.fields,
          properties: message.properties,
        },
        false,
        true,
      )
    })

    it("should negative acknowledge message with default parameters", () => {
      const message: ConsumeMessage = {
        content: Buffer.from("test"),
        fields: {
          deliveryTag: 1,
          redelivered: false,
          exchange: "test.exchange",
          routingKey: "test.routing.key",
        },
        properties: {
          messageId: "msg-123",
        },
      }

      adapter.nack(message)

      expect(mockAmqpChannel.nack).toHaveBeenCalledWith(
        {
          content: message.content,
          fields: message.fields,
          properties: message.properties,
        },
        undefined,
        undefined,
      )
    })
  })

  describe("Channel Configuration", () => {
    it("should set prefetch count", async () => {
      await adapter.prefetch(10)

      expect(mockAmqpChannel.prefetch).toHaveBeenCalledWith(10)
    })
  })

  describe("Topology Management", () => {
    it("should assert exchange", async () => {
      const options = {
        durable: true,
        autoDelete: false,
        arguments: { "x-delayed-type": "direct" },
      }

      await adapter.assertExchange("test.exchange", "topic", options)

      expect(mockAmqpChannel.assertExchange).toHaveBeenCalledWith("test.exchange", "topic", options)
    })

    it("should assert exchange without options", async () => {
      await adapter.assertExchange("test.exchange", "direct")

      expect(mockAmqpChannel.assertExchange).toHaveBeenCalledWith(
        "test.exchange",
        "direct",
        undefined,
      )
    })

    it("should assert queue", async () => {
      const options = {
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: { "x-message-ttl": 60000 },
      }

      await adapter.assertQueue("test.queue", options)

      expect(mockAmqpChannel.assertQueue).toHaveBeenCalledWith("test.queue", options)
    })

    it("should assert queue without options", async () => {
      await adapter.assertQueue("test.queue")

      expect(mockAmqpChannel.assertQueue).toHaveBeenCalledWith("test.queue", undefined)
    })

    it("should bind queue", async () => {
      await adapter.bindQueue("test.queue", "test.exchange", "test.pattern")

      expect(mockAmqpChannel.bindQueue).toHaveBeenCalledWith(
        "test.queue",
        "test.exchange",
        "test.pattern",
      )
    })
  })

  describe("Channel Lifecycle", () => {
    it("should close channel", async () => {
      await adapter.close()

      expect(mockAmqpChannel.close).toHaveBeenCalledTimes(1)
    })
  })
})

describe("AmqpConnectionAdapter", () => {
  let adapter: AmqpConnectionAdapter
  let mockAmqpConnection: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    mockAmqpConnection = {
      createChannel: vi.fn().mockResolvedValue({
        publish: vi.fn(),
        consume: vi.fn(),
        close: vi.fn(),
      }),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    }

    adapter = new AmqpConnectionAdapter(mockAmqpConnection as unknown as Connection)
  })

  describe("Channel Management", () => {
    it("should create channel", async () => {
      const channel = await adapter.createChannel()

      expect(mockAmqpConnection.createChannel!).toHaveBeenCalledTimes(1)
      expect(channel).toBeInstanceOf(AmqpChannelAdapter)
    })

    it("should handle channel creation errors", async () => {
      const error = new Error("Channel creation failed")
      vi.mocked(mockAmqpConnection.createChannel!).mockRejectedValueOnce(error)

      await expect(adapter.createChannel()).rejects.toThrow("Channel creation failed")
    })
  })

  describe("Connection Lifecycle", () => {
    it("should close connection", async () => {
      await adapter.close()

      expect(mockAmqpConnection.close!).toHaveBeenCalledTimes(1)
    })

    it("should handle connection close errors", async () => {
      const error = new Error("Connection close failed")
      vi.mocked(mockAmqpConnection.close!).mockRejectedValueOnce(error)

      await expect(adapter.close()).rejects.toThrow("Connection close failed")
    })
  })

  describe("Event Handling", () => {
    it("should register event listeners", () => {
      const errorHandler = vi.fn()
      const closeHandler = vi.fn()

      adapter.on("error", errorHandler)
      adapter.on("close", closeHandler)

      expect(mockAmqpConnection.on).toHaveBeenCalledWith("error", errorHandler)
      expect(mockAmqpConnection.on).toHaveBeenCalledWith("close", closeHandler)
    })

    it("should handle multiple event listeners", () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      adapter.on("error", handler1)
      adapter.on("blocked", handler2)
      adapter.on("unblocked", handler3)

      expect(mockAmqpConnection.on).toHaveBeenCalledTimes(3)
      expect(mockAmqpConnection.on).toHaveBeenCalledWith("error", handler1)
      expect(mockAmqpConnection.on).toHaveBeenCalledWith("blocked", handler2)
      expect(mockAmqpConnection.on).toHaveBeenCalledWith("unblocked", handler3)
    })
  })

  describe("Type Compatibility", () => {
    it("should work with different event listener types", () => {
      // Test with string argument
      const stringHandler = (...args: unknown[]) => console.log(args[0])
      adapter.on("blocked", stringHandler)

      // Test with error argument
      const errorHandler = (...args: unknown[]) => console.error(args[0])
      adapter.on("error", errorHandler)

      // Test with no arguments
      const noArgsHandler = () => console.log("closed")
      adapter.on("close", noArgsHandler)

      expect(mockAmqpConnection.on).toHaveBeenCalledTimes(3)
    })
  })
})
