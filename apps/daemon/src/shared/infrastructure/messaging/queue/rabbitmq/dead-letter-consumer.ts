/**
 * Dead Letter Queue Consumer
 *
 * Lightweight consumer that drains `hlstats.events.dlq` and at minimum logs
 * each entry with its event type + retry count, increments a Prometheus
 * counter, and acks. Without this, the DLQ is a black hole — silent loss
 * with no observability.
 *
 * Intentionally NOT a normal EventConsumer: DLQ messages have already failed
 * processing, so we don't want retry logic, nor do we want to feed them back
 * into the normal handler pipeline.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { PrometheusMetricsExporter } from "@repo/observability"
import type { ConsumeMessage, EventMessage, IQueueClient, QueueChannel } from "../core/types"
import { safeJsonParse } from "../utils/message-utils"

const DLQ_NAME = "hlstats.events.dlq"

export class DeadLetterConsumer {
  private channel: QueueChannel | null = null
  private consumerTag: string | null = null
  private running = false

  /** Bound listener kept as a field so re-subscribe works across reconnects. */
  private readonly onClientConnected = (): void => {
    void this.resubscribeAfterReconnect()
  }

  constructor(
    private readonly client: IQueueClient,
    private readonly logger: ILogger,
    private readonly metrics?: PrometheusMetricsExporter,
  ) {}

  async start(): Promise<void> {
    if (this.running) return

    this.client.on("connected", this.onClientConnected)
    await this.subscribe()
    this.running = true
    this.logger.info(`Dead letter consumer started on ${DLQ_NAME}`)
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false

    this.client.off("connected", this.onClientConnected)

    if (this.channel && this.consumerTag) {
      try {
        await this.channel.cancel(this.consumerTag)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (!msg.includes("Channel closed") && !msg.includes("IllegalOperationError")) {
          this.logger.warn(`Failed to cancel DLQ consumer: ${msg}`)
        }
      }
    }

    this.channel = null
    this.consumerTag = null
    this.logger.info("Dead letter consumer stopped")
  }

  private async subscribe(): Promise<void> {
    const channel = await this.client.createChannel("dead-letter")
    this.channel = channel

    channel.on("close", () => {
      if (this.channel === channel) this.channel = null
    })
    channel.on("error", (...args: unknown[]) => {
      const err = args[0]
      this.logger.error(
        `Dead letter channel error: ${err instanceof Error ? err.message : String(err)}`,
      )
    })

    this.consumerTag = await channel.consume(
      DLQ_NAME,
      async (msg) => {
        if (!msg) return
        this.handleDeadLetter(msg)
        try {
          channel.ack(msg)
        } catch (error) {
          this.logger.error(
            `DLQ ack failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      },
      {
        noAck: false,
        consumerTag: `dlq-${process.pid}-${Date.now()}`,
      },
    )
  }

  private async resubscribeAfterReconnect(): Promise<void> {
    if (!this.running) return
    this.logger.warn("RabbitMQ reconnected — re-subscribing DLQ consumer")
    this.channel = null
    this.consumerTag = null
    try {
      await this.subscribe()
    } catch (error) {
      this.logger.error(
        `Failed to re-subscribe DLQ consumer: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private handleDeadLetter(msg: ConsumeMessage): void {
    // Try to parse the original event for richer telemetry. Plain text or
    // malformed bodies still get acked and counted.
    const content = msg.content.toString("utf8")
    const parsed = safeJsonParse<EventMessage>(content)

    let eventType = "unknown"
    let retryCount = -1
    let messageId = msg.properties.messageId ?? "unknown"

    if (parsed.success) {
      eventType = parsed.data.payload?.eventType ?? "unknown"
      retryCount = parsed.data.metadata?.routing?.retryCount ?? -1
      messageId = parsed.data.id ?? messageId
    }

    // x-death headers from amqplib carry the original queue + reason.
    const xDeath = (msg.properties.headers?.["x-death"] ?? []) as Array<{
      queue?: string
      reason?: string
      count?: number
    }>
    const origin = xDeath[0]?.queue ?? msg.fields.exchange
    const reason = xDeath[0]?.reason ?? "unknown"

    this.logger.warn(
      `Dead-lettered message: id=${messageId} eventType=${eventType} retries=${retryCount} origin=${origin} reason=${reason}`,
    )

    this.metrics?.incrementCounter("dead_letter_messages_total", {
      event_type: eventType,
      reason,
    })
  }
}
