/**
 * Shadow Consumer Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  ShadowConsumer, 
  defaultShadowConsumerConfig, 
  createShadowConsumer,
  type ShadowConsumerConfig 
} from './shadow-consumer'
import type { IQueueClient, QueueChannel } from './queue.types'
import type { ILogger } from '@/shared/utils/logger.types'
import { LogLevel } from '@/shared/utils/logger'
import type { BaseEvent } from '@/shared/types/events'
import { EventType } from '@/shared/types/events'

// Mock implementations
const mockChannel = {
  consume: vi.fn(),
  ack: vi.fn(),
  cancel: vi.fn(),
  close: vi.fn(),
} as unknown as QueueChannel

const mockClient: IQueueClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  createChannel: vi.fn().mockResolvedValue(mockChannel),
  isConnected: vi.fn().mockReturnValue(true),
  getConnectionStats: vi.fn().mockReturnValue({
    connected: true,
    heartbeatsSent: 0,
    heartbeatsMissed: 0,
    channelsCount: 1,
    uptime: 1000,
  }),
}

const mockLogger: ILogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  connecting: vi.fn(),
  connected: vi.fn(),
  started: vi.fn(),
  starting: vi.fn(),
  stopping: vi.fn(),
  stopped: vi.fn(),
  shutdown: vi.fn(),
  shutdownComplete: vi.fn(),
  received: vi.fn(),
  failed: vi.fn(),
  fatal: vi.fn(),
  ready: vi.fn(),
  ok: vi.fn(),
  event: vi.fn(),
  chat: vi.fn(),
  disconnected: vi.fn(),
  disableTimestamps: vi.fn(),
  enableTimestamps: vi.fn(),
  disableColors: vi.fn(),
  setColorsEnabled: vi.fn(),
  getLogLevel: vi.fn().mockReturnValue(LogLevel.INFO),
  setLogLevel: vi.fn(),
  setLogLevelFromString: vi.fn(),
}

const mockEvent: BaseEvent = {
  eventType: EventType.PLAYER_KILL,
  timestamp: new Date(),
  serverId: 1,
}

describe('ShadowConsumer', () => {
  let shadowConsumer: ShadowConsumer
  let config: ShadowConsumerConfig

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock client to connected state after clearing mocks
    vi.mocked(mockClient.isConnected).mockReturnValue(true)
    vi.mocked(mockClient.createChannel).mockResolvedValue(mockChannel)
    vi.mocked(mockClient.getConnectionStats).mockReturnValue({
      connected: true,
      heartbeatsSent: 0,
      heartbeatsMissed: 0,
      channelsCount: 1,
      uptime: 1000,
    })
    config = {
      ...defaultShadowConsumerConfig,
      metricsInterval: 100, // Short interval for tests
    }
    shadowConsumer = new ShadowConsumer(mockClient, config, mockLogger)
  })

  afterEach(async () => {
    try {
      await shadowConsumer.stop()
    } catch {
      // Ignore errors during cleanup
    }
  })

  describe('constructor', () => {
    it('should create shadow consumer with default config', () => {
      expect(shadowConsumer).toBeInstanceOf(ShadowConsumer)
    })

    it('should initialize stats correctly', () => {
      const stats = shadowConsumer.getStats()
      expect(stats.eventsReceived).toBe(0)
      expect(stats.eventsProcessed).toBe(0)
      expect(stats.validationErrors).toBe(0)
      expect(stats.isRunning).toBe(false)
      expect(stats.queueStats).toEqual({
        'hlstats.events.priority': { received: 0, processed: 0, errors: 0 },
        'hlstats.events.standard': { received: 0, processed: 0, errors: 0 },
        'hlstats.events.bulk': { received: 0, processed: 0, errors: 0 },
      })
    })
  })

  describe('start', () => {
    it('should start shadow consumer successfully', async () => {
      await shadowConsumer.start()

      expect(mockClient.createChannel).toHaveBeenCalledTimes(3)
      expect(mockChannel.consume).toHaveBeenCalledTimes(3)
      expect(shadowConsumer.getStats().isRunning).toBe(true)
    })

    it('should throw error if already running', async () => {
      await shadowConsumer.start()
      
      await expect(shadowConsumer.start()).rejects.toThrow('Shadow consumer is already running')
    })

    it('should throw error if client not connected', async () => {
      vi.mocked(mockClient.isConnected).mockReturnValue(false)
      
      await expect(shadowConsumer.start()).rejects.toThrow('Queue client is not connected')
    })

    it('should handle start errors gracefully', async () => {
      vi.mocked(mockClient.createChannel).mockRejectedValue(new Error('Connection failed'))
      
      await expect(shadowConsumer.start()).rejects.toThrow('Connection failed')
    })
  })

  describe('stop', () => {
    it('should stop shadow consumer successfully', async () => {
      await shadowConsumer.start()
      await shadowConsumer.stop()

      expect(mockChannel.cancel).toHaveBeenCalledTimes(3)
      expect(mockChannel.close).toHaveBeenCalledTimes(3)
      expect(shadowConsumer.getStats().isRunning).toBe(false)
    })

    it('should handle stop when not running', async () => {
      await shadowConsumer.stop()
      // Should not throw or cause issues
      expect(mockChannel.cancel).not.toHaveBeenCalled()
    })
  })

  describe('validateEvent', () => {
    it('should validate event successfully when found in buffer', async () => {
      await shadowConsumer.start()

      // Simulate receiving an event through message handler
      const eventMessage = {
        id: 'msg-1',
        payload: mockEvent,
        metadata: {
          timestamp: Date.now(),
          routingKey: 'player.kill',
          priority: 5,
        },
      }

      // Access private method for testing (simulate message reception)
      const mockMsg = {
        content: Buffer.from(JSON.stringify(eventMessage)),
      }

      // Get the consume callback from the mock
      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      expect(consumeCall).toBeDefined()
      const messageHandler = consumeCall![1] as (msg: { content: Buffer } | null) => Promise<void>
      
      // Simulate message reception
      await messageHandler(mockMsg)

      // Now validate the event
      const isValid = shadowConsumer.validateEvent(mockEvent)
      expect(isValid).toBe(true)
    })

    it('should return false when event not found in buffer', () => {
      const isValid = shadowConsumer.validateEvent(mockEvent)
      expect(isValid).toBe(false)
    })

    it('should return false for mismatched event data', async () => {
      await shadowConsumer.start()

      const eventMessage = {
        id: 'msg-1',
        payload: { ...mockEvent, eventType: EventType.PLAYER_CONNECT },
        metadata: {
          timestamp: Date.now(),
          routingKey: 'player.kill',
          priority: 5,
        },
      }

      const mockMsg = {
        content: Buffer.from(JSON.stringify(eventMessage)),
      }

      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      expect(consumeCall).toBeDefined()
      const messageHandler = consumeCall![1] as (msg: { content: Buffer } | null) => Promise<void>
      await messageHandler(mockMsg)

      const isValid = shadowConsumer.validateEvent(mockEvent)
      expect(isValid).toBe(false)
    })
  })

  describe('message handling', () => {
    it('should handle valid message correctly', async () => {
      await shadowConsumer.start()

      const eventMessage = {
        id: 'msg-1',
        payload: mockEvent,
        metadata: {
          timestamp: Date.now(),
          routingKey: 'player.kill',
          priority: 5,
        },
      }

      const mockMsg = {
        content: Buffer.from(JSON.stringify(eventMessage)),
      }

      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      expect(consumeCall).toBeDefined()
      const messageHandler = consumeCall![1] as (msg: { content: Buffer } | null) => Promise<void>
      await messageHandler(mockMsg)

      const stats = shadowConsumer.getStats()
      expect(stats.eventsReceived).toBe(1)
      expect(stats.eventsProcessed).toBe(1)
      expect(stats.validationErrors).toBe(0)
    })

    it('should handle invalid JSON gracefully', async () => {
      await shadowConsumer.start()

      const mockMsg = {
        content: Buffer.from('invalid json'),
      }

      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      expect(consumeCall).toBeDefined()
      const messageHandler = consumeCall![1] as (msg: { content: Buffer } | null) => Promise<void>
      await messageHandler(mockMsg)

      const stats = shadowConsumer.getStats()
      expect(stats.eventsReceived).toBe(1)
      expect(stats.eventsProcessed).toBe(0)
      expect(stats.validationErrors).toBe(1)
    })

    it('should handle message processing errors', async () => {
      await shadowConsumer.start()

      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      expect(consumeCall).toBeDefined()
      const messageHandler = consumeCall![1] as (msg: { content: Buffer } | null) => Promise<void>
      
      // Simulate error during message handling
      await messageHandler(null)

      // Should not crash, errors are handled gracefully
      expect(mockLogger.error).not.toHaveBeenCalled()
    })
  })

  describe('buffer management', () => {
    it('should respect max buffer size', async () => {
      const smallBufferConfig = { ...config, maxBufferSize: 2 }
      const consumer = new ShadowConsumer(mockClient, smallBufferConfig, mockLogger)
      
      await consumer.start()

      // Simulate receiving 3 events (exceeds buffer size of 2)
      const consumeCall = vi.mocked(mockChannel.consume).mock.calls[0]
      expect(consumeCall).toBeDefined()
      const messageHandler = consumeCall![1] as (msg: { content: Buffer } | null) => Promise<void>

      for (let i = 0; i < 3; i++) {
        const event = { ...mockEvent, timestamp: new Date(Date.now() + i) }
        const eventMessage = {
          id: `msg-${i}`,
          payload: event,
          metadata: { timestamp: Date.now(), routingKey: 'player.kill', priority: 5 },
        }
        const mockMsg = { content: Buffer.from(JSON.stringify(eventMessage)) }
        await messageHandler(mockMsg)
      }

      // Buffer should not exceed maxBufferSize
      const stats = consumer.getStats()
      expect(stats.eventsProcessed).toBe(3)

      await consumer.stop()
    })
  })
})

describe('createShadowConsumer', () => {
  it('should create shadow consumer with factory function', () => {
    const consumer = createShadowConsumer(mockClient, mockLogger)
    expect(consumer).toBeInstanceOf(ShadowConsumer)
  })

  it('should merge custom config with defaults', () => {
    const customConfig = { metricsInterval: 5000 }
    const consumer = createShadowConsumer(mockClient, mockLogger, customConfig)
    expect(consumer).toBeInstanceOf(ShadowConsumer)
  })
})

describe('defaultShadowConsumerConfig', () => {
  it('should have expected default values', () => {
    expect(defaultShadowConsumerConfig.queues).toEqual([
      'hlstats.events.priority',
      'hlstats.events.standard', 
      'hlstats.events.bulk',
    ])
    expect(defaultShadowConsumerConfig.metricsInterval).toBe(30000)
    expect(defaultShadowConsumerConfig.logEvents).toBe(false)
    expect(defaultShadowConsumerConfig.maxBufferSize).toBe(10000)
  })
})