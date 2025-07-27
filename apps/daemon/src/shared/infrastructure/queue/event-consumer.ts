/**
 * Event Consumer Implementation
 *
 * Implements event consumption from RabbitMQ with multi-queue support,
 * retry logic with exponential backoff, and dead letter queue handling.
 */

import type {
  IEventConsumer,
  IQueueClient,
  QueueChannel,
  ConsumeMessage,
  EventMessage,
  ConsumerStats,
  MessageValidator,
} from './queue.types'
import { QueueConsumeError } from './queue.types'
import type { BaseEvent } from '@/shared/types/events'
import type { ILogger } from '@/shared/utils/logger.types'
import { safeJsonParse, calculateRetryDelay, addJitter, formatDuration } from './utils'

/**
 * Event processor interface for handling consumed events
 */
export interface IEventProcessor {
  processEvent(event: BaseEvent): Promise<void>
}

/**
 * Consumer configuration
 */
export interface ConsumerConfig {
  readonly maxRetries: number
  readonly retryDelay: number
  readonly maxRetryDelay: number
  readonly concurrency: number
  readonly queues: readonly string[]
}

/**
 * Event consumer for RabbitMQ with comprehensive error handling and retry logic
 */
export class EventConsumer implements IEventConsumer {
  private channels: Map<string, QueueChannel> = new Map()
  private consumerTags: string[] = []
  private isConsuming = false
  private isPaused = false
  
  private stats: ConsumerStats = {
    isConsuming: false,
    messagesProcessed: 0,
    messagesAcked: 0,
    messagesNacked: 0,
    messagesRejected: 0,
    averageProcessingTime: 0,
    queueDepth: 0,
  }
  
  private processingTimes: number[] = []
  private readonly maxProcessingTimesSamples = 1000

  constructor(
    private readonly client: IQueueClient,
    private readonly processor: IEventProcessor,
    private readonly logger: ILogger,
    private readonly config: ConsumerConfig = defaultConsumerConfig,
    private readonly messageValidator: MessageValidator = defaultMessageValidator,
  ) {}

  async start(): Promise<void> {
    if (this.isConsuming) {
      throw new QueueConsumeError('Consumer is already running')
    }

    try {
      // Start consuming from all configured queues
      await Promise.all(this.config.queues.map(queueName => this.consumeQueue(queueName)))
      
      this.isConsuming = true
      this.stats.isConsuming = true
      this.isPaused = false

      this.logger.info(`Event consumer started successfully for queues: ${this.config.queues.join(', ')} with concurrency: ${this.config.concurrency}`)
    } catch (error) {
      this.logger.error(`Failed to start event consumer: ${error}`)
      throw new QueueConsumeError('Failed to start consumer', error as Error)
    }
  }

  async stop(): Promise<void> {
    if (!this.isConsuming) {
      return
    }

    try {
      // Cancel all consumers
      for (const [queueName, channel] of this.channels) {
        const consumerTag = this.consumerTags.find(tag => tag.startsWith(queueName))
        if (consumerTag) {
          await channel.cancel(consumerTag)
        }
        await channel.close()
      }

      this.channels.clear()
      this.consumerTags = []
      this.isConsuming = false
      this.stats.isConsuming = false

      this.logger.info('Event consumer stopped')
    } catch (error) {
      this.logger.error(`Error stopping consumer: ${error}`)
      throw new QueueConsumeError('Failed to stop consumer', error as Error)
    }
  }

  async pause(): Promise<void> {
    this.isPaused = true
    this.logger.info('Event consumer paused')
  }

  async resume(): Promise<void> {
    this.isPaused = false
    this.logger.info('Event consumer resumed')
  }

  getConsumerStats(): ConsumerStats {
    return {
      ...this.stats,
      averageProcessingTime: this.calculateAverageProcessingTime(),
    }
  }

  private async consumeQueue(queueName: string): Promise<void> {
    const channel = await this.client.createChannel(`consumer-${queueName}`)
    this.channels.set(queueName, channel)

    // Set up consumer with error handling
    const consumerTag = await channel.consume(
      queueName,
      async (msg) => {
        if (!msg) {
          this.logger.warn(`Received null message from queue ${queueName}`)
          return
        }

        if (this.isPaused) {
          // If paused, reject message and requeue
          await channel.nack(msg, false, true)
          return
        }

        await this.handleMessage(msg, channel, queueName)
      },
      {
        noAck: false,
        consumerTag: `${queueName}-${process.pid}-${Date.now()}`,
      },
    )

    this.consumerTags.push(consumerTag)
    this.logger.debug(`Started consuming from queue ${queueName} with consumerTag: ${consumerTag}`)
  }

