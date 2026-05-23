/**
 * RabbitMQ Client Implementation
 *
 * Implements the core RabbitMQ connection and channel management with retry logic,
 * topology setup, and error handling.
 */

import type {
  ConnectionStats,
  IQueueClient,
  QueueChannel,
  QueueClientEvent,
  QueueClientListener,
  QueueConnection,
  RabbitMQConfig,
} from "@/shared/infrastructure/messaging/queue/core/types"
import {
  QueueConnectionError,
  QueueError,
} from "@/shared/infrastructure/messaging/queue/core/types"
import type { ILogger } from "@/shared/utils/logger.types"
import * as amqp from "amqplib"
import { AmqpConnectionAdapter } from "./adapters"

/**
 * RabbitMQ client implementation with connection management and topology setup
 */
export class RabbitMQClient implements IQueueClient {
  private connection: QueueConnection | null = null
  private channels: Map<string, QueueChannel> = new Map()
  private reconnectAttempts = 0
  private isConnecting = false
  private isShuttingDown = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Polling interval used after `maxAttempts` exponential-backoff retries have
   * been exhausted. Past this point we assume the broker is in a longer
   * outage (rolling upgrade, host reboot) and keep polling forever rather
   * than leaving the daemon silently disconnected.
   */
  private static readonly LONG_POLL_INTERVAL_MS = 30_000
  private connectionStats: ConnectionStats = {
    connected: false,
    heartbeatsSent: 0,
    heartbeatsMissed: 0,
    channelsCount: 0,
    uptime: 0,
  }
  private connectionStartTime: number | null = null

  /**
   * Per-event listener sets for client lifecycle events. Consumers subscribe to
   * `"connected"` to re-establish subscriptions after a transparent reconnect.
   */
  private readonly clientListeners = new Map<
    "connected" | "disconnected",
    Set<QueueClientListener>
  >()

  constructor(
    private readonly config: RabbitMQConfig,
    private readonly logger: ILogger,
  ) {}

  on(event: QueueClientEvent, listener: QueueClientListener): void {
    if (!this.clientListeners.has(event)) {
      this.clientListeners.set(event, new Set())
    }
    this.clientListeners.get(event)!.add(listener)
  }

  off(event: QueueClientEvent, listener: QueueClientListener): void {
    this.clientListeners.get(event)?.delete(listener)
  }

