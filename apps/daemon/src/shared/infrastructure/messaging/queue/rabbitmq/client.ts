/**
 * RabbitMQ Client Implementation
 *
 * Implements the core RabbitMQ connection and channel management with retry logic,
 * topology setup, and error handling.
 */

import * as amqp from "amqplib"
import type {
  IQueueClient,
  QueueConnection,
  QueueChannel,
  RabbitMQConfig,
  ConnectionStats,
} from "@/shared/infrastructure/messaging/queue/core/types"
import {
  QueueConnectionError,
  QueueError,
} from "@/shared/infrastructure/messaging/queue/core/types"
import { AmqpConnectionAdapter } from "./adapters"
import type { ILogger } from "@/shared/utils/logger.types"

/**
 * RabbitMQ client implementation with connection management and topology setup
 */
export class RabbitMQClient implements IQueueClient {
  private connection: QueueConnection | null = null
  private channels: Map<string, QueueChannel> = new Map()
  private reconnectAttempts = 0
  private isConnecting = false
  private connectionStats: ConnectionStats = {
    connected: false,
    heartbeatsSent: 0,
    heartbeatsMissed: 0,
    channelsCount: 0,
    uptime: 0,
  }
  private connectionStartTime: number | null = null

  constructor(
    private readonly config: RabbitMQConfig,
    private readonly logger: ILogger,
  ) {}

  async connect(): Promise<void> {
    if (this.isConnecting) {
      throw new QueueError("Connection already in progress")
    }

    if (this.connection) {
      throw new QueueError("Already connected")
    }

    this.isConnecting = true

    try {
      await this.attemptConnection()
      await this.setupTopology()
      this.connectionStartTime = Date.now()
      this.connectionStats.connected = true
      this.reconnectAttempts = 0
      this.isConnecting = false

      this.logger.info("RabbitMQ connection established successfully")
    } catch (error) {
      this.isConnecting = false
      this.logger.error(`Failed to establish RabbitMQ connection: ${error}`)
      throw new QueueConnectionError("RabbitMQ connection failed", error as Error)
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      return
    }

    try {
      // Close all channels first
      for (const [name, channel] of this.channels) {
        try {
          await channel.close()
          this.logger.debug(`Closed channel: ${name}`)
        } catch (error) {
          this.logger.warn(`Failed to close channel ${name}: ${error}`)
        }
      }
      this.channels.clear()

      // Close connection
      await this.connection.close()
      this.connection = null
      this.connectionStats.connected = false
      this.connectionStartTime = null

      this.logger.info("RabbitMQ connection closed")
    } catch (error) {
      this.logger.error(`Error during RabbitMQ disconnection: ${error}`)
      throw new QueueError("Failed to disconnect", error as Error)
    }
  }

  async createChannel(name: string): Promise<QueueChannel> {
    if (!this.connection) {
      throw new QueueError("No active connection")
    }

    if (this.channels.has(name)) {
      return this.channels.get(name)!
    }

    try {
      const channel = await this.connection.createChannel()
      await channel.prefetch(this.config.prefetchCount)

      this.channels.set(name, channel)
      this.connectionStats.channelsCount = this.channels.size

      this.logger.debug(`Created channel: ${name}`)
      return channel
    } catch (error) {
      this.logger.error(`Failed to create channel ${name}: ${error}`)
      throw new QueueError(`Failed to create channel ${name}`, error as Error)
    }
  }

  isConnected(): boolean {
    return this.connection !== null && this.connectionStats.connected
  }

  getConnectionStats(): ConnectionStats {
    return {
      ...this.connectionStats,
      uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
      channelsCount: this.channels.size,
    }
  }

