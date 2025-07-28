/**
 * Event Metrics Collection
 * 
 * Provides comprehensive metrics collection for the distributed event
 * processing system, including performance monitoring, error tracking,
 * and system health indicators.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { EventType } from "@/shared/types/events"

export interface EventProcessingMetrics {
  readonly totalEvents: number
  readonly eventsByType: Record<EventType, number>
  readonly processingTimes: Record<EventType, {
    count: number
    totalTime: number
    averageTime: number
    minTime: number
    maxTime: number
  }>
  readonly errorCounts: Record<EventType, number>
  readonly moduleMetrics: Record<string, {
    eventsProcessed: number
    averageProcessingTime: number
    errorCount: number
  }>
}

export class EventMetrics {
  private readonly processingTimes: Map<EventType, number[]> = new Map()
  private readonly errorCounts: Map<EventType, number> = new Map()
  private readonly moduleMetrics: Map<string, {
    eventsProcessed: number
    totalProcessingTime: number
    errorCount: number
  }> = new Map()
  private totalEvents = 0

  constructor(private readonly logger: ILogger) {}

  /**
   * Record processing time for an event type
   */
  recordProcessingTime(eventType: EventType, duration: number, moduleName?: string): void {
    // Global event type metrics
    if (!this.processingTimes.has(eventType)) {
      this.processingTimes.set(eventType, [])
    }
    this.processingTimes.get(eventType)!.push(duration)
    this.totalEvents++

    // Module-specific metrics
    if (moduleName) {
      if (!this.moduleMetrics.has(moduleName)) {
        this.moduleMetrics.set(moduleName, {
          eventsProcessed: 0,
          totalProcessingTime: 0,
          errorCount: 0,
        })
      }
      const moduleStats = this.moduleMetrics.get(moduleName)!
      moduleStats.eventsProcessed++
      moduleStats.totalProcessingTime += duration
    }

    // Log slow events
    if (duration > 1000) { // Log events taking more than 1 second
      this.logger.warn(`Slow event processing detected`, {
        eventType,
        duration: `${duration}ms`,
        moduleName,
      })
    }
  }

  /**
   * Record an error for an event type
   */
  recordError(eventType: EventType, error: Error, moduleName?: string): void {
    // Global error counts
    const currentCount = this.errorCounts.get(eventType) || 0
    this.errorCounts.set(eventType, currentCount + 1)

    // Module-specific error counts
    if (moduleName) {
      if (!this.moduleMetrics.has(moduleName)) {
        this.moduleMetrics.set(moduleName, {
          eventsProcessed: 0,
          totalProcessingTime: 0,
          errorCount: 0,
        })
      }
      this.moduleMetrics.get(moduleName)!.errorCount++
    }

    this.logger.error(`Event processing error recorded`, {
      eventType,
      error: error.message,
      moduleName,
    })
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): EventProcessingMetrics {
    const eventsByType: Record<EventType, number> = {} as Record<EventType, number>
    const processingTimes: Record<EventType, { count: number; totalTime: number; averageTime: number; minTime: number; maxTime: number }> = {} as Record<EventType, { count: number; totalTime: number; averageTime: number; minTime: number; maxTime: number }>
    const errorCounts: Record<EventType, number> = {} as Record<EventType, number>

    // Calculate event type metrics
    for (const [eventType, times] of this.processingTimes.entries()) {
      eventsByType[eventType] = times.length
      
      if (times.length > 0) {
        const totalTime = times.reduce((sum, time) => sum + time, 0)
        processingTimes[eventType] = {
          count: times.length,
          totalTime,
          averageTime: totalTime / times.length,
          minTime: Math.min(...times),
          maxTime: Math.max(...times),
        }
      }
    }

    // Set error counts
    for (const eventType of Object.values(EventType)) {
      errorCounts[eventType] = this.errorCounts.get(eventType) || 0
    }

    // Calculate module metrics
    const moduleMetrics: Record<string, { eventsProcessed: number; averageProcessingTime: number; errorCount: number }> = {}
    for (const [moduleName, stats] of this.moduleMetrics.entries()) {
      moduleMetrics[moduleName] = {
        eventsProcessed: stats.eventsProcessed,
        averageProcessingTime: stats.eventsProcessed > 0 
          ? stats.totalProcessingTime / stats.eventsProcessed 
          : 0,
        errorCount: stats.errorCount,
      }
    }

    return {
      totalEvents: this.totalEvents,
      eventsByType,
      processingTimes,
      errorCounts,
      moduleMetrics,
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalEvents: number
    averageProcessingTime: number
    errorRate: number
    slowestEventType: { eventType: EventType; averageTime: number } | null
    mostErrorProneEventType: { eventType: EventType; errorCount: number } | null
  } {
    const metrics = this.getMetrics()
    
    let totalProcessingTime = 0
    let totalProcessedEvents = 0
    let totalErrors = 0
    let slowestEventType: { eventType: EventType; averageTime: number } | null = null
    let mostErrorProneEventType: { eventType: EventType; errorCount: number } | null = null

    // Calculate totals and find extremes
    for (const [eventType, stats] of Object.entries(metrics.processingTimes)) {
      totalProcessingTime += stats.totalTime
      totalProcessedEvents += stats.count

      if (!slowestEventType || stats.averageTime > slowestEventType.averageTime) {
        slowestEventType = { eventType: eventType as EventType, averageTime: stats.averageTime }
      }
    }

    for (const [eventType, errorCount] of Object.entries(metrics.errorCounts)) {
      totalErrors += errorCount

      if (!mostErrorProneEventType || errorCount > mostErrorProneEventType.errorCount) {
        mostErrorProneEventType = { eventType: eventType as EventType, errorCount }
      }
    }

    return {
      totalEvents: metrics.totalEvents,
      averageProcessingTime: totalProcessedEvents > 0 ? totalProcessingTime / totalProcessedEvents : 0,
      errorRate: metrics.totalEvents > 0 ? totalErrors / metrics.totalEvents : 0,
      slowestEventType: slowestEventType?.averageTime && slowestEventType.averageTime > 0 ? slowestEventType : null,
      mostErrorProneEventType: mostErrorProneEventType?.errorCount && mostErrorProneEventType.errorCount > 0 ? mostErrorProneEventType : null,
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.processingTimes.clear()
    this.errorCounts.clear()
    this.moduleMetrics.clear()
    this.totalEvents = 0
    this.logger.info("Event metrics reset")
  }

  /**
   * Log performance summary
   */
  logPerformanceSummary(): void {
    const summary = this.getPerformanceSummary()
    
    this.logger.info("Event Processing Performance Summary", {
      totalEvents: summary.totalEvents,
      averageProcessingTime: `${summary.averageProcessingTime.toFixed(2)}ms`,
      errorRate: `${(summary.errorRate * 100).toFixed(2)}%`,
      slowestEventType: summary.slowestEventType ? {
        eventType: summary.slowestEventType.eventType,
        averageTime: `${summary.slowestEventType.averageTime.toFixed(2)}ms`,
      } : 'None',
      mostErrorProneEventType: summary.mostErrorProneEventType ? {
        eventType: summary.mostErrorProneEventType.eventType,
        errorCount: summary.mostErrorProneEventType.errorCount,
      } : 'None',
    })
  }
}