  private async handleMessage(msg: ConsumeMessage, channel: QueueChannel, queueName: string): Promise<void> {
    const startTime = Date.now()
    let messageId = 'unknown'

    try {
      // Parse message
      const parseResult = this.parseMessage(msg)
      if (!parseResult.success) {
        this.logger.error(`Failed to parse message from ${queueName}: ${parseResult.error} (contentLength: ${msg.content.length})`)
        
        await this.rejectMessage(msg, channel, 'Invalid message format')
        return
      }

      const message = parseResult.data
      messageId = message.id

      // Validate message
      await this.messageValidator(message)

      this.logger.debug(`Processing message ${messageId} (${message.payload.eventType}) from ${queueName} (retry: ${message.metadata.routing.retryCount})`)

      // Process the event
      await this.processor.processEvent(message.payload)

      // Acknowledge successful processing
      await channel.ack(msg)
      this.stats.messagesAcked++
      this.stats.messagesProcessed++

      const processingTime = Date.now() - startTime
      this.recordProcessingTime(processingTime)

      this.logger.debug(`Message ${messageId} (${message.payload.eventType}) processed successfully in ${formatDuration(processingTime)}`)

    } catch (error) {
      const processingTime = Date.now() - startTime
      
      this.logger.error(`Error processing message ${messageId} from ${queueName} in ${formatDuration(processingTime)}: ${error instanceof Error ? error.message : String(error)}`)

      await this.handleProcessingError(msg, channel, error as Error)
    }
  }

  private async handleProcessingError(msg: ConsumeMessage, channel: QueueChannel, error: Error): Promise<void> {
    try {
      const parseResult = this.parseMessage(msg)
      if (!parseResult.success) {
        await this.rejectMessage(msg, channel, 'Unparseable message with processing error')
        return
      }

      const message = parseResult.data
      const retryCount = message.metadata.routing.retryCount

      if (retryCount < this.config.maxRetries) {
        // Calculate retry delay with jitter
        const baseDelay = calculateRetryDelay(retryCount, this.config.retryDelay, this.config.maxRetryDelay)
        const delay = addJitter(baseDelay)

        this.logger.info(`Retrying message ${message.id} (attempt ${retryCount + 1}/${this.config.maxRetries}) in ${delay}ms`)

        // Nack with requeue after delay
        await channel.nack(msg, false, false)
        this.stats.messagesNacked++

        // Republish with updated retry count after delay
        setTimeout(async () => {
          try {
            await this.republishWithRetry(message, channel)
          } catch (republishError) {
            this.logger.error(`Failed to republish message ${message.id} for retry: ${republishError}`)
          }
        }, delay)

      } else {
        // Exceeded retry limit, send to dead letter queue
        this.logger.error(`Message ${message.id} exceeded retry limit (${retryCount}/${this.config.maxRetries}), sending to DLQ`)

        await channel.nack(msg, false, false)
        this.stats.messagesRejected++
      }

    } catch (handlingError) {
      this.logger.error(`Error in error handling - original: ${error.message}, handling error: ${handlingError instanceof Error ? handlingError.message : String(handlingError)}`)
      
      // Last resort: reject the message
      await this.rejectMessage(msg, channel, 'Error in error handling')
    }
  }

  private async republishWithRetry(message: EventMessage, channel: QueueChannel): Promise<void> {
    const updatedMessage: EventMessage = {
      ...message,
      metadata: {
        ...message.metadata,
        routing: {
          ...message.metadata.routing,
          retryCount: message.metadata.routing.retryCount + 1,
        },
      },
    }

    const published = channel.publish(
      'hlstats.events',
      message.metadata.routing.key,
      Buffer.from(JSON.stringify(updatedMessage)),
      {
        persistent: true,
        priority: message.metadata.routing.priority,
        messageId: message.id,
        headers: {
          'x-correlation-id': message.correlationId,
          'x-retry-count': updatedMessage.metadata.routing.retryCount,
        },
      },
    )

    if (!published) {
      throw new Error('Failed to republish message: channel buffer full')
    }
  }

  private async rejectMessage(msg: ConsumeMessage, channel: QueueChannel, reason: string): Promise<void> {
    this.logger.warn(`Rejecting message: ${reason}`)
    await channel.nack(msg, false, false)
    this.stats.messagesRejected++
  }

  private parseMessage(msg: ConsumeMessage): { success: true; data: EventMessage } | { success: false; error: string } {
    try {
      const content = msg.content.toString('utf8')
      return safeJsonParse<EventMessage>(content)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time)
    
    // Keep only the last N samples for rolling average
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
}

/**
 * Default consumer configuration
 */
export const defaultConsumerConfig: ConsumerConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  maxRetryDelay: 30000,
  concurrency: 10,
  queues: [
    'hlstats.events.priority',
    'hlstats.events.standard',
    'hlstats.events.bulk',
  ],
}

/**
 * Default message validator
 */
export async function defaultMessageValidator(message: EventMessage): Promise<void> {
  if (!message.id) {
    throw new Error('Message missing ID')
  }
  
  if (!message.payload) {
    throw new Error('Message missing payload')
  }
  
  if (!message.payload.eventType) {
    throw new Error('Message payload missing eventType')
  }
  
  if (!message.metadata) {
    throw new Error('Message missing metadata')
  }
  
  if (typeof message.metadata.source.serverId !== 'number') {
    throw new Error('Message metadata missing or invalid serverId')
  }
}