  private async attemptConnection(): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.connectionRetry.maxAttempts; attempt++) {
      try {
        this.logger.debug(
          `Connection attempt ${attempt}/${this.config.connectionRetry.maxAttempts}`,
        )

        const amqpConnection = await amqp.connect(this.config.url, {
          heartbeat: this.config.heartbeatInterval,
          connectionTimeout: 10000,
          frameMax: 131072, // Required for RabbitMQ v4 compatibility
        })

        this.connection = new AmqpConnectionAdapter(amqpConnection as unknown as amqp.Connection)
        this.setupConnectionEventHandlers()
        return
      } catch (error) {
        lastError = error as Error
        this.logger.warn(`Connection attempt ${attempt} failed: ${error}`)

        if (attempt < this.config.connectionRetry.maxAttempts) {
          const delay = Math.min(
            this.config.connectionRetry.initialDelay * Math.pow(2, attempt - 1),
            this.config.connectionRetry.maxDelay,
          )
          this.logger.debug(`Retrying connection in ${delay}ms`)
          await this.sleep(delay)
        }
      }
    }

    throw new QueueConnectionError(
      `Failed to connect after ${this.config.connectionRetry.maxAttempts} attempts`,
      lastError!,
    )
  }

  private setupConnectionEventHandlers(): void {
    if (!this.connection) return

    this.connection.on("error", (error) => {
      this.logger.error(`RabbitMQ connection error: ${error}`)
      this.connectionStats.connected = false
      this.handleConnectionError(error as Error)
    })

    this.connection.on("close", () => {
      this.logger.warn("RabbitMQ connection closed unexpectedly")
      this.connectionStats.connected = false
      this.handleConnectionClose()
    })

    this.connection.on("blocked", (reason) => {
      this.logger.warn(`RabbitMQ connection blocked: ${reason}`)
    })

    this.connection.on("unblocked", () => {
      this.logger.info("RabbitMQ connection unblocked")
    })
  }

  private async handleConnectionError(error: Error): Promise<void> {
    this.logger.error(`Handling connection error: ${error}`)
    this.connection = null
    this.channels.clear()

    // Attempt to reconnect
    if (this.reconnectAttempts < this.config.connectionRetry.maxAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(
        this.config.connectionRetry.initialDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.config.connectionRetry.maxDelay,
      )

      this.logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)

      setTimeout(async () => {
        try {
          await this.connect()
        } catch (reconnectError) {
          this.logger.error(`Reconnection failed: ${reconnectError}`)
        }
      }, delay)
    } else {
      this.logger.error("Maximum reconnection attempts reached")
    }
  }

  private async handleConnectionClose(): Promise<void> {
    this.connection = null
    this.channels.clear()
    this.connectionStats.channelsCount = 0

    // Attempt reconnection
    await this.handleConnectionError(new Error("Connection closed"))
  }

  private async setupTopology(): Promise<void> {
    if (!this.connection) {
      throw new QueueError("Cannot setup topology without connection")
    }

    const setupChannel = await this.createChannel("topology-setup")

    try {
      // Create exchanges
      await setupChannel.assertExchange("hlstats.events", "topic", {
        durable: true,
        autoDelete: false,
      })

      await setupChannel.assertExchange("hlstats.events.dlx", "topic", {
        durable: true,
        autoDelete: false,
      })

      // Create priority queue
      await setupChannel.assertQueue("hlstats.events.priority", {
        durable: true,
        autoDelete: false,
        arguments: {
          "x-dead-letter-exchange": "hlstats.events.dlx",
          "x-message-ttl": 3600000, // 1 hour
          "x-max-priority": 10,
        },
      })

      // Create standard queue
      await setupChannel.assertQueue("hlstats.events.standard", {
        durable: true,
        autoDelete: false,
        arguments: {
          "x-dead-letter-exchange": "hlstats.events.dlx",
          "x-message-ttl": 3600000, // 1 hour
        },
      })

      // Create bulk queue
      await setupChannel.assertQueue("hlstats.events.bulk", {
        durable: true,
        autoDelete: false,
        arguments: {
          "x-dead-letter-exchange": "hlstats.events.dlx",
          "x-message-ttl": 3600000, // 1 hour
        },
      })

      // Create dead letter queue
      await setupChannel.assertQueue("hlstats.events.dlq", {
        durable: true,
        autoDelete: false,
      })

      // Create bindings
      await this.createBindings(setupChannel)

      this.logger.info("RabbitMQ topology setup completed")
    } finally {
      await setupChannel.close()
      this.channels.delete("topology-setup")
    }
  }

  private async createBindings(channel: QueueChannel): Promise<void> {
    // Priority queue bindings (high-priority events)
    const priorityBindings = [
      "player.kill",
      "player.suicide",
      "player.teamkill",
      "round.start",
      "round.end",
      "bomb.*",
      "hostage.*",
      "flag.*",
      "control.*",
    ]

    for (const binding of priorityBindings) {
      await channel.bindQueue("hlstats.events.priority", "hlstats.events", binding)
    }

    // Standard queue bindings (normal events)
    const standardBindings = [
      "player.connect",
      "player.disconnect",
      "player.change.*",
      "chat.*",
      "admin.*",
      "team.*",
      "map.*",
    ]

    for (const binding of standardBindings) {
      await channel.bindQueue("hlstats.events.standard", "hlstats.events", binding)
    }

    // Bulk queue bindings (high-volume events)
    const bulkBindings = ["weapon.*", "action.*", "stats.*"]

    for (const binding of bulkBindings) {
      await channel.bindQueue("hlstats.events.bulk", "hlstats.events", binding)
    }

    // Dead letter queue binding
    await channel.bindQueue("hlstats.events.dlq", "hlstats.events.dlx", "#")

    this.logger.debug("Queue bindings created successfully")
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