  private emitClientEvent(event: QueueClientEvent): void {
    const listeners = this.clientListeners.get(event)
    if (!listeners) return
    for (const listener of listeners) {
      try {
        listener()
      } catch (error) {
        this.logger.error(
          `RabbitMQClient ${event} listener threw: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

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

      // Notify subscribers (consumer re-subscribes its queues here).
      this.emitClientEvent("connected")
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

    // Mark as shutting down to prevent reconnection attempts
    this.isShuttingDown = true

    // Cancel any pending reconnect attempt scheduled by handleConnectionError.
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    try {
      // Close all channels first - check if they're already closed
      for (const [name, channel] of this.channels) {
        try {
          // Check if channel is still open before closing
          if (channel && typeof channel.close === "function") {
            await channel.close()
            this.logger.debug(`Closed channel: ${name}`)
          }
        } catch (error) {
          // Only log if it's not an "already closed" error
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (
            !errorMessage.includes("Channel closed") &&
            !errorMessage.includes("IllegalOperationError")
          ) {
            this.logger.warn(`Failed to close channel ${name}: ${error}`)
          }
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
    } finally {
      // Reset shutdown flag
      this.isShuttingDown = false
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
    const wasConnected = this.connection !== null
    this.connection = null
    this.channels.clear()

    if (wasConnected) {
      this.emitClientEvent("disconnected")
    }

    // Don't attempt to reconnect if we're shutting down
    if (this.isShuttingDown) {
      this.logger.debug("Skipping reconnection during shutdown")
      return
    }

    // Don't pile up parallel reconnect timers if multiple errors fire close
    // together (e.g., connection 'error' immediately followed by 'close').
    if (this.reconnectTimer) {
      return
    }

    this.reconnectAttempts++

    // Phase 1: exponential backoff for the first `maxAttempts` tries.
    // Phase 2: after exhaustion, keep polling forever at a longer interval —
    // a long broker outage (rolling upgrade, host reboot) must not leave the
    // daemon permanently disconnected with green health.
    let delay: number
    if (this.reconnectAttempts <= this.config.connectionRetry.maxAttempts) {
      delay = Math.min(
        this.config.connectionRetry.initialDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.config.connectionRetry.maxDelay,
      )
      this.logger.info(
        `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.connectionRetry.maxAttempts})`,
      )
    } else {
      // Jitter ±50% so simultaneous-outage redundancy doesn't dogpile on recovery.
      const base = RabbitMQClient.LONG_POLL_INTERVAL_MS
      delay = Math.floor(base * (0.5 + Math.random()))
      this.logger.warn(
        `RabbitMQ still unavailable after ${this.config.connectionRetry.maxAttempts} attempts; continuing to poll every ~${Math.round(base / 1000)}s`,
      )
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      // Check again if we're shutting down before reconnecting
      if (this.isShuttingDown) {
        this.logger.debug("Skipping reconnection during shutdown")
        return
      }

      try {
        await this.connect()
      } catch (reconnectError) {
        this.logger.error(`Reconnection failed: ${reconnectError}`)
        // Schedule the next attempt. Note: connect() itself failed before
        // setting up the error handlers, so handleConnectionError won't be
        // invoked by the connection — drive the next attempt directly.
        await this.handleConnectionError(reconnectError as Error)
      }
    }, delay)
  }

  private async handleConnectionClose(): Promise<void> {
    const wasConnected = this.connection !== null
    this.connection = null
    this.channels.clear()
    this.connectionStats.channelsCount = 0

    if (wasConnected) {
      this.emitClientEvent("disconnected")
    }

    // Don't attempt reconnection if we're shutting down
    if (this.isShuttingDown) {
      this.logger.debug("Connection closed during shutdown")
      return
    }

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

      // Queue topology now reads from RabbitMQConfig.queues.*.options instead
      // of hardcoded values, so `messageTtl`/`maxLength`/`deadLetterExchange`
      // declared in module.ts are no longer dead config (WARN-6). Priority
      // queue gets the extra `x-max-priority` argument; everything else is
      // derived from the same shape.
      await setupChannel.assertQueue(this.config.queues.priority.name, {
        durable: this.config.queues.priority.options.durable,
        autoDelete: this.config.queues.priority.options.autoDelete,
        arguments: {
          ...buildQueueArguments(this.config.queues.priority.options),
          "x-max-priority": 10,
        },
      })

      await setupChannel.assertQueue(this.config.queues.standard.name, {
        durable: this.config.queues.standard.options.durable,
        autoDelete: this.config.queues.standard.options.autoDelete,
        arguments: buildQueueArguments(this.config.queues.standard.options),
      })

      await setupChannel.assertQueue(this.config.queues.bulk.name, {
        durable: this.config.queues.bulk.options.durable,
        autoDelete: this.config.queues.bulk.options.autoDelete,
        arguments: buildQueueArguments(this.config.queues.bulk.options),
      })

      // Dead letter queue: bounded length so a long downstream outage cannot
      // grow the DLQ into broker memory pressure (WARN-3). `drop-head` keeps
      // the most-recent failures, which is more useful for diagnosis than
      // ancient ones.
      await setupChannel.assertQueue("hlstats.events.dlq", {
        durable: true,
        autoDelete: false,
        arguments: {
          "x-max-length": 10000,
          "x-overflow": "drop-head",
        },
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
    const priorityBindings = ["player.kill", "player.suicide", "player.teamkill", "action.*"]

    for (const binding of priorityBindings) {
      await channel.bindQueue("hlstats.events.priority", "hlstats.events", binding)
    }

    // Standard queue bindings (normal events)
    const standardBindings = [
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
    ]

    for (const binding of standardBindings) {
      await channel.bindQueue("hlstats.events.standard", "hlstats.events", binding)
    }

    // Bulk queue bindings (high-volume events)
    const bulkBindings = ["weapon.*", "stats.*", "chat.*"]

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

/**
 * Build amqplib arguments object from QueueConfig.options. Skips undefined
 * fields so we don't pass `"x-max-length": undefined` (which amqplib treats
 * differently than absence).
 */
function buildQueueArguments(
  options: RabbitMQConfig["queues"]["priority"]["options"],
): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  if (options.deadLetterExchange !== undefined) {
    args["x-dead-letter-exchange"] = options.deadLetterExchange
  }
  if (options.messageTtl !== undefined) {
    args["x-message-ttl"] = options.messageTtl
  }
  if (options.maxLength !== undefined) {
    args["x-max-length"] = options.maxLength
  }
  return args
}
