/**
 * Aggregates per-consumer counters, processing-time samples, and optional
 * periodic logging. Separated from EventConsumer so the lifecycle state
 * machine doesn't interleave metrics bookkeeping with control flow.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { ConsumerStats } from "./types"

interface QueueAggregate {
  received: number
  processed: number
  errors: number
  lastProcessedAt?: Date
}

export class ConsumerMetricsCollector {
  private readonly stats: ConsumerStats = {
    isConsuming: false,
    messagesProcessed: 0,
    messagesAcked: 0,
    messagesNacked: 0,
    messagesRejected: 0,
    averageProcessingTime: 0,
    queueDepth: 0,
  }

  private readonly processingTimes: number[] = []
  private readonly maxProcessingTimesSamples = 1000

  private startTime: Date = new Date()
  private eventsReceived = 0
  private validationErrors = 0
  private queueStats: Record<string, QueueAggregate> = {}

  private metricsTimer: NodeJS.Timeout | null = null

  constructor(private readonly logger: ILogger) {}

  resetForStart(queues: readonly string[]): void {
    this.startTime = new Date()
    this.eventsReceived = 0
    this.validationErrors = 0
    this.queueStats = {}
    for (const queueName of queues) {
      this.queueStats[queueName] = { received: 0, processed: 0, errors: 0 }
    }
  }

  startPeriodicLogging(intervalMs: number): void {
    this.metricsTimer = setInterval(() => {
      this.logMetrics()
    }, intervalMs)
  }

  stopPeriodicLogging(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      this.metricsTimer = null
    }
  }

  setConsuming(value: boolean): void {
    this.stats.isConsuming = value
  }

  recordReceived(queueName: string): void {
    this.eventsReceived++
    const aggregate = this.queueStats[queueName]
    if (aggregate) aggregate.received++
  }

  recordValidationError(queueName: string): void {
    this.validationErrors++
    const aggregate = this.queueStats[queueName]
    if (aggregate) aggregate.errors++
  }

  recordQueueError(queueName: string): void {
    const aggregate = this.queueStats[queueName]
    if (aggregate) aggregate.errors++
  }

  recordProcessed(queueName: string, processingTimeMs: number): void {
    this.stats.messagesAcked++
    this.stats.messagesProcessed++
    const aggregate = this.queueStats[queueName]
    if (aggregate) {
      aggregate.processed++
      aggregate.lastProcessedAt = new Date()
    }
    this.recordProcessingTime(processingTimeMs)
  }

  recordAckedRetry(): void {
    this.stats.messagesAcked++
  }

  recordRejected(): void {
    this.stats.messagesRejected++
  }

  setQueueDepth(value: number): void {
    this.stats.queueDepth = value
  }

  getStats(): ConsumerStats {
    return {
      ...this.stats,
      averageProcessingTime: this.calculateAverageProcessingTime(),
    }
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time)
    if (this.processingTimes.length > this.maxProcessingTimesSamples) {
      this.processingTimes.shift()
    }
  }

  private calculateAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) {
      return 0
    }
    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0)
    return sum / this.processingTimes.length
  }

  private logMetrics(): void {
    const uptimeMs = Date.now() - this.startTime.getTime()
    const eventsPerSecond = uptimeMs > 0 ? this.eventsReceived / (uptimeMs / 1000) : 0

    this.logger.info(`Queue Consumer Metrics:`)
    this.logger.info(`  Events Received: ${this.eventsReceived}`)
    this.logger.info(`  Events Processed: ${this.stats.messagesProcessed}`)
    this.logger.info(`  Validation Errors: ${this.validationErrors}`)
    this.logger.info(`  Events/sec: ${eventsPerSecond.toFixed(2)}`)

    for (const [queueName, q] of Object.entries(this.queueStats)) {
      this.logger.info(
        `  Queue ${queueName}: ${q.received} received, ${q.processed} processed, ${q.errors} errors`,
      )
    }
  }
}
