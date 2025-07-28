/**
 * Saga Monitor Implementation
 *
 * Provides monitoring and logging capabilities for saga execution,
 * including metrics collection and debugging information.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { ISagaMonitor, SagaExecutionResult } from "./saga.types"

export class SagaMonitor implements ISagaMonitor {
  private readonly executionMetrics = new Map<
    string,
    {
      totalExecutions: number
      successfulExecutions: number
      failedExecutions: number
      totalExecutionTime: number
      averageExecutionTime: number
    }
  >()

  constructor(private readonly logger: ILogger) {}

  onSagaStarted(sagaName: string, eventId: string, correlationId: string): void {
    this.logger.debug(`Saga started: ${sagaName}`, {
      sagaName,
      eventId,
      correlationId,
    })
  }

  onStepExecuted(sagaName: string, stepName: string, eventId: string): void {
    this.logger.debug(`Saga step executed: ${sagaName}.${stepName}`, {
      sagaName,
      stepName,
      eventId,
    })
  }

  onStepCompensated(sagaName: string, stepName: string, eventId: string): void {
    this.logger.warn(`Saga step compensated: ${sagaName}.${stepName}`, {
      sagaName,
      stepName,
      eventId,
    })
  }

  onSagaCompleted(result: SagaExecutionResult): void {
    this.updateMetrics(result)

    this.logger.info(`Saga completed successfully: ${result.sagaName}`, {
      sagaName: result.sagaName,
      eventId: result.eventId,
      correlationId: result.correlationId,
      executionTimeMs: result.executionTimeMs,
      completedSteps: result.completedSteps,
      totalSteps: result.totalSteps,
    })
  }

  onSagaFailed(result: SagaExecutionResult): void {
    this.updateMetrics(result)

    this.logger.error(`Saga failed: ${result.sagaName}`, {
      sagaName: result.sagaName,
      eventId: result.eventId,
      correlationId: result.correlationId,
      executionTimeMs: result.executionTimeMs,
      completedSteps: result.completedSteps,
      totalSteps: result.totalSteps,
      compensatedSteps: result.compensatedSteps,
      error: result.error?.message,
    })
  }

  private updateMetrics(result: SagaExecutionResult): void {
    const existing = this.executionMetrics.get(result.sagaName) || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
    }

    existing.totalExecutions++
    existing.totalExecutionTime += result.executionTimeMs

    if (result.success) {
      existing.successfulExecutions++
    } else {
      existing.failedExecutions++
    }

    existing.averageExecutionTime = existing.totalExecutionTime / existing.totalExecutions

    this.executionMetrics.set(result.sagaName, existing)
  }

  /**
   * Get execution metrics for a specific saga
   */
  getMetrics(sagaName: string) {
    return this.executionMetrics.get(sagaName)
  }

  /**
   * Get metrics for all sagas
   */
  getAllMetrics() {
    return Object.fromEntries(this.executionMetrics.entries())
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.executionMetrics.clear()
  }
}
