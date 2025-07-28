/**
 * Adapters for amqplib integration
 *
 * Wraps amqplib types to match our queue interfaces
 */

import type * as amqp from "amqplib"
import type {
  QueueChannel,
  QueueConnection,
  ConsumeMessage,
  PublishOptions,
  ConsumeOptions,
  AssertExchangeOptions,
  AssertQueueOptions,
} from "./queue.types"

/**
 * Adapter class that wraps amqplib Channel to match our QueueChannel interface
 */
export class AmqpChannelAdapter implements QueueChannel {
  constructor(private readonly channel: amqp.Channel) {}

  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options?: PublishOptions,
  ): boolean {
    return this.channel.publish(exchange, routingKey, content, options)
  }

  async consume(
    queue: string,
    onMessage: (msg: ConsumeMessage | null) => void,
    options?: ConsumeOptions,
  ): Promise<string> {
    const result = await this.channel.consume(
      queue,
      (msg: amqp.ConsumeMessage | null) => {
        if (msg) {
          const adaptedMsg: ConsumeMessage = {
            content: msg.content,
            fields: {
              deliveryTag: msg.fields.deliveryTag,
              redelivered: msg.fields.redelivered,
              exchange: msg.fields.exchange,
              routingKey: msg.fields.routingKey,
            },
            properties: {
              messageId: msg.properties.messageId,
              timestamp: msg.properties.timestamp,
              headers: msg.properties.headers,
              correlationId: msg.properties.correlationId,
              replyTo: msg.properties.replyTo,
              expiration: msg.properties.expiration,
              priority: msg.properties.priority,
            },
          }
          onMessage(adaptedMsg)
        } else {
          onMessage(null)
        }
      },
      options,
    )

    return result.consumerTag
  }

  async cancel(consumerTag: string): Promise<void> {
    await this.channel.cancel(consumerTag)
  }

  ack(message: ConsumeMessage): void {
    // Create a minimal message object for amqplib
    const amqpMessage = {
      content: message.content,
      fields: message.fields,
      properties: message.properties,
    } as amqp.ConsumeMessage

    this.channel.ack(amqpMessage)
  }

  nack(message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void {
    // Create a minimal message object for amqplib
    const amqpMessage = {
      content: message.content,
      fields: message.fields,
      properties: message.properties,
    } as amqp.ConsumeMessage

    this.channel.nack(amqpMessage, allUpTo, requeue)
  }

  async prefetch(count: number): Promise<void> {
    await this.channel.prefetch(count)
  }

  async assertExchange(
    exchange: string,
    type: string,
    options?: AssertExchangeOptions,
  ): Promise<void> {
    await this.channel.assertExchange(exchange, type, options)
  }

  async assertQueue(queue: string, options?: AssertQueueOptions): Promise<void> {
    await this.channel.assertQueue(queue, options)
  }

  async bindQueue(queue: string, source: string, pattern: string): Promise<void> {
    await this.channel.bindQueue(queue, source, pattern)
  }

  async close(): Promise<void> {
    await this.channel.close()
  }
}

/**
 * Adapter class that wraps amqplib Connection to match our QueueConnection interface
 */
export class AmqpConnectionAdapter implements QueueConnection {
  constructor(private readonly connection: amqp.Connection) {}

  async createChannel(): Promise<QueueChannel> {
    const channel = await (
      this.connection as unknown as { createChannel(): Promise<amqp.Channel> }
    ).createChannel()
    return new AmqpChannelAdapter(channel)
  }

  async close(): Promise<void> {
    await (this.connection as unknown as { close(): Promise<void> }).close()
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    this.connection.on(event, listener)
  }
}
