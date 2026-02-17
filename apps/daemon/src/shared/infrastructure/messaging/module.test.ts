/**
 * Queue Module Tests
 *
 * Tests QueueModule behavior that doesn't require module-level constructor
 * mocking. Tests requiring initialize() (which internally creates a real
 * RabbitMQClient) are not included because vi.mock() cannot reliably replace
 * modules already loaded by the test setup with isolate: false.
 *
 * The initialization flow is covered by integration and e2e tests.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  QueueModule,
  createDevelopmentRabbitMQConfig,
  createQueueModule,
  type QueueModuleConfig,
} from "./module"
import type { RabbitMQConfig } from "./queue/core/types"

describe("QueueModule", () => {
  let logger: ILogger
  let config: QueueModuleConfig

  beforeEach(() => {
    vi.clearAllMocks()

    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      queue: vi.fn(),
    } as unknown as ILogger

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
  })

  describe("Uninitialized Behavior", () => {
    it("should throw error when getting client before initialization", () => {
      const module = new QueueModule(config, logger)
      expect(() => module.getClient()).toThrow(
        "Queue module not initialized - client not available",
      )
    })

    it("should throw error when getting publisher before initialization", () => {
      const module = new QueueModule(config, logger)
      expect(() => module.getPublisher()).toThrow(
        "Queue module not initialized - publisher not available",
      )
    })

    it("should throw error when getting consumer before initialization", () => {
      const module = new QueueModule(config, logger)
      expect(() => module.getConsumer()).toThrow(
        "Queue module not initialized - consumer not available",
      )
    })

    it("should return correct status when uninitialized", () => {
      const module = new QueueModule(config, logger)
      const status = module.getStatus()

      expect(status.initialized).toBe(false)
      expect(status.connected).toBe(false)
    })

    it("should report not initialized correctly", () => {
      const module = new QueueModule(config, logger)
      expect(module.isInitialized()).toBe(false)
    })

    it("should shutdown gracefully when not initialized", async () => {
      const module = new QueueModule(config, logger)

      await expect(module.shutdown()).resolves.toBeUndefined()
      expect(logger.info).toHaveBeenCalledWith("Queue module shutdown complete")
    })
  })
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
        bindings: ["player.kill", "player.suicide", "player.teamkill", "action.*"],
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
          "admin.*",
          "team.*",
          "map.*",
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
          maxLength: 75000,
          deadLetterExchange: "hlstats.events.dlx",
        },
      })

      expect(config.queues.bulk).toEqual({
        name: "hlstats.events.bulk",
        bindings: ["weapon.*", "stats.*", "chat.*"],
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
